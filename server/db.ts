/**
 * Durable telemetry storage — SQLite (better-sqlite3).
 *
 * Every telemetry sample is persisted to <DATA_DIR>/telemetry.db, indexed by
 * (vehicleno, ts), so history / cell snapshots / CSV export can be queried by
 * any date range — for years, surviving restarts. The in-memory ring buffer
 * still serves the real-time live view; this is the long-term archive.
 *
 * Sampling to disk is throttled per device (DB_SAMPLE_INTERVAL_SEC, default 5s)
 * to bound growth — the live gauges/charts remain full-resolution from RAM.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HistoryMetric } from '../src/types/telemetry';

const DATA_DIR = process.env.FLEET_DATA_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'telemetry.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry (
    vehicleno TEXT NOT NULL,
    ts INTEGER NOT NULL,
    soc REAL, soh REAL, sum_voltage REAL, max_v REAL, min_v REAL,
    discharge_current REAL, charging_status INTEGER, cycle_count INTEGER,
    t1 REAL, t2 REAL, t3 REAL, t4 REAL,
    chg_mos INTEGER, dischg_mos INTEGER,
    cell_voltages TEXT, fault_hex TEXT,
    lat REAL, lng REAL, gps_valid INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_tel_veh_ts ON telemetry(vehicleno, ts);
`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO telemetry
    (vehicleno, ts, soc, soh, sum_voltage, max_v, min_v, discharge_current,
     charging_status, cycle_count, t1, t2, t3, t4, chg_mos, dischg_mos,
     cell_voltages, fault_hex, lat, lng, gps_valid)
  VALUES
    (@vehicleno, @ts, @soc, @soh, @sum_voltage, @max_v, @min_v, @discharge_current,
     @charging_status, @cycle_count, @t1, @t2, @t3, @t4, @chg_mos, @dischg_mos,
     @cell_voltages, @fault_hex, @lat, @lng, @gps_valid)
`);

const MIN_INTERVAL_MS = (Number(process.env.DB_SAMPLE_INTERVAL_SEC) || 5) * 1000;
const lastInsert = new Map<string, number>();

export interface Sample {
  ts: number; soc: number; soh: number; sum_voltage: number; max_v: number; min_v: number;
  discharge_current: number; charging_status: number; cycle_count: number;
  battery_temp_1: number; battery_temp_2: number; battery_temp_3: number; battery_temp_4: number;
  chg_mos: boolean; dischg_mos: boolean; cell_voltages: number[]; fault_hex: string;
  lat: number | null; lng: number | null; gps_valid: boolean;
}

function runInsert(vehicleno: string, e: Sample): void {
  insertStmt.run({
    vehicleno, ts: e.ts, soc: e.soc, soh: e.soh, sum_voltage: e.sum_voltage,
    max_v: e.max_v, min_v: e.min_v, discharge_current: e.discharge_current,
    charging_status: e.charging_status, cycle_count: e.cycle_count,
    t1: e.battery_temp_1, t2: e.battery_temp_2, t3: e.battery_temp_3, t4: e.battery_temp_4,
    chg_mos: e.chg_mos ? 1 : 0, dischg_mos: e.dischg_mos ? 1 : 0,
    cell_voltages: JSON.stringify(e.cell_voltages), fault_hex: e.fault_hex,
    lat: e.lat, lng: e.lng, gps_valid: e.gps_valid ? 1 : 0,
  });
}

/** Seed the DB from an in-memory history buffer (idempotent via unique ts). */
export function backfill(vehicleno: string, samples: Sample[]): void {
  if (!samples.length) return;
  try {
    const tx = db.transaction((rows: Sample[]) => { for (const r of rows) runInsert(vehicleno, r); });
    tx(samples);
    lastInsert.set(vehicleno, samples[samples.length - 1].ts);
  } catch (err) {
    console.warn('[db] backfill failed:', (err as Error).message);
  }
}

export function insertSample(vehicleno: string, e: Sample): void {
  const last = lastInsert.get(vehicleno) ?? 0;
  if (e.ts - last < MIN_INTERVAL_MS) return;
  lastInsert.set(vehicleno, e.ts);
  try {
    insertStmt.run({
      vehicleno, ts: e.ts, soc: e.soc, soh: e.soh, sum_voltage: e.sum_voltage,
      max_v: e.max_v, min_v: e.min_v, discharge_current: e.discharge_current,
      charging_status: e.charging_status, cycle_count: e.cycle_count,
      t1: e.battery_temp_1, t2: e.battery_temp_2, t3: e.battery_temp_3, t4: e.battery_temp_4,
      chg_mos: e.chg_mos ? 1 : 0, dischg_mos: e.dischg_mos ? 1 : 0,
      cell_voltages: JSON.stringify(e.cell_voltages), fault_hex: e.fault_hex,
      lat: e.lat, lng: e.lng, gps_valid: e.gps_valid ? 1 : 0,
    });
  } catch (err) {
    console.warn('[db] insert failed:', (err as Error).message);
  }
}

const METRIC_COL: Record<HistoryMetric, string> = {
  soc: 'soc', sum_voltage: 'sum_voltage', battery_temp_1: 't1', discharge_current: 'discharge_current',
};

/** Evenly downsample rows to at most `max`. */
function downsample<T>(rows: T[], max: number): T[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += step) out.push(rows[Math.floor(i)]);
  return out;
}

export function queryHistory(vehicleno: string, metric: HistoryMetric, from?: number, to?: number): { ts: number; value: number }[] {
  const col = METRIC_COL[metric] ?? 'soc';
  const rows = db.prepare(
    `SELECT ts, ${col} AS value FROM telemetry WHERE vehicleno=? AND ts>=? AND ts<=? ORDER BY ts`,
  ).all(vehicleno, from ?? 0, to ?? Number.MAX_SAFE_INTEGER) as { ts: number; value: number }[];
  return downsample(rows, 1200);
}

/** Multiple metrics aligned by timestamp (for overlay/comparison charts). */
export function querySeries(vehicleno: string, metrics: HistoryMetric[], from?: number, to?: number): Record<string, number>[] {
  const valid = metrics.filter(m => METRIC_COL[m]);
  if (valid.length === 0) return [];
  const cols = valid.map(m => `${METRIC_COL[m]} AS ${m}`).join(', ');
  const rows = db.prepare(
    `SELECT ts, ${cols} FROM telemetry WHERE vehicleno=? AND ts>=? AND ts<=? ORDER BY ts`,
  ).all(vehicleno, from ?? 0, to ?? Number.MAX_SAFE_INTEGER) as Record<string, number>[];
  return downsample(rows, 1500);
}

export function querySnapshots(vehicleno: string, from?: number, to?: number): { ts: number; cell_voltages: number[]; soc: number; sum_voltage: number }[] {
  const rows = db.prepare(
    `SELECT ts, cell_voltages, soc, sum_voltage FROM telemetry
     WHERE vehicleno=? AND ts>=? AND ts<=? AND cell_voltages IS NOT NULL ORDER BY ts`,
  ).all(vehicleno, from ?? 0, to ?? Number.MAX_SAFE_INTEGER) as { ts: number; cell_voltages: string; soc: number; sum_voltage: number }[];
  return downsample(rows, 400).map(r => ({
    ts: r.ts, soc: r.soc, sum_voltage: r.sum_voltage,
    cell_voltages: safeParse(r.cell_voltages),
  }));
}

export interface RichRow {
  ts: number; soc: number; soh: number; sum_voltage: number; max_v: number; min_v: number;
  discharge_current: number; charging_status: number; cycle_count: number;
  battery_temp_1: number; battery_temp_2: number; battery_temp_3: number; battery_temp_4: number;
  chg_mos: boolean; dischg_mos: boolean; cell_voltages: number[]; fault_hex: string;
  lat: number | null; lng: number | null; gps_valid: boolean;
}

/** Full rows for CSV export. Capped to protect memory on huge ranges. */
export function queryRich(vehicleno: string, from?: number, to?: number, limit = 500_000): RichRow[] {
  const rows = db.prepare(
    `SELECT * FROM telemetry WHERE vehicleno=? AND ts>=? AND ts<=? ORDER BY ts LIMIT ?`,
  ).all(vehicleno, from ?? 0, to ?? Number.MAX_SAFE_INTEGER, limit) as Record<string, unknown>[];
  return rows.map(r => ({
    ts: r.ts as number, soc: r.soc as number, soh: r.soh as number, sum_voltage: r.sum_voltage as number,
    max_v: r.max_v as number, min_v: r.min_v as number, discharge_current: r.discharge_current as number,
    charging_status: r.charging_status as number, cycle_count: r.cycle_count as number,
    battery_temp_1: r.t1 as number, battery_temp_2: r.t2 as number, battery_temp_3: r.t3 as number, battery_temp_4: r.t4 as number,
    chg_mos: !!r.chg_mos, dischg_mos: !!r.dischg_mos,
    cell_voltages: safeParse(r.cell_voltages as string), fault_hex: (r.fault_hex as string) ?? '',
    lat: (r.lat as number) ?? null, lng: (r.lng as number) ?? null, gps_valid: !!r.gps_valid,
  }));
}

/**
 * Rest info for OCV-SOC: when was the pack last "active" (charging or drawing
 * more than restAmps), and do we have enough recent samples to trust it.
 */
export function queryRestInfo(vehicleno: string, restAmps = 2): {
  lastActiveTs: number | null; earliestTs: number | null; samplesLastHour: number;
} {
  const now = Date.now();
  const a = db.prepare(
    `SELECT ts FROM telemetry WHERE vehicleno=? AND (charging_status=1 OR ABS(discharge_current)>?) ORDER BY ts DESC LIMIT 1`,
  ).get(vehicleno, restAmps) as { ts: number } | undefined;
  const e = db.prepare('SELECT MIN(ts) t FROM telemetry WHERE vehicleno=?').get(vehicleno) as { t: number | null };
  const c = db.prepare('SELECT COUNT(*) n FROM telemetry WHERE vehicleno=? AND ts>=?').get(vehicleno, now - 3_600_000) as { n: number };
  return { lastActiveTs: a?.ts ?? null, earliestTs: e?.t ?? null, samplesLastHour: c.n };
}

export function deleteVehicleData(vehicleno: string): void {
  try { db.prepare('DELETE FROM telemetry WHERE vehicleno=?').run(vehicleno); } catch { /* ignore */ }
}

export function dbStats(): { rows: number; devices: number } {
  const r = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT vehicleno) d FROM telemetry').get() as { n: number; d: number };
  return { rows: r.n, devices: r.d };
}

function safeParse(s: string): number[] {
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; }
}
