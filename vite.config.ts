import { defineConfig, type Connect, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import {
  startSimulation, ingest, getVehicles, getVehicle, getHistory,
} from './server/fleetStore';
import type { HistoryMetric } from './src/types/telemetry';

/**
 * Dev-only REST API plugin.
 * Exposes the fleet store over the same origin as the app, so the browser
 * talks to `/api/...` exactly as it will talk to the future FastAPI backend.
 *
 *   GET  /api/vehicles
 *   GET  /api/vehicles/:id
 *   GET  /api/vehicles/:id/history?metric=soc&range=1h
 *   POST /api/ingest          ← post CAN or GPS payloads here
 */
function fleetApiPlugin() {
  return {
    name: 'fleet-telemetry-api',
    configureServer(server: ViteDevServer) {
      startSimulation();

      const json = (res: Parameters<Connect.NextHandleFunction>[1], code: number, body: unknown) => {
        res.statusCode = code;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end(JSON.stringify(body));
      };

      server.middlewares.use('/api', (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const path = url.pathname; // already stripped of /api prefix by Vite

        if (req.method === 'OPTIONS') return json(res, 204, {});

        // POST /api/ingest
        if (req.method === 'POST' && path === '/ingest') {
          let raw = '';
          req.on('data', c => { raw += c; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(raw);
              if (!payload?.vehicleno || !payload?.type) {
                return json(res, 400, { error: 'vehicleno and type are required' });
              }
              const result = ingest(payload);
              json(res, 200, result);
            } catch {
              json(res, 400, { error: 'invalid JSON' });
            }
          });
          return;
        }

        if (req.method === 'GET') {
          // GET /api/vehicles
          if (path === '/vehicles') return json(res, 200, getVehicles());

          // GET /api/vehicles/:id  and  /api/vehicles/:id/history
          const m = path.match(/^\/vehicles\/([^/]+)(\/history)?$/);
          if (m) {
            const id = decodeURIComponent(m[1]);
            if (m[2]) {
              const metric = (url.searchParams.get('metric') ?? 'soc') as HistoryMetric;
              return json(res, 200, getHistory(id, metric));
            }
            const v = getVehicle(id);
            return v ? json(res, 200, v) : json(res, 404, { error: 'not found' });
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fleetApiPlugin()],
});
