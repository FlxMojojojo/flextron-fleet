/**
 * Unified REST API handler used by BOTH the Vite dev middleware
 * (vite.config.ts) and the standalone prod server (server/prod.ts), so
 * routing + auth live in exactly one place.
 *
 * Public:   POST /api/auth/login, GET /api/health
 * User:     GET  /api/auth/me, GET /api/vehicles, /api/vehicles/:id[/history]
 * Admin:    GET/POST /api/users, DELETE /api/users/:id
 * Machine:  POST /api/ingest  (INGEST_TOKEN header or a valid user token)
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  startSimulation, ingest, getVehicles, getVehicle, getHistory,
} from './fleetStore';
import {
  initAuth, verifyCredentials, signToken, verifyToken, toPublic,
  listUsers, createUser, deleteUser, type User, type Role,
} from './auth';
import {
  initOwners, listOwners, createOwner, updateOwner, deleteOwner, getOwnerByVehicle,
} from './owners';
import type { HistoryMetric, VehicleState } from '../src/types/telemetry';

/** Attach the mapped owner (if any) to a vehicle state. */
function withOwner(v: VehicleState): VehicleState {
  return { ...v, owner: getOwnerByVehicle(v.vehicleno) };
}

const INGEST_TOKEN = process.env.INGEST_TOKEN ?? '';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

let booted = false;
export function bootServices() {
  if (booted) return;
  booted = true;
  startSimulation();
  initAuth();
  initOwners();
}

function cors() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  };
}

function sendJson(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...cors() });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

function bearer(req: IncomingMessage): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function currentUser(req: IncomingMessage): User | null {
  const token = bearer(req);
  return token ? verifyToken(token) : null;
}

/**
 * Handle an /api/* request. Returns true if it consumed the request.
 * `pathname` must include the /api prefix (e.g. "/api/vehicles").
 */
export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  search: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/')) return false;
  bootServices();

  const path = pathname.slice(4); // strip "/api"
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') { res.writeHead(204, cors()); res.end(); return true; }

  // ── Public ──
  if (path === '/health') {
    sendJson(res, 200, { ok: true, vehicles: getVehicles().length, uptime: process.uptime() });
    return true;
  }

  if (method === 'POST' && path === '/auth/login') {
    try {
      const body = await readBody(req) as { username?: string; password?: string };
      const user = verifyCredentials(body.username ?? '', body.password ?? '');
      if (!user) return sendJson(res, 401, { error: 'invalid username or password' }), true;
      sendJson(res, 200, { token: signToken(user), user: toPublic(user) });
    } catch {
      sendJson(res, 400, { error: 'invalid request' });
    }
    return true;
  }

  // ── Machine ingest (token or user) ──
  if (method === 'POST' && path === '/ingest') {
    const key = req.headers['x-api-key'];
    const okToken = INGEST_TOKEN && (bearer(req) === INGEST_TOKEN || key === INGEST_TOKEN);
    const okUser = !!currentUser(req);
    const okOpen = !INGEST_TOKEN; // open if no token configured (dev)
    if (!okToken && !okUser && !okOpen) return sendJson(res, 401, { error: 'unauthorized' }), true;
    try {
      const payload = await readBody(req) as { vehicleno?: string; type?: string };
      if (!payload?.vehicleno || !payload?.type) return sendJson(res, 400, { error: 'vehicleno and type are required' }), true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendJson(res, 200, ingest(payload as any));
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
    }
    return true;
  }

  // ── Everything below requires a logged-in user ──
  const user = currentUser(req);
  if (!user) { sendJson(res, 401, { error: 'authentication required' }); return true; }

  if (method === 'GET' && path === '/auth/me') { sendJson(res, 200, { user: toPublic(user) }); return true; }

  // ── Admin: user management ──
  if (path === '/users' || path.startsWith('/users/')) {
    if (user.role !== 'admin') { sendJson(res, 403, { error: 'admin only' }); return true; }

    if (method === 'GET' && path === '/users') { sendJson(res, 200, listUsers()); return true; }

    if (method === 'POST' && path === '/users') {
      try {
        const b = await readBody(req) as { username?: string; password?: string; role?: Role };
        const created = createUser(b.username ?? '', b.password ?? '', b.role === 'admin' ? 'admin' : 'user');
        sendJson(res, 201, created);
      } catch (e) {
        sendJson(res, 400, { error: (e as Error).message });
      }
      return true;
    }

    const del = path.match(/^\/users\/([^/]+)$/);
    if (method === 'DELETE' && del) {
      const id = decodeURIComponent(del[1]);
      if (id === user.id) { sendJson(res, 400, { error: 'you cannot delete your own account' }); return true; }
      try { deleteUser(id); sendJson(res, 200, { ok: true }); }
      catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
      return true;
    }
  }

  // ── Owners (any authenticated user) ──
  if (path === '/owners' || path.startsWith('/owners/')) {
    if (method === 'GET' && path === '/owners') { sendJson(res, 200, listOwners()); return true; }

    if (method === 'POST' && path === '/owners') {
      try { sendJson(res, 201, createOwner(await readBody(req) as object)); }
      catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
      return true;
    }

    const m = path.match(/^\/owners\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'PUT') {
        try { sendJson(res, 200, updateOwner(id, await readBody(req) as object)); }
        catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return true;
      }
      if (method === 'DELETE') {
        try { deleteOwner(id); sendJson(res, 200, { ok: true }); }
        catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return true;
      }
    }
  }

  // ── Telemetry reads (enriched with owner) ──
  if (method === 'GET') {
    if (path === '/vehicles') { sendJson(res, 200, getVehicles().map(withOwner)); return true; }
    const m = path.match(/^\/vehicles\/([^/]+)(\/history)?$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (m[2]) {
        const metric = (search.get('metric') ?? 'soc') as HistoryMetric;
        sendJson(res, 200, getHistory(id, metric));
        return true;
      }
      const v = getVehicle(id);
      sendJson(res, v ? 200 : 404, v ? withOwner(v) : { error: 'not found' });
      return true;
    }
  }

  sendJson(res, 404, { error: 'unknown endpoint' });
  return true;
}
