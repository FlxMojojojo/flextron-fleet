/**
 * OCV → SOC estimation for the IFP28148115A-52Ah LFP cell.
 *
 * Table transcribed from the manufacturer's OCV chart: cell voltage at each
 * SOC for 15/25/35 °C (measured) and 20/30/40 °C (interpolated). We linearly
 * interpolate across temperature, then invert voltage → SOC.
 *
 * Physics caveats encoded here:
 *  - OCV is only valid at REST (no charge/discharge for ~1 h) — the caller is
 *    responsible for rest detection; this module just maps V,T → SOC.
 *  - LFP is extremely flat between ~30–95 % SOC (a few mV per 5 %), so the
 *    estimate in that band is inherently coarse; plateaus in the table invert
 *    to the midpoint of the matching SOC span.
 */

const TEMPS = [15, 20, 25, 30, 35, 40]; // °C, column order below

// Rows: SOC % (descending) → cell voltage per temperature column.
const ROWS: { soc: number; v: number[] }[] = [
  { soc: 100, v: [3.352, 3.364, 3.375, 3.365, 3.354, 3.344] },
  { soc: 95,  v: [3.326, 3.328, 3.329, 3.330, 3.330, 3.3305] },
  { soc: 90,  v: [3.325, 3.327, 3.328, 3.329, 3.329, 3.33] },
  { soc: 85,  v: [3.325, 3.327, 3.328, 3.329, 3.329, 3.33] },
  { soc: 80,  v: [3.325, 3.327, 3.328, 3.329, 3.329, 3.33] },
  { soc: 75,  v: [3.325, 3.327, 3.328, 3.329, 3.329, 3.33] },
  { soc: 70,  v: [3.324, 3.326, 3.327, 3.328, 3.329, 3.3295] },
  { soc: 65,  v: [3.319, 3.322, 3.324, 3.325, 3.325, 3.326] },
  { soc: 60,  v: [3.302, 3.306, 3.310, 3.308, 3.306, 3.3035] },
  { soc: 55,  v: [3.290, 3.292, 3.294, 3.295, 3.295, 3.296] },
  { soc: 50,  v: [3.287, 3.289, 3.290, 3.292, 3.293, 3.2945] },
  { soc: 45,  v: [3.285, 3.287, 3.289, 3.291, 3.292, 3.2935] },
  { soc: 40,  v: [3.285, 3.287, 3.288, 3.290, 3.291, 3.2925] },
  { soc: 35,  v: [3.284, 3.286, 3.288, 3.289, 3.290, 3.2915] },
  { soc: 30,  v: [3.281, 3.283, 3.284, 3.282, 3.280, 3.2785] },
  { soc: 25,  v: [3.272, 3.272, 3.272, 3.270, 3.267, 3.264] },
  { soc: 20,  v: [3.256, 3.255, 3.253, 3.251, 3.248, 3.245] },
  { soc: 15,  v: [3.234, 3.232, 3.230, 3.227, 3.223, 3.220] },
  { soc: 10,  v: [3.213, 3.212, 3.210, 3.208, 3.205, 3.203] },
  { soc: 5,   v: [3.186, 3.183, 3.180, 3.165, 3.149, 3.133] },
  { soc: 0,   v: [3.024, 2.976, 2.928, 2.879, 2.830, 2.781] },
];

/** Voltage curve V(soc) at an arbitrary temperature (clamped to 15–40 °C). */
function curveAtTemp(tempC: number): { soc: number; v: number }[] {
  const t = Math.min(TEMPS[TEMPS.length - 1], Math.max(TEMPS[0], tempC));
  let i = 0;
  while (i < TEMPS.length - 2 && TEMPS[i + 1] < t) i++;
  const t0 = TEMPS[i], t1 = TEMPS[i + 1];
  const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  return ROWS.map(r => ({ soc: r.soc, v: r.v[i] + (r.v[i + 1] - r.v[i]) * f }));
}

/** Invert a rested cell voltage to SOC % at the given battery temperature. */
export function ocvToSoc(cellV: number, tempC: number): number {
  const curve = curveAtTemp(tempC); // soc descending, v (near-)descending
  if (cellV >= curve[0].v) return 100;
  if (cellV <= curve[curve.length - 1].v) return 0;

  // Exact plateau match (several SOC rows share this voltage) → midpoint.
  const eq = curve.filter(p => Math.abs(p.v - cellV) < 1e-6);
  if (eq.length >= 2) return (eq[0].soc + eq[eq.length - 1].soc) / 2;

  for (let i = 0; i < curve.length - 1; i++) {
    const hi = curve[i], lo = curve[i + 1];
    const vMax = Math.max(hi.v, lo.v), vMin = Math.min(hi.v, lo.v);
    if (cellV <= vMax && cellV >= vMin) {
      if (Math.abs(hi.v - lo.v) < 1e-6) {
        // Plateau: extend across all adjacent equal rows, return the midpoint.
        let j = i + 1;
        while (j < curve.length - 1 && Math.abs(curve[j + 1].v - hi.v) < 1e-6) j++;
        return (hi.soc + curve[j].soc) / 2;
      }
      const f = (cellV - lo.v) / (hi.v - lo.v);
      return parseFloat((lo.soc + (hi.soc - lo.soc) * f).toFixed(1));
    }
  }
  return 0;
}

/** Pack-level OCV SOC from the cell array (average of real, non-zero cells). */
export function packOcvSoc(cells: number[], tempC: number): { soc: number; avgCellV: number } | null {
  const real = cells.filter(v => v > 1);
  if (real.length === 0) return null;
  const avg = real.reduce((a, b) => a + b, 0) / real.length;
  return { soc: ocvToSoc(avg, tempC), avgCellV: parseFloat(avg.toFixed(4)) };
}
