/**
 * Reverse geocoding (lat/long → street address).
 *
 * Uses Google's Geocoding API when GOOGLE_MAPS_API_KEY is set (matches the
 * address you see on the Google map), otherwise falls back to keyless
 * OpenStreetMap Nominatim. Results are cached per ~11 m tile and lookups are
 * throttled to ≤1/sec to stay within usage limits.
 */

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

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

async function fetchAddress(lat: number, lng: number): Promise<string | undefined> {
  if (GOOGLE_KEY) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const json = await res.json() as { status?: string; results?: { formatted_address: string }[] };
    if (json.status === 'OK' && json.results?.length) return json.results[0].formatted_address;
    return undefined; // OVER_QUERY_LIMIT / REQUEST_DENIED → leave uncached, retry later
  }
  // Fallback: OpenStreetMap Nominatim (keyless)
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
  const res = await fetch(url, { headers: { 'User-Agent': 'FlextronFleet/1.0 (fleet telemetry dashboard)' } });
  const json = await res.json() as { display_name?: string };
  return json.display_name;
}

function schedule(k: string, lat: number, lng: number) {
  if (pending.has(k)) return;
  pending.add(k);
  const delay = Math.max(0, 1100 - (Date.now() - lastFetch));
  setTimeout(async () => {
    lastFetch = Date.now();
    try {
      const addr = await fetchAddress(lat, lng);
      if (addr) cache.set(k, addr);
    } catch {
      /* leave uncached; will retry on next poll */
    } finally {
      pending.delete(k);
    }
  }, delay);
}
