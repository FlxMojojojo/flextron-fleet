/**
 * Reverse geocoding (lat/long → street address).
 *
 * Uses OpenStreetMap Nominatim (keyless, free). Results are cached per ~11 m
 * tile and lookups are throttled to ≤1/sec to respect Nominatim's usage policy.
 *
 * To switch to Google's geocoder instead (for Google-formatted addresses),
 * enable the "Geocoding API" on your key and point fetchAddress() at:
 *   https://maps.googleapis.com/maps/api/geocode/json?latlng=<lat>,<lng>&key=<KEY>
 */

const cache = new Map<string, string>();
const pending = new Set<string>();
let lastFetch = 0;

function key(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Returns the cached address for a location, or undefined if not resolved yet
 * (a background lookup is scheduled). Poll again shortly to get the result.
 */
export function reverseGeocode(lat: number, lng: number): string | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return undefined;
  const k = key(lat, lng);
  const cached = cache.get(k);
  if (cached) return cached;
  schedule(k, lat, lng);
  return undefined;
}

function schedule(k: string, lat: number, lng: number) {
  if (pending.has(k)) return;
  pending.add(k);
  const delay = Math.max(0, 1100 - (Date.now() - lastFetch));
  setTimeout(async () => {
    lastFetch = Date.now();
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
      const res = await fetch(url, { headers: { 'User-Agent': 'FlextronFleet/1.0 (fleet telemetry dashboard)' } });
      const json = await res.json() as { display_name?: string };
      if (json.display_name) cache.set(k, json.display_name);
    } catch {
      /* leave uncached; will retry on next poll */
    } finally {
      pending.delete(k);
    }
  }, delay);
}
