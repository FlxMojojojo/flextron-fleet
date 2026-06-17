// pm2 process config — start with: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'flextron',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 8080,
        // INGEST_TOKEN: 'set-a-long-random-secret-here',
        // CORS_ORIGIN: 'https://fleet.yourdomain.com',
        // FLEET_DATA_DIR: '/var/lib/flextron',
      },
      max_memory_restart: '300M',
      autorestart: true,
    },
  ],
};
