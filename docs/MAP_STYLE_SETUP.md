# Flextron branded Google Map style

The dashboard uses Google's **Advanced Markers** (the Flextron icon + status
ring), which require a **Map ID**. Map styling for Map IDs is configured in the
Google Cloud Console (cloud-based styling), then referenced by ID in `.env`.

The brand style JSON lives in `docs/flextron-map-style.json` — a desaturated,
telemetry-blue basemap (light surfaces, muted roads, hidden POIs, brand-tinted
water and labels).

## One-time setup (~3 minutes)

1. **Create a map style**
   - Google Cloud Console → **Google Maps Platform → Map Styles** →
     **Create Map Style**.
   - Choose **"Import JSON"** (or create blank, then "Import JSON").
   - Paste the contents of `docs/flextron-map-style.json` → **Next** → name it
     `Flextron Telemetry` → **Save**.

2. **Create / attach a Map ID**
   - Google Maps Platform → **Map Management → Create Map ID**.
   - Type: **JavaScript**, then associate it with the **Flextron Telemetry**
     style you just created. (Map IDs of type JavaScript support Advanced
     Markers.)
   - Copy the **Map ID** (looks like `a1b2c3d4e5f6g7h8`).

3. **Point the app at it** — add to `.env`:
   ```
   VITE_GOOGLE_MAPS_MAP_ID=your_map_id_here
   ```

4. **Restart** `npm run dev` (and rebuild for production). The map now renders
   in the Flextron palette with the branded markers on top.

## Notes

- Cloud styling can take a few minutes to propagate after saving.
- The same Map ID works in dev and prod; set the env var in both.
- To tweak the look later, edit the style in the Cloud Console (no code change)
  — or edit `docs/flextron-map-style.json` and re-import.
- Without a Map ID set, the app uses Google's `DEMO_MAP_ID` (standard Google
  basemap) — still fully functional, just not brand-styled.
