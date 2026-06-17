/**
 * Fleet Telemetry + Auth API client.
 * Talks to the REST API served by both the Vite dev middleware and the
 * standalone prod server. Set VITE_API_BASE_URL to point at an external host.
 */

import type { VehicleState, HistoryMetric, TimeSeriesPoint } from '../types/telemetry';

export const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

const TOKEN_KEY = 'flextron_token';

export type Role = 'admin' | 'user';
export interface AuthUser { id: string; username: string; role: Role; createdAt: number; }

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Called when the API rejects our token (401). Wired up by AuthProvider. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError(401, 'authentication required');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  return body as T;
}

// ── Auth ──
export async function login(username: string, password: string): Promise<AuthUser> {
  const { token, user } = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(token);
  return user;
}
export function logout() { setToken(null); }
export async function getMe(): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>('/api/auth/me');
  return user;
}

// ── Admin: users ──
export function listUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>('/api/users');
}
export function createUser(username: string, password: string, role: Role): Promise<AuthUser> {
  return request<AuthUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
}
export function deleteUser(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Telemetry ──
export function getVehicles(): Promise<VehicleState[]> {
  return request<VehicleState[]>('/api/vehicles');
}
export function getVehicleLive(id: string): Promise<VehicleState> {
  return request<VehicleState>(`/api/vehicles/${encodeURIComponent(id)}`);
}
export function getVehicleHistory(
  id: string, metric: HistoryMetric, range: '10m' | '1h' | '6h' = '1h',
): Promise<TimeSeriesPoint[]> {
  return request<TimeSeriesPoint[]>(`/api/vehicles/${encodeURIComponent(id)}/history?metric=${metric}&range=${range}`);
}
