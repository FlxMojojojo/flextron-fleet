# Flextron Fleet Telemetry — IoT Device API

**For the embedded team.** This is the exact contract your device must POST so
the data shows up live on the dashboard at **https://track.ft.energy**.

There are two message types per vehicle: **`can`** (battery/BMS) and **`gps`**.
Send them as **separate POST requests**. Both go to the same endpoint.

---

## 1. Endpoint

```
POST https://track.ft.energy/api/ingest
Content-Type: application/json
Authorization: Bearer <INGEST_TOKEN>
```

- `INGEST_TOKEN` is a shared secret (ask your admin; it lives in the server's
  `.env`). Send it on **every** request, either as
  `Authorization: Bearer <token>` **or** as header `x-api-key: <token>`.
- `vehicleno` identifies the device. **An unknown `vehicleno` is auto-created** —
  the first POST makes the vehicle appear on the dashboard. Use a stable ID per
  device (e.g. the VIN or device serial). Examples here use `FLX-001`.
- The server stamps each record with its **receive time**, so you do **not** need
  to send a timestamp.

**Success response:** `200 OK`
```json
{ "ok": true, "vehicleno": "FLX-001" }
```

**Error responses:**
| Code | Meaning |
|------|---------|
| `400` | Missing `vehicleno`/`type`, or malformed JSON |
| `401` | Missing/invalid token |

---

## 2. CAN (battery) payload

Send this on your battery telemetry interval (recommended **every 5–10 s**).

```json
{
  "vehicleno": "FLX-001",
  "type": "can",
  "can": {
    "soc": 50,
    "soh": 98,
    "cycle_count": 142,
    "sum_voltage": 49.2,
    "max_v": 3.33,
    "min_v": 3.21,
    "cell_voltages": [
      3.30, 3.31, 3.29, 3.32, 3.28, 3.33, 3.30, 3.31, 3.27, 3.32,
      3.29, 3.30, 3.31, 3.28, 3.33, 3.21, 3.30, 3.29, 3.31, 3.30
    ],
    "discharge_current": 25,
    "charging_status": 0,
    "chg_mos": true,
    "dischg_mos": true,
    "remain_cap": 25.4,
    "dte": 200,
    "odometer": 25,
    "vehicle_speed": 45,
    "fast_charge_indicator": false,
    "battery_temp_1": 51,
    "battery_temp_2": 50,
    "battery_temp_3": 50,
    "battery_temp_4": 50,
    "battery_high_temp_telltale": false,
    "hv_critical_alert": false
  }
}
```

### Field reference

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `soc` | number | % | State of charge, 0–100 |
| `soh` | number | % | State of health, 0–100 |
| `cycle_count` | integer | — | Charge cycles |
| `sum_voltage` | number | V | Pack voltage. If omitted, computed from `cell_voltages` |
| `max_v` | number | V | Highest cell voltage. If omitted, derived from `cell_voltages` |
| `min_v` | number | V | Lowest cell voltage. If omitted, derived from `cell_voltages` |
| **`cell_voltages`** | **number[]** | **V** | **Per-cell voltages. Send all cells: 20 for 20S, 24 for 24S. Any length is accepted.** |
| `discharge_current` | number | A | Negative = charging, positive = discharging |
| `charging_status` | integer | — | `0` = not charging, `1` = charging |
| `chg_mos` | boolean | — | Charge MOSFET gate state |
| `dischg_mos` | boolean | — | Discharge MOSFET gate state |
| `remain_cap` | number | Ah | Remaining capacity |
| `dte` | number | km | Distance-to-empty (range) |
| `odometer` | number | km | Lifetime distance |
| `vehicle_speed` | number | km/h | Current speed |
| `fast_charge_indicator` | boolean | — | Fast charging active |
| `battery_temp_1..4` | number | °C | Four pack temperature sensors |
| `battery_high_temp_telltale` | boolean | — | High-temp warning latch |
| `hv_critical_alert` | boolean | — | High-voltage critical fault |

### Pack size (20S / 24S)

Just send the full `cell_voltages` array — **20 values for a 20S pack, 24 for a
24S pack**. The dashboard renders one bar per cell automatically and highlights
the min/max cells. You do not need to tell us the pack size separately.

If your firmware can't yet send the array, you may send only `max_v`/`min_v` and
the dashboard will approximate the cells — but **sending the real array is
strongly preferred** for accurate per-cell display and imbalance detection.

### Booleans are flexible

`chg_mos`, `dischg_mos`, the telltales, etc. accept any of:
`true`/`false`, `1`/`0`, or `"ON"`/`"OFF"`. Prefer real JSON booleans.

---

## 3. GPS payload

Send on your location interval (recommended **every 5–15 s**). Distance traveled
is accumulated on the server from successive GPS points, so send regularly.

```json
{
  "vehicleno": "FLX-001",
  "type": "gps",
  "data": {
    "latitude": 12.9204702,
    "longitude": 77.6508026
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `latitude` | number | Decimal degrees, WGS84 |
| `longitude` | number | Decimal degrees, WGS84 |

> Use the **same `vehicleno`** in both the CAN and GPS messages for a device, so
> battery and location map to one vehicle.

---

## 4. How the dashboard derives status

Each vehicle's status chip is computed from your data — you don't send it:

| Status | Condition |
|--------|-----------|
| **alert** | `hv_critical_alert` true, **or** `battery_high_temp_telltale` true, **or** `max_v − min_v > 0.30 V` (cell imbalance) |
| **charging** | `charging_status == 1` |
| **offline** | no message received for **60 s** (configurable) |
| **ok** | none of the above |

Derived metrics shown on the detail page:
- **Cell Δ** = `max_v − min_v` (flags imbalance)
- **Hours since last charge** = time since `charging_status` was last `1`
- **Range traveled (GPS)** = haversine sum of GPS points (independent of odometer)

---

## 5. Copy-paste test (works today)

Replace `<INGEST_TOKEN>` with the real token.

**20S pack:**
```bash
curl -X POST https://track.ft.energy/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INGEST_TOKEN>" \
  -d '{
    "vehicleno": "FLX-TEST-20S",
    "type": "can",
    "can": {
      "soc": 72, "soh": 97, "cycle_count": 88,
      "max_v": 3.34, "min_v": 3.28, "sum_voltage": 66.2,
      "cell_voltages": [3.30,3.31,3.29,3.32,3.28,3.33,3.30,3.31,3.28,3.32,3.29,3.30,3.31,3.29,3.33,3.28,3.30,3.29,3.31,3.34],
      "discharge_current": 18, "charging_status": 0,
      "chg_mos": true, "dischg_mos": true, "remain_cap": 21.5,
      "dte": 95, "odometer": 1240, "vehicle_speed": 22,
      "fast_charge_indicator": false,
      "battery_temp_1": 31, "battery_temp_2": 32, "battery_temp_3": 30, "battery_temp_4": 31,
      "battery_high_temp_telltale": false, "hv_critical_alert": false
    }
  }'
```

**24S pack (24 cells):**
```bash
curl -X POST https://track.ft.energy/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INGEST_TOKEN>" \
  -d '{
    "vehicleno": "FLX-TEST-24S",
    "type": "can",
    "can": {
      "soc": 64, "soh": 96,
      "cell_voltages": [3.31,3.30,3.32,3.29,3.33,3.30,3.31,3.28,3.32,3.30,3.31,3.29,3.33,3.30,3.31,3.28,3.32,3.30,3.31,3.29,3.33,3.30,3.31,3.34],
      "discharge_current": 12, "charging_status": 1,
      "chg_mos": true, "dischg_mos": false,
      "dte": 130, "odometer": 540, "vehicle_speed": 0,
      "battery_temp_1": 29, "battery_temp_2": 30, "battery_temp_3": 29, "battery_temp_4": 28,
      "battery_high_temp_telltale": false, "hv_critical_alert": false
    }
  }'
```

**GPS:**
```bash
curl -X POST https://track.ft.energy/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INGEST_TOKEN>" \
  -d '{"vehicleno":"FLX-TEST-20S","type":"gps","data":{"latitude":12.9716,"longitude":77.5946}}'
```

After posting, open **https://track.ft.energy** → the vehicle appears on the map
and in the list; click it to see the per-cell chart, instrument cluster, and
live charts.

---

## 6. Recommended device behavior

- **Cadence:** CAN every 5–10 s, GPS every 5–15 s. Don't exceed ~1 msg/sec/device.
- **Retry:** on network failure, retry with backoff; the endpoint is idempotent
  (latest message wins).
- **Time:** no client timestamp needed — the server stamps receive time.
- **TLS:** always POST over `https://` (HTTP is redirected).
- **IDs:** keep `vehicleno` stable per device for its lifetime.

Questions or a field you need added? Ping the dashboard team — we can roll an
update quickly.
