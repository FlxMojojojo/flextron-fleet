/**
 * In-memory ring buffer of recent ingest POSTs, exposed to admins via
 * GET /api/logs so the raw incoming payloads can be inspected from the
 * dashboard (no SSH needed). Holds the most recent MAX entries.
 */

export interface ApiLogEntry {
  id: number;
  ts: number;
  ip: string;
  method: string;
  path: string;
  type: string | null;       // "can" | "gps" | null
  vehicleno: string | null;
  status: number;            // HTTP status returned
  ok: boolean;
  error?: string;
  body: unknown;             // parsed request body (the raw payload)
}

const MAX = 300;
const buffer: ApiLogEntry[] = [];
let seq = 0;

export function logApi(entry: Omit<ApiLogEntry, 'id'>) {
  buffer.push({ id: ++seq, ...entry });
  if (buffer.length > MAX) buffer.shift();
}

/** Newest first. */
export function listApiLogs(limit = MAX): ApiLogEntry[] {
  return buffer.slice(-limit).reverse();
}
