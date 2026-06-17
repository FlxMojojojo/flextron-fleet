import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getVehicles } from '../../api/client';
import type { VehicleState } from '../../types/telemetry';
import s from './AlertsPage.module.css';

interface AlertRow {
  vehicleno: string;
  type: string;
  detail: string;
  ts: number;
  severity: 'critical' | 'warning';
}

function extractAlerts(vehicles: VehicleState[]): AlertRow[] {
  const rows: AlertRow[] = [];
  for (const v of vehicles) {
    const { can, vehicleno, last_seen } = v;
    if (can.hv_critical_alert) {
      rows.push({ vehicleno, type: 'HV Critical Alert', detail: 'High-voltage system fault', ts: last_seen, severity: 'critical' });
    }
    if (can.battery_high_temp_telltale) {
      const t = Math.max(can.battery_temp_1, can.battery_temp_2, can.battery_temp_3, can.battery_temp_4);
      rows.push({ vehicleno, type: 'High Temperature', detail: `Peak ${t.toFixed(1)}°C`, ts: last_seen, severity: 'critical' });
    }
    if (v.cell_delta > 0.3) {
      rows.push({ vehicleno, type: 'Cell Imbalance', detail: `ΔV = ${v.cell_delta.toFixed(3)} V`, ts: last_seen, severity: 'critical' });
    } else if (v.cell_delta > 0.1) {
      rows.push({ vehicleno, type: 'Cell Delta Warning', detail: `ΔV = ${v.cell_delta.toFixed(3)} V`, ts: last_seen, severity: 'warning' });
    }
  }
  return rows.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AlertsPage() {
  const navigate = useNavigate();
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 3000,
  });

  const alerts = extractAlerts(vehicles);

  return (
    <div className={s.root}>
      <h1 className={s.title}>Fleet Alerts</h1>

      {alerts.length === 0 ? (
        <div className={s.empty}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="#0E9F6E" strokeWidth="1.4"/>
            <path d="M5 8L7 10L11 6" stroke="#0E9F6E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          No active alerts — all bikes nominal.
        </div>
      ) : (
        <table className={s.table} aria-label="Active fleet alerts">
          <thead>
            <tr>
              <th scope="col">Bike</th>
              <th scope="col">Alert Type</th>
              <th scope="col">Detail</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i}>
                <td>
                  <button
                    className={s.bikeLink}
                    onClick={() => navigate(`/bike/${a.vehicleno}`)}
                    aria-label={`Go to ${a.vehicleno} detail`}
                  >
                    {a.vehicleno}
                  </button>
                </td>
                <td>
                  <span className={s.alertBadge}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M5 1L9.5 9H0.5L5 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    </svg>
                    {a.type}
                  </span>
                </td>
                <td>{a.detail}</td>
                <td><span className={s.ts}>{fmt(a.ts)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
