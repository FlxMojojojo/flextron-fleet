import { useState, useRef, useEffect } from 'react';
import { downloadCsv, type CsvRange } from '../../api/client';
import s from './ExportButton.module.css';

const RANGES: { key: CsvRange; label: string }[] = [
  { key: '24h', label: 'Last 24 Hours' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'all', label: 'All Data' },
  { key: 'custom', label: 'Custom Range…' },
];

export function ExportButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCustom(false); } }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function run(range: CsvRange) {
    if (range === 'custom') { setCustom(true); return; }
    setBusy(true);
    try { await downloadCsv(vehicleId, range); setOpen(false); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  async function runCustom() {
    if (!from || !to) return;
    setBusy(true);
    try {
      await downloadCsv(vehicleId, 'custom', new Date(from).getTime(), new Date(to).getTime() + 86_400_000);
      setOpen(false); setCustom(false);
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className={s.wrap} ref={ref}>
      <button className={s.btn} onClick={() => setOpen(o => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1.5V9M7 9L4 6M7 9l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {busy ? 'Exporting…' : 'Export CSV'}
      </button>
      {open && (
        <div className={s.menu} role="menu">
          {!custom ? RANGES.map(r => (
            <button key={r.key} className={s.item} role="menuitem" onClick={() => run(r.key)}>{r.label}</button>
          )) : (
            <div className={s.customBox}>
              <label className={s.cLabel}>From<input type="date" className={s.cInput} value={from} onChange={e => setFrom(e.target.value)} /></label>
              <label className={s.cLabel}>To<input type="date" className={s.cInput} value={to} onChange={e => setTo(e.target.value)} /></label>
              <button className={s.cGo} onClick={runCustom} disabled={!from || !to || busy}>Download</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
