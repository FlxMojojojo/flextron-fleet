/**
 * Server-side fleet store.
 * Lives in the Vite dev-server (Node) process so it can accept POSTed
 * telemetry and serve it back to the browser over real REST endpoints.
 *
 * In production this is exactly what the FastAPI backend replaces — the
 * browser already talks to it as `/api/...`, so going live is a base-URL swap.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CanTelemetry, GpsTelemetry, VehicleState, VehicleStatus, HistoryMetric,
} from '../src/types/telemetry';
import { decodeFaults } from './faults';

// ── Persistence ──────────────────────────────────────────
// State survives restarts/reboots by snapshotting to disk. Override the
// location with FLEET_DATA_DIR (e.g. a mounted volume) in production.
const DATA_DIR = process.env.FLEET_DATA_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SNAPSHOT = join(DATA_DIR, 'snapshot.json');
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const BLR_LAT = 12.9716;
const BLR_LNG = 77.5946;

function rnd(min: number, max: number, dp = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildCells(minV: number, maxV: number): number[] {
  // Synthesize 20 plausible cell voltages between min and max,
  // guaranteeing the extremes are present.
  const cells = Array.from({ length: 20 }, () => rnd(minV, maxV, 3));
  cells[0] = parseFloat(minV.toFixed(3));
  cells[19] = parseFloat(maxV.toFixed(3));
  return cells;
}

interface InternalRecord {
  can: CanTelemetry;
  gps: GpsTelemetry;
  forcedStatus?: VehicleStatus;
  lastChargeTs: number | null; // last time charging_status === 1
  gpsDistanceKm: number;       // accumulated from GPS deltas only
  prevGps: { lat: number; lng: number } | null;
  faultBytes?: number[];       // raw 8-byte fault frame (0x040980)
  history: { ts: number; soc: number; sum_voltage: number; battery_temp_1: number; discharge_current: number }[];
}

const store = new Map<string, InternalRecord>();

// A vehicle is considered offline if no telemetry arrives within this window.
const OFFLINE_AFTER_MS = (Number(process.env.OFFLINE_AFTER_SEC) || 60) * 1000;

function deriveStatus(can: CanTelemetry, forced: VehicleStatus | undefined, hasCriticalFault: boolean): VehicleStatus {
  if (forced === 'offline') return 'offline';
  if (hasCriticalFault || can.hv_critical_alert || can.battery_high_temp_telltale || (can.max_v - can.min_v) > 0.3) return 'alert';
  if (can.charging_status === 1) return 'charging';
  return 'ok';
}

function toVehicleState(id: string, rec: InternalRecord): VehicleState {
  const cellDelta = parseFloat((rec.can.max_v - rec.can.min_v).toFixed(3));
  const now = Date.now();
  const stale = now - rec.can.ts > OFFLINE_AFTER_MS;
  const faults = decodeFaults(rec.faultBytes);
  const hasCritical = faults.some(f => f.severity === 'CRITICAL');
  return {
    vehicleno: id,
    can: rec.can,
    gps: rec.gps,
    status: stale ? 'offline' : deriveStatus(rec.can, rec.forcedStatus, hasCritical),
    cell_delta: cellDelta,
    last_seen: rec.can.ts,
    hours_since_charge: rec.lastChargeTs == null ? null : parseFloat(((now - rec.lastChargeTs) / 3_600_000).toFixed(2)),
    gps_distance_km: parseFloat(rec.gpsDistanceKm.toFixed(3)),
    faults,
    fault_bytes: rec.faultBytes,
  };
}

// ── Seeding ──────────────────────────────────────────────
interface Seed { id: string; latOff: number; lngOff: number; soc: number; forced?: VehicleStatus; }

const SEEDS: Seed[] = [
  { id: 'FLX-001', latOff:  0.012, lngOff:  0.018, soc: 82 },
  { id: 'FLX-002', latOff: -0.008, lngOff:  0.031, soc: 67 },
  { id: 'FLX-003', latOff:  0.025, lngOff: -0.014, soc: 91, forced: 'charging' },
  { id: 'FLX-004', latOff: -0.019, lngOff: -0.022, soc: 45 },
  { id: 'FLX-005', latOff:  0.033, lngOff:  0.009, soc: 72 },
  { id: 'FLX-006', latOff: -0.027, lngOff:  0.041, soc: 58 },
  { id: 'FLX-007', latOff:  0.007, lngOff: -0.035, soc: 88, forced: 'alert' },
  { id: 'FLX-008', latOff: -0.041, lngOff: -0.007, soc: 33, forced: 'offline' },
  { id: 'FLX-009', latOff:  0.018, lngOff:  0.052, soc: 76 },
  { id: 'FLX-010', latOff: -0.003, lngOff: -0.048, soc: 61 },
  { id: 'FLX-011', latOff:  0.046, lngOff: -0.027, soc: 94, forced: 'charging' },
  { id: 'FLX-012', latOff: -0.035, lngOff:  0.019, soc: 49 },
  { id: 'FLX-013', latOff:  0.052, lngOff:  0.038, soc: 83 },
  { id: 'FLX-014', latOff: -0.014, lngOff: -0.061, soc: 70, forced: 'alert' },
  { id: 'FLX-015', latOff:  0.029, lngOff: -0.053, soc: 55 },
  { id: 'FLX-016', latOff: -0.055, lngOff:  0.034, soc: 78 },
];

function seedCan(seed: Seed, ts: number): CanTelemetry {
  const isAlert = seed.forced === 'alert';
  const isCharge = seed.forced === 'charging';
  const spread = isAlert ? 0.18 : 0.025;
  const min_v = parseFloat((3.65 - spread).toFixed(3));
  const max_v = parseFloat((3.65 + spread).toFixed(3));
  const cells = buildCells(min_v, max_v);
  return {
    vehicleno: seed.id,
    ts,
    soc: seed.soc,
    soh: rnd(88, 99, 1),
    cycle_count: Math.floor(rnd(120, 380, 0)),
    sum_voltage: parseFloat(cells.reduce((a, b) => a + b, 0).toFixed(2)),
    max_v, min_v,
    cell_voltages: cells,
    discharge_current: isCharge ? -rnd(2, 8, 2) : rnd(5, 22, 2),
    charging_status: isCharge ? 1 : 0,
    chg_mos: isCharge,
    dischg_mos: !isCharge,
    remain_cap: parseFloat((seed.soc * 0.52).toFixed(2)),
    dte: parseFloat((seed.soc * 0.48).toFixed(1)),
    odometer: parseFloat(rnd(120, 4800, 1).toFixed(1)),
    vehicle_speed: seed.forced === 'offline' ? 0 : rnd(0, 28, 1),
    fast_charge_indicator: false,
    battery_temp_1: isAlert ? rnd(52, 62, 1) : rnd(28, 38, 1),
    battery_temp_2: isAlert ? rnd(50, 60, 1) : rnd(27, 37, 1),
    battery_temp_3: rnd(27, 38, 1),
    battery_temp_4: rnd(26, 37, 1),
    battery_high_temp_telltale: isAlert,
    hv_critical_alert: isAlert && Math.random() > 0.5,
  };
}

function init() {
  const now = Date.now();
  for (const seed of SEEDS) {
    const can = seedCan(seed, now);
    const gps: GpsTelemetry = {
      vehicleno: seed.id,
      ts: now,
      latitude: parseFloat((BLR_LAT + seed.latOff).toFixed(6)),
      longitude: parseFloat((BLR_LNG + seed.lngOff).toFixed(6)),
    };
    const history = Array.from({ length: 60 }, (_, i) => {
      const t = now - (60 - i) * 10_000;
      const decay = (60 - i) / 60;
      return {
        ts: t,
        soc: parseFloat((seed.soc + decay * rnd(-5, 2, 1)).toFixed(1)),
        sum_voltage: parseFloat((can.sum_voltage + decay * rnd(-0.5, 0.5, 2)).toFixed(2)),
        battery_temp_1: parseFloat((can.battery_temp_1 + decay * rnd(-1, 1, 1)).toFixed(1)),
        discharge_current: parseFloat((can.discharge_current + decay * rnd(-2, 2, 2)).toFixed(2)),
      };
    });
    // Demo fault frames on the seeded alert bikes so the faults panel is
    // populated out of the box (real devices send their own fault_bytes).
    let faultBytes: number[] | undefined;
    if (seed.id === 'FLX-007') faultBytes = [0, 0x20, 0, 0, 0, 0, 0x40, 0]; // DSG_TEMP_HIGH_L2 (crit) + THERMAL_RUNAWAY (crit)
    if (seed.id === 'FLX-014') faultBytes = [0x01, 0, 0, 0x01, 0, 0, 0, 0];  // CELL_OVERVOLT_L1 (warn) + VOLT_DIFF_L1 (warn)

    store.set(seed.id, {
      can, gps,
      forcedStatus: seed.forced,
      lastChargeTs: seed.forced === 'charging' ? now : now - rnd(0.5, 9, 2) * 3_600_000,
      gpsDistanceKm: parseFloat(rnd(0, 12, 2).toFixed(2)),
      prevGps: { lat: gps.latitude, lng: gps.longitude },
      faultBytes,
      history,
    });
  }
}

// ── Snapshot load / save ─────────────────────────────────
function loadSnapshot(): boolean {
  try {
    if (!existsSync(SNAPSHOT)) return false;
    const parsed = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, InternalRecord>;
    for (const [id, rec] of Object.entries(parsed)) store.set(id, rec);
    console.log(`[fleetStore] restored ${store.size} vehicles from snapshot`);
    return store.size > 0;
  } catch (e) {
    console.warn('[fleetStore] snapshot load failed, seeding fresh:', (e as Error).message);
    return false;
  }
}

export function saveSnapshotNow() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, InternalRecord> = {};
    for (const [id, rec] of store) obj[id] = rec;
    writeFileSync(SNAPSHOT, JSON.stringify(obj), 'utf8');
  } catch (e) {
    console.warn('[fleetStore] snapshot save failed:', (e as Error).message);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveSnapshotNow(); }, 5000);
}

// ── Live simulation ──────────────────────────────────────
let started = false;
export function startSimulation() {
  if (started) return;
  started = true;
  if (!loadSnapshot()) init();
  setInterval(saveSnapshotNow, 30_000); // periodic durable checkpoint
  setInterval(() => {
    const now = Date.now();
    for (const seed of SEEDS) {
      if (seed.forced === 'offline') continue;
      const rec = store.get(seed.id);
      if (!rec) continue; // seeded bike was deleted by an admin
      const isAlert = seed.forced === 'alert';
      const isCharge = seed.forced === 'charging';

      const socDelta = isCharge ? rnd(0, 0.15, 2) : -rnd(0, 0.12, 2);
      const newSoc = Math.max(1, Math.min(100, rec.can.soc + socDelta));
      const spread = isAlert ? 0.12 : 0.015;
      const min_v = parseFloat((3.65 - spread + rnd(-0.01, 0.01, 3)).toFixed(3));
      const max_v = parseFloat((3.65 + spread + rnd(-0.01, 0.01, 3)).toFixed(3));
      const cells = buildCells(min_v, max_v);

      const newLat = parseFloat((rec.gps.latitude + (Math.random() - 0.5) * 0.0006).toFixed(6));
      const newLng = parseFloat((rec.gps.longitude + (Math.random() - 0.5) * 0.0006).toFixed(6));
      applyGps(rec, newLat, newLng, now);

      rec.can = {
        ...rec.can,
        ts: now,
        soc: parseFloat(newSoc.toFixed(1)),
        cell_voltages: cells,
        max_v, min_v,
        sum_voltage: parseFloat(cells.reduce((a, b) => a + b, 0).toFixed(2)),
        vehicle_speed: rnd(0, 28, 1),
        battery_temp_1: parseFloat((rec.can.battery_temp_1 + rnd(-0.3, 0.3, 1)).toFixed(1)),
        battery_temp_2: parseFloat((rec.can.battery_temp_2 + rnd(-0.3, 0.3, 1)).toFixed(1)),
        battery_temp_3: parseFloat((rec.can.battery_temp_3 + rnd(-0.3, 0.3, 1)).toFixed(1)),
        battery_temp_4: parseFloat((rec.can.battery_temp_4 + rnd(-0.3, 0.3, 1)).toFixed(1)),
        discharge_current: isCharge ? -rnd(2, 8, 2) : rnd(5, 22, 2),
      };
      if (isCharge) rec.lastChargeTs = now;
      pushHistory(rec, now);
    }
  }, 3000);
}

function applyGps(rec: InternalRecord, lat: number, lng: number, ts: number) {
  if (rec.prevGps) {
    rec.gpsDistanceKm += haversineKm(rec.prevGps.lat, rec.prevGps.lng, lat, lng);
  }
  rec.prevGps = { lat, lng };
  rec.gps = { vehicleno: rec.gps.vehicleno, ts, latitude: lat, longitude: lng };
}

function pushHistory(rec: InternalRecord, ts: number) {
  rec.history.push({
    ts,
    soc: rec.can.soc,
    sum_voltage: rec.can.sum_voltage,
    battery_temp_1: rec.can.battery_temp_1,
    discharge_current: rec.can.discharge_current,
  });
  if (rec.history.length > 200) rec.history.shift();
}

// ── Ingest (POST) ────────────────────────────────────────
type IngestPayload =
  | { vehicleno: string; type: 'can'; can: Record<string, unknown>; fault_bytes?: number[]; alarm_levels_raw?: number[] }
  | { vehicleno: string; type: 'gps'; data: { latitude: number; longitude: number } };

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}
/** Flexible boolean: true/false, 1/0, "ON"/"OFF", "true"/"yes". */
function flexBool(v: unknown, fallback = false): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    return s === 'ON' || s === '1' || s === 'TRUE' || s === 'YES';
  }
  return fallback;
}
/** First defined value among candidate keys (supports clean + legacy names). */
function firstDefined(c: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (c[k] !== undefined && c[k] !== null) return c[k];
  return undefined;
}
function numKeys(c: Record<string, unknown>, keys: string[], fallback: number): number {
  const v = firstDefined(c, keys);
  return v === undefined ? fallback : num(v, fallback);
}
function boolKeys(c: Record<string, unknown>, keys: string[], fallback = false): boolean {
  const v = firstDefined(c, keys);
  return v === undefined ? fallback : flexBool(v, fallback);
}

/** Accepts the partner's wire format and reflects it on the dashboard. */
export function ingest(payload: IngestPayload): { ok: true; vehicleno: string } {
  const id = payload.vehicleno;
  const now = Date.now();
  let rec = store.get(id);

  // Auto-create unknown vehicles so a fresh POST shows up immediately.
  if (!rec) {
    const min_v = 3.2, max_v = 3.4;
    rec = {
      can: {
        vehicleno: id, ts: now, soc: 0, soh: 100, cycle_count: 0,
        sum_voltage: 0, max_v, min_v, cell_voltages: buildCells(min_v, max_v),
        discharge_current: 0, charging_status: 0, chg_mos: false, dischg_mos: false,
        remain_cap: 0, dte: 0, odometer: 0, vehicle_speed: 0, fast_charge_indicator: false,
        battery_temp_1: 0, battery_temp_2: 0, battery_temp_3: 0, battery_temp_4: 0,
        battery_high_temp_telltale: false, hv_critical_alert: false,
      },
      gps: { vehicleno: id, ts: now, latitude: BLR_LAT, longitude: BLR_LNG },
      lastChargeTs: null,
      gpsDistanceKm: 0,
      prevGps: null,
      history: [],
    };
    store.set(id, rec);
  }

  if (payload.type === 'can') {
    const c = payload.can;

    // Cell voltages: prefer the device-provided array (supports any pack size,
    // e.g. 20S or 24S). Fall back to synthesizing from min/max for legacy senders.
    const rawCells = firstDefined(c, ['cell_voltages', 'cellVoltages', 'CellVoltages']);
    let cells: number[];
    if (Array.isArray(rawCells) && rawCells.length > 0) {
      cells = rawCells.map(x => parseFloat(num(x).toFixed(3)));
    } else {
      cells = rec.can.cell_voltages.length ? rec.can.cell_voltages : buildCells(3.2, 3.4);
    }

    // Use provided max/min/sum if present, otherwise derive from the cells.
    const provMax = firstDefined(c, ['max_v', 'MaxV']);
    const provMin = firstDefined(c, ['min_v', 'MinV']);
    const provSum = firstDefined(c, ['sum_voltage', 'SumVoltage']);
    const max_v = provMax !== undefined ? num(provMax) : parseFloat(Math.max(...cells).toFixed(3));
    const min_v = provMin !== undefined ? num(provMin) : parseFloat(Math.min(...cells).toFixed(3));
    const sum_voltage = provSum !== undefined ? num(provSum)
      : parseFloat(cells.reduce((a, b) => a + b, 0).toFixed(2));

    const charging = numKeys(c, ['charging_status'], rec.can.charging_status);
    rec.can = {
      ...rec.can,
      vehicleno: id,
      ts: now,
      soc: numKeys(c, ['soc'], rec.can.soc),
      soh: numKeys(c, ['soh'], rec.can.soh),
      cycle_count: numKeys(c, ['cycle_count'], rec.can.cycle_count),
      sum_voltage,
      max_v, min_v,
      cell_voltages: cells,
      discharge_current: numKeys(c, ['discharge_current', 'Discharge Current'], rec.can.discharge_current),
      charging_status: charging,
      chg_mos: boolKeys(c, ['chg_mos', 'ChgMOS'], rec.can.chg_mos),
      dischg_mos: boolKeys(c, ['dischg_mos', 'DisChgMOS'], rec.can.dischg_mos),
      remain_cap: numKeys(c, ['remain_cap', 'RemainCap'], rec.can.remain_cap),
      dte: numKeys(c, ['dte'], rec.can.dte),
      odometer: numKeys(c, ['odometer'], rec.can.odometer),
      vehicle_speed: numKeys(c, ['vehicle_speed'], rec.can.vehicle_speed),
      fast_charge_indicator: boolKeys(c, ['fast_charge_indicator'], rec.can.fast_charge_indicator),
      battery_temp_1: numKeys(c, ['battery_temp_1', 'battery_temp'], rec.can.battery_temp_1),
      battery_temp_2: numKeys(c, ['battery_temp_2', 'battery_temp 2'], rec.can.battery_temp_2),
      battery_temp_3: numKeys(c, ['battery_temp_3', 'battery_temp 3'], rec.can.battery_temp_3),
      battery_temp_4: numKeys(c, ['battery_temp_4', 'battery_temp 4'], rec.can.battery_temp_4),
      battery_high_temp_telltale: boolKeys(c, ['battery_high_temp_telltale'], false),
      hv_critical_alert: boolKeys(c, ['hv_critical_alert'], false),
    };
    // Decode + store the raw BMS fault frame (Data0..Data7) if present.
    if (Array.isArray(payload.fault_bytes)) {
      rec.faultBytes = payload.fault_bytes.slice(0, 8).map(n => Number(n) || 0);
    }
    rec.forcedStatus = undefined; // real data overrides any seeded forcing
    if (charging === 1) rec.lastChargeTs = now;
    pushHistory(rec, now);
  } else if (payload.type === 'gps') {
    applyGps(rec, num(payload.data.latitude), num(payload.data.longitude), now);
    rec.can.ts = now;
  }
  scheduleSave();
  return { ok: true, vehicleno: id };
}

/** Remove a vehicle and its history. It re-registers if the device posts again. */
export function deleteVehicle(id: string): boolean {
  const existed = store.delete(id);
  if (existed) saveSnapshotNow();
  return existed;
}

// ── Read API ─────────────────────────────────────────────
export function getVehicles(): VehicleState[] {
  return Array.from(store.entries()).map(([id, rec]) => toVehicleState(id, rec));
}
export function getVehicle(id: string): VehicleState | null {
  const rec = store.get(id);
  return rec ? toVehicleState(id, rec) : null;
}
export function getHistory(id: string, metric: HistoryMetric) {
  const rec = store.get(id);
  if (!rec) return [];
  return rec.history.map(h => ({ ts: h.ts, value: h[metric as keyof typeof h] as number }));
}
