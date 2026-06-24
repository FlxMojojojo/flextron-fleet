/**
 * Persistent battery alert log (audit history).
 *
 * When a fault/alert first appears on a device, an entry is created (status
 * "active"). It stays visible until a user/admin dismisses it, which marks it
 * "acknowledged" — never deleted. One open entry per (vehicle, code) at a time;
 * a re-trigger after acknowledgement opens a fresh entry. Persists to disk.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FaultSeverity } from './faults';

export interface AlertLogEntry {
  id: string;
  vehicleno: string;
  device_id: string;
  code: string;
  name: string;
  severity: FaultSeverity;
  raised_at: number;          // epoch ms
  status: 'active' | 'acknowledged';
  acknowledged_at?: number;
  acknowledged_by?: string;
}

export interface ActiveAlertInput {
  code: string;
  name: string;
  severity: FaultSeverity;
}

const DATA_DIR = process.env.FLEET_DATA_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = join(DATA_DIR, 'alert-log.json');
const MAX_PER_VEHICLE = 500;

const log: AlertLogEntry[] = [];
let started = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function initAlertLog() {
  if (started) return;
  started = true;
  try {
    if (existsSync(FILE)) {
      const arr = JSON.parse(readFileSync(FILE, 'utf8')) as AlertLogEntry[];
      for (const e of arr) log.push(e);
    }
  } catch (e) {
    console.warn('[alertLog] load failed:', (e as Error).message);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(FILE, JSON.stringify(log), 'utf8');
    } catch (e) {
      console.warn('[alertLog] save failed:', (e as Error).message);
    }
  }, 4000);
}

/** Open a log entry for any currently-active alert that doesn't already have one. */
export function syncAlerts(vehicleno: string, deviceId: string, active: ActiveAlertInput[]): void {
  const now = Date.now();
  for (const a of active) {
    const hasOpen = log.some(e => e.vehicleno === vehicleno && e.code === a.code && e.status === 'active');
    if (!hasOpen) {
      log.push({
        id: randomBytes(8).toString('hex'),
        vehicleno,
        device_id: deviceId,
        code: a.code,
        name: a.name,
        severity: a.severity,
        raised_at: now,
        status: 'active',
      });
      // Bound history per vehicle (drop oldest acknowledged first).
      const mine = log.filter(e => e.vehicleno === vehicleno);
      if (mine.length > MAX_PER_VEHICLE) {
        const drop = mine.filter(e => e.status === 'acknowledged')
          .sort((x, y) => x.raised_at - y.raised_at)[0] ?? mine[0];
        const idx = log.indexOf(drop);
        if (idx >= 0) log.splice(idx, 1);
      }
      scheduleSave();
    }
  }
}

export function listAlertLog(vehicleno: string): AlertLogEntry[] {
  return log.filter(e => e.vehicleno === vehicleno)
    .sort((a, b) => b.raised_at - a.raised_at);
}

export function listAllAlertLog(): AlertLogEntry[] {
  return [...log].sort((a, b) => b.raised_at - a.raised_at);
}

export function acknowledgeAlert(id: string, username: string): AlertLogEntry | null {
  const e = log.find(x => x.id === id);
  if (!e) return null;
  if (e.status !== 'acknowledged') {
    e.status = 'acknowledged';
    e.acknowledged_at = Date.now();
    e.acknowledged_by = username;
    scheduleSave();
  }
  return e;
}
