/**
 * Fleet Telemetry API client.
 * Talks to real REST endpoints served by the Vite dev middleware
 * (see vite.config.ts). To point at the production FastAPI backend,
 * set VITE_API_BASE_URL in .env — no other change required.
 *
 *   GET  /api/vehicles
 *   GET  /api/vehicles/:id
 *   GET  /api/vehicles/:id/history?metric=soc&range=1h
 *   POST /api/ingest
 */

import type { VehicleState, HistoryMetric, TimeSeriesPoint } from '../types/telemetry';

export const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function getVehicles(): Promise<VehicleState[]> {
  return get<VehicleState[]>('/api/vehicles');
}

export function getVehicleLive(id: string): Promise<VehicleState> {
  return get<VehicleState>(`/api/vehicles/${encodeURIComponent(id)}`);
}

export function getVehicleHistory(
  id: string,
  metric: HistoryMetric,
  range: '10m' | '1h' | '6h' = '1h',
): Promise<TimeSeriesPoint[]> {
  return get<TimeSeriesPoint[]>(`/api/vehicles/${encodeURIComponent(id)}/history?metric=${metric}&range=${range}`);
}
