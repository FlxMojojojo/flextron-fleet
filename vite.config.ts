import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi, bootServices } from './server/api';

/**
 * Dev-only REST API plugin. Delegates to the shared handler in server/api.ts
 * so dev and prod expose exactly the same routes (auth, users, vehicles, ingest).
 */
function fleetApiPlugin() {
  return {
    name: 'fleet-telemetry-api',
    configureServer(server: ViteDevServer) {
      bootServices();
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        handleApi(req, res, url.pathname, url.searchParams).catch(() => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'internal error' }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fleetApiPlugin()],
});
