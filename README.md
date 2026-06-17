# Flextron Fleet Telemetry

Internal ops dashboard for monitoring a fleet of Flextron EV LoaderBike electric cargo bikes.
Streams battery (BMS/CAN) and GPS data in real time.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Login

The app requires authentication. On first boot a default **admin** is seeded:

| Username | Password |
|----------|----------|
| `admin`  | `flextron-admin` |

(Override via `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` before first run.)

- **Admins** see a **Users** tab to create/delete users and other admins.
- **Users** can view the fleet but not manage accounts.
- Accounts persist to `<FLEET_DATA_DIR>/users.json`; sessions are signed tokens
  (7-day expiry). Change the seeded admin password after first login by creating
  a new admin and deleting the default.

### Auth API
| Method | Endpoint | Access |
|--------|----------|--------|
| `POST` | `/api/auth/login` | public — `{username, password}` → `{token, user}` |
| `GET`  | `/api/auth/me` | any logged-in user |
| `GET`/`POST` | `/api/users` | admin only |
| `DELETE` | `/api/users/:id` | admin only |

All telemetry endpoints require `Authorization: Bearer <token>`.

## Architecture

```
src/
├── api/
│   ├── client.ts       # API surface (swap BASE_URL → FastAPI to go live)
│   └── mockData.ts     # 16 Bengaluru bikes, live-updating every 3 s
├── types/
│   └── telemetry.ts    # CanTelemetry, GpsTelemetry, VehicleState
├── tokens/
│   └── tokens.css      # ALL colors, fonts, spacing — edit here to rebrand
├── components/
│   ├── shell/          # AppShell, nav, connected indicator
│   ├── overview/       # FleetOverview, FleetMap (MapLibre)
│   ├── detail/         # BikeDetail, SocRing, CellChart, TelemetryChart, MiniMap
│   ├── alerts/         # AlertsPage
│   └── shared/         # StatusChip, SocBar
└── main.tsx            # Router + QueryClient setup
```

## Live ingest API

The dev server exposes a real REST API (served by a Vite middleware in
`vite.config.ts`, backed by `server/fleetStore.ts`). POST telemetry to it and
it shows up on the dashboard immediately — unknown `vehicleno`s are auto-added.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET`  | `/api/vehicles` | All vehicle states |
| `GET`  | `/api/vehicles/:id` | One vehicle (live) |
| `GET`  | `/api/vehicles/:id/history?metric=soc&range=1h` | Time series |
| `POST` | `/api/ingest` | Push a CAN or GPS payload |

**CAN payload** (partner wire format, with its exact key spellings):

```bash
curl -X POST http://localhost:5173/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleno": "FLT12345",
    "type": "can",
    "can": {
      "vehicle_speed": 45, "charging_status": 0, "odometer": 25,
      "fast_charge_indicator": 1, "dte": 200, "soc": 50,
      "battery_high_temp_telltale": 0, "battery_temp": 51,
      "battery_temp 2": 50, "battery_temp 3": 50, "battery_temp 4": 50,
      "SumVoltage": 49.2, "DisChgMOS": "ON", "ChgMOS": "ON",
      "RemainCap": 25.4, "MaxV": 3.33, "MinV": 3.21,
      "Discharge Current": 25, "hv_critical_alert": 0
    }
  }'
```

**GPS payload** (distance traveled is accumulated from these points via haversine):

```bash
curl -X POST http://localhost:5173/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"vehicleno":"FLT12345","type":"gps","data":{"latitude":12.9204702,"longitude":77.6508026}}'
```

The store maps the wire keys (`MaxV`, `battery_temp 2`, `DisChgMOS: "ON"`, …)
onto the normalized `CanTelemetry` type the UI binds to.

## Swapping to the real backend

The browser already talks to `/api/...`, so going live is a base-URL swap:

1. Set `VITE_API_BASE_URL=https://your-api.example.com` in `.env`.
2. Point your FastAPI service at the same four routes above.
3. The Vite dev middleware (`server/fleetStore.ts`) is dev-only and simply
   stops being used — delete it whenever you like.

## Derived metrics

- **Cell delta / max / min voltage** — straight from `MaxV` / `MinV`.
- **Hours since last charge** — time since `charging_status` was last `1`.
- **Range traveled (GPS)** — haversine sum of consecutive GPS fixes, GPS-only
  (independent of the odometer field).

## Map tiles

Currently uses OpenStreetMap raster tiles (keyless).
**Production:** switch to MapTiler vector tiles or Protomaps (self-hostable).
See the comment in `src/components/overview/FleetMap.tsx`.

## Rebranding to LoaderBike

Edit `src/tokens/tokens.css`:
- `--c-blue` → `#E2CA1A` (gold)
- `--c-ink`  → `#040205` (near-black)
- Adjust `--c-navy`, `--c-cyan`, and surface colors to match.

## Tech stack

| Library | Purpose |
|---------|---------|
| React + Vite + TypeScript | App framework |
| MapLibre GL JS | Map rendering |
| Recharts | Time-series & cell voltage charts |
| TanStack Query | Data fetching + polling |
| CSS Modules | Scoped component styles |
