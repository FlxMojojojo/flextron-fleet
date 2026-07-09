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
  const delta = snap
    ? (() => { const real = snap.cell_voltages.filter(x => x > 0); return real.length ? parseFloat((Math.max(...real) - Math.min(...real)).toFixed(3)) : 0; })()
    : liveDelta;

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

      <CellChart cells={cells} cellDelta={delta} />
    </div>
  );
}
