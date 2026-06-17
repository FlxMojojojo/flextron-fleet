/**
 * Standalone production server.
 * Serves the built dashboard (dist/) AND the telemetry REST API from one
 * Node process — this is what runs on the VPS. No Vite, no dev tooling.
 *
 *   GET  /api/health
 *   GET  /api/vehicles
 *   GET  /api/vehicles/:id
 *   GET  /api/vehicles/:id/history?metric=soc&range=1h
 *   POST /api/ingest                 (optionally protected by INGEST_TOKEN)
 *   *    → dist/index.html (SPA fallback)
 *
 * Env:
 *   PORT          listen port (default 8080)
 *   INGEST_TOKEN  if set, POST /api/ingest requires header
 *                 `Authorization: Bearer <token>` or `x-api-key: <token>`
 *   CORS_ORIGIN   allowed origin for the API (default *)
 *
 * Run:  PORT=8080 npx tsx server/prod.ts
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  startSimulation, ingest, getVehicles, getVehicle, getHistory, saveSnapshotNow,
} from './fleetStore';
import type { HistoryMetric } from '../src/types/telemetry';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT ?? 8080);
const INGEST_TOKEN = process.env.INGEST_TOKEN ?? '';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.map']);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  };
}

function sendJson(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(body));
}

function authorized(req: http.IncomingMessage): boolean {
  if (!INGEST_TOKEN) return true; // open if no token configured
  const auth = req.headers['authorization'];
  const key = req.headers['x-api-key'];
  return auth === `Bearer ${INGEST_TOKEN}` || key === INGEST_TOKEN;
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, urlPath: string) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(DIST, safe);
  let isFallback = false;
  try {
    const st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(DIST, 'index.html'); // SPA fallback
    isFallback = true;
  }
  try {
    const ext = extname(filePath);
    const data = await readFile(filePath);
    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
    };
    // Vite emits content-hashed asset filenames → safe to cache hard.
    if (!isFallback && /\/assets\//.test(filePath)) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }
    const accepts = (req.headers['accept-encoding'] ?? '').toString().includes('gzip');
    if (accepts && COMPRESSIBLE.has(ext)) {
      const gz = gzipSync(data);
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      res.end(gz);
    } else {
      res.writeHead(200, headers);
      res.end(data);
    }
  } catch {
    res.writeHead(404).end('Not found');
  }
}

startSimulation();

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    const api = path.slice(4);
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders()); return res.end(); }
    if (api === '/health') return sendJson(res, 200, { ok: true, vehicles: getVehicles().length, uptime: process.uptime() });

    if (req.method === 'POST' && api === '/ingest') {
      if (!authorized(req)) return sendJson(res, 401, { error: 'unauthorized' });
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const payload = JSON.parse(raw);
          if (!payload?.vehicleno || !payload?.type) {
            return sendJson(res, 400, { error: 'vehicleno and type are required' });
          }
          sendJson(res, 200, ingest(payload));
        } catch {
          sendJson(res, 400, { error: 'invalid JSON' });
        }
      });
      return;
    }

    if (req.method === 'GET') {
      if (api === '/vehicles') return sendJson(res, 200, getVehicles());
      const m = api.match(/^\/vehicles\/([^/]+)(\/history)?$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (m[2]) {
          const metric = (url.searchParams.get('metric') ?? 'soc') as HistoryMetric;
          return sendJson(res, 200, getHistory(id, metric));
        }
        const v = getVehicle(id);
        return v ? sendJson(res, 200, v) : sendJson(res, 404, { error: 'not found' });
      }
    }
    return sendJson(res, 404, { error: 'unknown endpoint' });
  }

  serveStatic(req, res, path);
});

server.listen(PORT, () => {
  console.log(`Flextron Fleet Telemetry running on http://0.0.0.0:${PORT}`);
  if (!INGEST_TOKEN) console.warn('[warn] INGEST_TOKEN not set — /api/ingest is open to the public.');
});

// Graceful shutdown — persist state before exit.
function shutdown(sig: string) {
  console.log(`\n${sig} received, saving snapshot and shutting down…`);
  saveSnapshotNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
