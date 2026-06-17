/**
 * Bike owner / customer store.
 * An owner (name, mobile, purchase date, 2W/3W) is manually mapped to exactly
 * one FLX IoT device (vehicleno). Persists to <DATA_DIR>/owners.json.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Owner, VehicleType } from '../src/types/telemetry';

const DATA_DIR = process.env.FLEET_DATA_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const OWNERS_FILE = join(DATA_DIR, 'owners.json');

const owners = new Map<string, Owner>();
let started = false;

export function initOwners() {
  if (started) return;
  started = true;
  try {
    if (existsSync(OWNERS_FILE)) {
      const arr = JSON.parse(readFileSync(OWNERS_FILE, 'utf8')) as Owner[];
      for (const o of arr) owners.set(o.id, o);
    }
  } catch (e) {
    console.warn('[owners] failed to load:', (e as Error).message);
  }
}

function persist() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OWNERS_FILE, JSON.stringify([...owners.values()], null, 2), 'utf8');
}

export function listOwners(): Owner[] {
  return [...owners.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function getOwnerByVehicle(vehicleno: string): Owner | null {
  return [...owners.values()].find(o => o.vehicleno === vehicleno) ?? null;
}

interface OwnerInput {
  name?: string;
  mobile?: string;
  purchase_date?: string;
  vehicle_type?: string;
  vehicleno?: string;
}

function validate(input: OwnerInput, excludeId?: string): Required<Pick<Owner, 'name' | 'mobile' | 'purchase_date' | 'vehicle_type' | 'vehicleno'>> {
  const name = (input.name ?? '').trim();
  const mobile = (input.mobile ?? '').trim();
  const purchase_date = (input.purchase_date ?? '').trim();
  const vehicle_type = (input.vehicle_type ?? '').trim().toUpperCase() as VehicleType;
  const vehicleno = (input.vehicleno ?? '').trim();

  if (!name) throw new Error('name is required');
  if (!/^[+\d][\d\s-]{6,15}$/.test(mobile)) throw new Error('enter a valid mobile number');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) throw new Error('purchase_date must be YYYY-MM-DD');
  if (vehicle_type !== '2W' && vehicle_type !== '3W') throw new Error('vehicle_type must be 2W or 3W');
  if (!vehicleno) throw new Error('a vehicle must be selected');

  // One owner per vehicle.
  const clash = [...owners.values()].find(o => o.vehicleno === vehicleno && o.id !== excludeId);
  if (clash) throw new Error(`${vehicleno} is already mapped to ${clash.name}`);

  return { name, mobile, purchase_date, vehicle_type, vehicleno };
}

export function createOwner(input: OwnerInput): Owner {
  const v = validate(input);
  const owner: Owner = { id: randomBytes(8).toString('hex'), createdAt: Date.now(), ...v };
  owners.set(owner.id, owner);
  persist();
  return owner;
}

export function updateOwner(id: string, input: OwnerInput): Owner {
  const existing = owners.get(id);
  if (!existing) throw new Error('owner not found');
  const v = validate({ ...existing, ...input }, id);
  const updated: Owner = { ...existing, ...v };
  owners.set(id, updated);
  persist();
  return updated;
}

export function deleteOwner(id: string): void {
  if (!owners.has(id)) throw new Error('owner not found');
  owners.delete(id);
  persist();
}
