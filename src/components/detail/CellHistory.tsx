import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSnapshots } from '../../api/client';
import { CellChart } from './CellChart';
import { HistoryRange, type TimeRange } from './HistoryRange';
import s from './CellHistory.module.css';

/**
 * Cell voltages with historic scrubbing: live by default; pick a date/time
 * range and drag the slider to view the cell array at any recorded moment.
 */
export function CellHistory({ vehicleId, liveCells, liveDelta }:
  { vehicleId: string; liveCells: number[]; liveDelta: number }) {
  const [range, setRange] = useState<TimeRange | null>(null);
  const [idx, setIdx] = useState(0);

  const { data: snaps = [], isFetching } = useQuery({
    queryKey: ['snapshots', vehicleId, range?.from ?? 0, range?.to ?? 0],
    queryFn: () => getSnapshots(vehicleId, range!.from, range!.to),
    enabled: !!range,
  });

  const snap = range && snaps.length ? snaps[Math.min(idx, snaps.length - 1)] : null;
  const cells = snap ? snap.cell_voltages : liveCells;

  // Per-cell stats for the currently-shown sample: deviation + which cell is
  // weakest (min) and highest (max), so an outlier cell is easy to spot.
  const stats = (() => {
    const real = cells.map((v, i) => ({ v, i })).filter(c => c.v > 0);
    if (real.length === 0) return null;
    let mn = real[0], mx = real[0];
    for (const c of real) { if (c.v < mn.v) mn = c; if (c.v > mx.v) mx = c; }
    return {
      delta: parseFloat((mx.v - mn.v).toFixed(3)),
      minCell: mn.i + 1, minV: mn.v,
      maxCell: mx.i + 1, maxV: mx.v,
    };
  })();
  const delta = snap ? (stats?.delta ?? 0) : liveDelta;
  const cLabel = (n: number) => `C${String(n).padStart(2, '0')}`;

  return (
    <div>
      <HistoryRange range={range} onChange={r => { setRange(r); setIdx(0); }} />

      {range && (
        snaps.length === 0 ? (
          <p className={s.empty}>{isFetching ? 'Loading…' : 'No data recorded in the selected window.'}</p>
        ) : (
          <div className={s.scrub}>
            <input
              type="range"
              min={0}
              max={snaps.length - 1}
              value={Math.min(idx, snaps.length - 1)}
              onChange={e => setIdx(Number(e.target.value))}
              aria-label="Scrub through cell voltage history"
            />
            <div className={s.scrubMeta}>
              <span className={s.ts}>
                {snap ? new Date(snap.ts).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
              </span>
              <span className={s.snapInfo}>
                {snap ? `SOC ${snap.soc}% · ${snap.sum_voltage} V · sample ${Math.min(idx, snaps.length - 1) + 1}/${snaps.length}` : ''}
              </span>
            </div>
          </div>
        )
      )}

      {stats && (
        <div className={s.stats}>
          <span className={`${s.stat} ${stats.delta > 0.1 ? s.statWarn : ''}`}>
            Cell Δ <strong>{stats.delta.toFixed(3)} V</strong>
          </span>
          <span className={s.stat}>
            <span className={s.dotMin} aria-hidden="true" /> Weakest <strong>{cLabel(stats.minCell)}</strong> ({stats.minV.toFixed(3)} V)
          </span>
          <span className={s.stat}>
            <span className={s.dotMax} aria-hidden="true" /> Highest <strong>{cLabel(stats.maxCell)}</strong> ({stats.maxV.toFixed(3)} V)
          </span>
        </div>
      )}

      <CellChart cells={cells} cellDelta={delta} />
    </div>
  );
}
