import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlertLog, ackAlert, type AlertLogEntry } from '../../api/client';
import s from './AlertLogCard.module.css';

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AlertLogCard({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const { data: alerts = [] } = useQuery({
    queryKey: ['alert-log', vehicleId],
    queryFn: () => getAlertLog(vehicleId),
    refetchInterval: 5000,
  });

  const ackM = useMutation({
    mutationFn: (alertId: string) => ackAlert(vehicleId, alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-log', vehicleId] }),
  });

  const activeCount = alerts.filter((a: AlertLogEntry) => a.status === 'active').length;

  return (
    <section className={s.card}>
      <h2 className={s.title}>
        Alert Log
        {activeCount > 0 && <span className={s.activePill}>{activeCount} active</span>}
        <span className={s.total}>{alerts.length} total</span>
      </h2>

      {alerts.length === 0 ? (
        <div className={s.empty}>No alerts recorded for this device.</div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Alert</th><th>Severity</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} className={a.status === 'active' ? s.activeRow : s.ackRow}>
                  <td data-label="Alert" className={s.alertName}>{a.name}</td>
                  <td data-label="Severity">
                    <span className={`${s.sev} ${a.severity === 'CRITICAL' ? s.crit : s.warn}`}>{a.severity}</span>
                  </td>
                  <td data-label="Date" className={s.mono}>{fmtDate(a.raised_at)}</td>
                  <td data-label="Time" className={s.mono}>{fmtTime(a.raised_at)}</td>
                  <td data-label="Status">
                    {a.status === 'active'
                      ? <span className={s.statusActive}>Active</span>
                      : <span className={s.statusAck} title={`by ${a.acknowledged_by ?? ''}`}>Acknowledged</span>}
                  </td>
                  <td data-label="Action">
                    {a.status === 'active'
                      ? <button className={s.dismiss} onClick={() => ackM.mutate(a.id)} disabled={ackM.isPending}>Dismiss</button>
                      : <span className={s.ackBy}>{a.acknowledged_by ?? '—'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
