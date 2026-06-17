/**
 * Map configuration.
 * If VITE_GOOGLE_MAPS_API_KEY is set, the app uses the real Google basemap.
 * Otherwise it falls back to keyless OpenStreetMap raster tiles (MapLibre),
 * so the dashboard always runs.
 *
 * To enable Google Maps:
 *   1. Create a key in Google Cloud Console (Maps JavaScript API enabled).
 *   2. Add to .env:  VITE_GOOGLE_MAPS_API_KEY=your_key
 *   3. (optional) VITE_GOOGLE_MAPS_MAP_ID=your_cloud_map_id  (for custom styling;
 *      defaults to Google's DEMO_MAP_ID which is fine for advanced markers).
 */
export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
export const GOOGLE_MAPS_MAP_ID: string = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID';
export const USE_GOOGLE_MAPS = GOOGLE_MAPS_API_KEY.length > 0;

// Bengaluru
export const FLEET_CENTER = { lat: 12.9716, lng: 77.5946 };
