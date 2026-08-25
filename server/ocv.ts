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

// Measured columns from the datasheet, Appendix A.4 "SOC-OCV table"
// (Guoxuan Q/GX 030-2019, listed by DOD; SOC = 100 − DOD). Seven measured
// temperatures — no extrapolated columns.
const TEMPS = [-10, 0, 10, 15, 25, 35, 45]; // °C, column order below

// Rows: SOC % (descending) → cell voltage per temperature column.
const ROWS: { soc: number; v: number[] }[] = [
  { soc: 100, v: [3.361, 3.335, 3.340, 3.352, 3.375, 3.354, 3.334] },
  { soc: 95,  v: [3.320, 3.319, 3.325, 3.326, 3.329, 3.330, 3.331] },
  { soc: 90,  v: [3.309, 3.318, 3.324, 3.325, 3.328, 3.329, 3.331] },
  { soc: 85,  v: [3.309, 3.318, 3.324, 3.325, 3.328, 3.329, 3.331] },
  { soc: 80,  v: [3.309, 3.318, 3.324, 3.325, 3.328, 3.329, 3.331] },
  { soc: 75,  v: [3.309, 3.318, 3.324, 3.325, 3.328, 3.329, 3.331] },
  { soc: 70,  v: [3.304, 3.314, 3.323, 3.324, 3.327, 3.329, 3.330] },
  { soc: 65,  v: [3.293, 3.304, 3.316, 3.319, 3.324, 3.325, 3.327] },
  { soc: 60,  v: [3.292, 3.293, 3.298, 3.302, 3.310, 3.306, 3.301] },
  { soc: 55,  v: [3.285, 3.285, 3.288, 3.290, 3.294, 3.295, 3.297] },
  { soc: 50,  v: [3.280, 3.282, 3.285, 3.287, 3.290, 3.293, 3.296] },
  { soc: 45,  v: [3.277, 3.280, 3.284, 3.285, 3.289, 3.292, 3.295] },
  { soc: 40,  v: [3.276, 3.279, 3.283, 3.285, 3.288, 3.291, 3.294] },
  { soc: 35,  v: [3.274, 3.279, 3.282, 3.284, 3.288, 3.290, 3.293] },
  { soc: 30,  v: [3.273, 3.277, 3.280, 3.281, 3.284, 3.280, 3.277] },
  { soc: 25,  v: [3.272, 3.273, 3.272, 3.272, 3.272, 3.267, 3.261] },
  { soc: 20,  v: [3.270, 3.264, 3.258, 3.256, 3.253, 3.248, 3.242] },
  { soc: 15,  v: [3.266, 3.250, 3.236, 3.234, 3.230, 3.223, 3.217] },
  { soc: 10,  v: [3.259, 3.230, 3.215, 3.213, 3.210, 3.205, 3.201] },
  { soc: 5,   v: [3.246, 3.209, 3.188, 3.186, 3.180, 3.149, 3.117] },
  { soc: 0,   v: [3.227, 3.175, 3.072, 3.024, 2.928, 2.830, 2.732] },
];

/** Voltage curve V(soc) at an arbitrary temperature (clamped to −10…45 °C). */
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
