import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiLogs, type ApiLogEntry } from '../../api/client';
import s from './LogsPage.module.css';

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function Entry({ e }: { e: ApiLogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${s.entry}${e.ok ? '' : ' ' + s.bad}`}>
      <div className={s.entryHead} onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={ev => { if (ev.key === 'Enter') setOpen(o => !o); }}>
        <span className={s.time}>{fmtTime(e.ts)}</span>
        <span className={s.method}>{e.method}</span>
        <span className={`${s.badge} ${e.ok ? s.badgeOk : s.badgeBad}`}>{e.status}</span>
        <span>
          {e.type && <span className={s.typeTag}>{e.type}</span>}{' '}
          <span className={s.veh}>{e.vehicleno ?? (e.error ?? '—')}</span>
        </span>
        <span className={s.ip}>{e.ip}</span>
      </div>
      {open && (
        <pre className={s.raw}>{JSON.stringify(e.body ?? { error: e.error }, null, 2)}</pre>
      )}
    </div>
  );
}

export function LogsPage() {
  const [paused, setPaused] = useState(false);
  const { data: logs = [] } = useQuery({
    queryKey: ['api-logs'],
    queryFn: () => getApiLogs(200),
    refetchInterval: paused ? false : 2000,
  });

  return (
    <div className={s.root}>
      <div className={s.head}>
        <h1 className={s.title}>API Logs</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!paused && <span className={s.live}><span className={s.dot} />LIVE</span>}
          <button className={s.pauseBtn} onClick={() => setPaused(p => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      <p className={s.subtitle}>
        Raw incoming <code>POST /api/ingest</code> requests (newest first). Click a row to expand the payload.
      </p>

      {logs.length === 0 ? (
        <div className={s.empty}>No API requests captured yet. Posts will appear here in real time.</div>
      ) : (
        <div className={s.list}>
          {logs.map(e => <Entry key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
}
