import { useState } from 'react';
import s from './HistoryRange.module.css';

export interface TimeRange { from: number; to: number; }

/** Small date/time range bar: pick From/To → Apply, or return to Live. */
export function HistoryRange({ range, onChange }:
  { range: TimeRange | null; onChange: (r: TimeRange | null) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function apply() {
    if (!from || !to) return;
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    if (Number.isFinite(f) && Number.isFinite(t) && t > f) onChange({ from: f, to: t });
  }

  return (
    <div className={s.bar}>
      <label className={s.field}>
        <span>From</span>
        <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
      </label>
      <label className={s.field}>
        <span>To</span>
        <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
      </label>
      <button className={s.apply} onClick={apply} disabled={!from || !to}>Apply</button>
      {range && (
        <button className={s.live} onClick={() => onChange(null)}>
          <span className={s.liveDot} aria-hidden="true" /> Back to Live
        </button>
      )}
    </div>
  );
}
