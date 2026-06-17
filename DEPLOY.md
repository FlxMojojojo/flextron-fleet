# Deploying to Hostinger VPS

The dashboard **and** the live ingest API run from one Node process
(`server/prod.ts`). Hostinger **shared/web hosting cannot run this** — you need a
**VPS**. The cheapest plan (KVM 1) is enough.

## 0. Buy the VPS

hPanel → VPS → choose **KVM 1** → OS template **Ubuntu 22.04** (plain) or the
**Ubuntu 24.04 with Node.js** template. Note the server IP and root password.

## 1. SSH in

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Install Node 20+ (skip if you picked the Node template)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
node -v   # should print v22.x
```

## 3. Get the code onto the box

**Option A — git (recommended):** push this project to GitHub, then:

```bash
cd /var/www
git clone https://github.com/YOU/flextron-fleet.git
cd flextron-fleet
```

**Option B — upload:** from your laptop:

```bash
scp -r ./flextron-fleet root@YOUR_SERVER_IP:/var/www/
```
(Exclude `node_modules` and `dist`; they're rebuilt on the server.)

## 4. Build

```bash
cd /var/www/flextron-fleet
npm install
npm run build        # produces dist/
```

## 5. Configure secrets

```bash
cp .env.example .env
nano .env          # set INGEST_TOKEN to a long random string (protects POST /api/ingest)
```

Generate a token: `openssl rand -hex 24`

## 6. Run it forever with pm2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs        # reads PORT/INGEST_TOKEN from the config/env
pm2 save
pm2 startup          # run the command it prints, so it survives reboots
```

The app is now live on `http://YOUR_SERVER_IP:8080`.
Health check: `curl http://YOUR_SERVER_IP:8080/api/health`

> State is snapshotted to `data/snapshot.json` every 30 s and on shutdown, so
> pm2 restarts and reboots keep ingested vehicles. Set `FLEET_DATA_DIR` to a
> persistent path if you prefer (e.g. `/var/lib/flextron`).

## 7. Put it on port 80/443 with a domain (nginx + free SSL)

Point your domain's **A record** to `YOUR_SERVER_IP` (in hPanel DNS or your
registrar). Then:

```bash
apt-get install -y nginx
```

Create `/etc/nginx/sites-available/flextron`:

```nginx
server {
    listen 80;
    server_name fleet.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it and add HTTPS:

```bash
ln -s /etc/nginx/sites-available/flextron /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d fleet.yourdomain.com    # auto-configures SSL
```

## 8. Tell partners where to POST

```
https://fleet.yourdomain.com/api/ingest
```

If you set `INGEST_TOKEN`, partners must send it on every POST:

```bash
curl -X POST https://fleet.yourdomain.com/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_INGEST_TOKEN" \
  -d '{ "vehicleno": "FLT12345", "type": "gps", "data": { "latitude": 12.92, "longitude": 77.65 } }'
```

CAN and GPS payload shapes are unchanged — see README.md.

## Updating later

```bash
cd /var/www/flextron-fleet
git pull            # or re-upload
npm install
npm run build
pm2 restart flextron
```

## Firewall note

If you can't reach the site, open the ports:

```bash
ufw allow 80
ufw allow 443
ufw allow 22
```

---

### Why not shared hosting?

Hostinger shared/web hosting serves static files + PHP only — no long-running
Node process, so `POST /api/ingest` can't work there. If you ever drop the live
API and only want the visual dashboard with its built-in simulation, you *could*
upload `dist/` to shared hosting — but then there's no real ingest endpoint.

### Memory note

State lives in memory (`server/fleetStore.ts`). A `pm2 restart` or reboot resets
to the 16 seeded bikes. When the real FastAPI backend with a database is ready,
point the frontend at it via `VITE_API_BASE_URL` and retire this server.
