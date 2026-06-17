/**
 * Standalone production server.
 * Serves the built dashboard (dist/) AND the telemetry/auth REST API from one
 * Node process. API routing lives in server/api.ts (shared with dev).
 *
 * Env: PORT, INGEST_TOKEN, CORS_ORIGIN, AUTH_SECRET, FLEET_DATA_DIR,
 *      DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
 *
 * Run:  PORT=8080 npx tsx server/prod.ts
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { handleApi, bootServices } from './api';
import { saveSnapshotNow } from './fleetStore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT ?? 8080);

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
    const headers: http.OutgoingHttpHeaders = { 'Content-Type': MIME[ext] ?? 'application/octet-stream' };
    if (!isFallback && /\/assets\//.test(filePath)) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else headers['Cache-Control'] = 'no-cache';

    const accepts = (req.headers['accept-encoding'] ?? '').toString().includes('gzip');
    if (accepts && COMPRESSIBLE.has(ext)) {
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      res.end(gzipSync(data));
    } else {
      res.writeHead(200, headers);
      res.end(data);
    }
  } catch {
    res.writeHead(404).end('Not found');
  }
}

bootServices();

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname, url.searchParams).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal error' }));
    });
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Flextron Fleet Telemetry running on http://0.0.0.0:${PORT}`);
  if (!process.env.INGEST_TOKEN) console.warn('[warn] INGEST_TOKEN not set — /api/ingest is open.');
});

function shutdown(sig: string) {
  console.log(`\n${sig} received, saving snapshot and shutting down…`);
  saveSnapshotNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
