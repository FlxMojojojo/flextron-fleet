import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getVehicleLive, deleteVehicle } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { VehicleState } from '../../types/telemetry';
import { StatusChip } from '../shared/StatusChip';
import { SocRing } from './SocRing';
import { CellChart } from './CellChart';
import { TelemetryChart } from './TelemetryChart';
import { MiniMap } from './MiniMap';
import s from './BikeDetail.module.css';

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface Alert { id: string; title: string; desc: string; }

function getAlerts(v: VehicleState): Alert[] {
  const a: Alert[] = [];
  if (v.can.hv_critical_alert)          a.push({ id: 'hv',     title: 'HV Critical Alert',       desc: 'High-voltage system fault detected. Inspect immediately.' });
  if (v.can.battery_high_temp_telltale) a.push({ id: 'temp',   title: 'High Battery Temperature', desc: `Max temp ${Math.max(v.can.battery_temp_1, v.can.battery_temp_2).toFixed(1)}°C — exceeds safe threshold.` });
  if (v.cell_delta > 0.3)              a.push({ id: 'cell',   title: 'Cell Voltage Imbalance',   desc: `ΔV = ${v.cell_delta.toFixed(3)} V — consider balancing.` });
  if (v.cell_delta > 0.1 && v.cell_delta <= 0.3) a.push({ id: 'celllw', title: 'Cell Delta Warning', desc: `ΔV = ${v.cell_delta.toFixed(3)} V — monitor closely.` });
  return a;
}

export function BikeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: v } = useQuery({
    queryKey: ['vehicle-live', id],
    queryFn: () => getVehicleLive(id!),
    refetchInterval: 3000,
    enabled: !!id,
  });

  async function onDelete() {
    if (!id) return;
    if (!confirm(`Delete device ${id}? It will be removed from the dashboard. If the device posts again, it re-registers automatically.`)) return;
    try {
      await deleteVehicle(id);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      navigate('/');
    } catch (e) {
      alert(`Could not delete: ${(e as Error).message}`);
    }
  }

  if (!v) {
    return (
      <div className={s.root} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#6B7F9A' }}>Loading…</p>
      </div>
    );
  }

  const { can, gps } = v;
  const avgTemp = (can.battery_temp_1 + can.battery_temp_2 + can.battery_temp_3 + can.battery_temp_4) / 4;
  const alerts = getAlerts(v);

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <button className={s.backBtn} onClick={() => navigate('/')} aria-label="Back to fleet overview">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Fleet
        </button>
        <div className={s.headerInfo}>
          <div className={s.bikeNo}>{v.vehicleno}</div>
          <div className={s.lastUpdate}>
            {v.owner ? <>Owner: <strong>{v.owner.name}</strong> · {v.owner.vehicle_type} · </> : null}
            Last update {fmt(v.last_seen)}
          </div>
        </div>
        <StatusChip status={v.status} />
        {user?.role === 'admin' && (
          <button className={s.deleteBtn} onClick={onDelete} aria-label={`Delete device ${v.vehicleno}`}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 3.5h9M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete device
          </button>
        )}
      </div>

      {/* Owner card */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>Owner</h2>
        {v.owner ? (
          <div className={s.ownerGrid}>
            <div className={s.ownerRow}><span className={s.ownerKey}>Name</span><span className={s.ownerVal}>{v.owner.name}</span></div>
            <div className={s.ownerRow}><span className={s.ownerKey}>Mobile</span><span className={`${s.ownerVal} ${s.ownerMono}`}>{v.owner.mobile}</span></div>
            <div className={s.ownerRow}><span className={s.ownerKey}>Purchase Date</span><span className={`${s.ownerVal} ${s.ownerMono}`}>{v.owner.purchase_date}</span></div>
            <div className={s.ownerRow}><span className={s.ownerKey}>Vehicle Type</span><span className={s.ownerVal}>{v.owner.vehicle_type}</span></div>
          </div>
        ) : (
          <p className={s.ownerEmpty}>
            No owner mapped to this device.{' '}
            <button className={s.ownerLink} onClick={() => navigate('/owners')}>Map an owner →</button>
          </p>
        )}
      </section>

      {/* Instrument cluster */}
      <section className={s.cluster} aria-label="Instrument cluster">
        <div className={s.socRingWrap}>
          <SocRing soc={can.soc} />
          <div className={s.socLabel} aria-label={`State of health ${can.soh.toFixed(1)}%`}>
            SOH <span style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.8)' }}>{can.soh.toFixed(1)}%</span>
          </div>
        </div>

        <div className={s.gaugeGrid}>
          <div className={s.gauge}>
            <span className={`${s.gaugeValue} ${s.cyan}`}>{can.sum_voltage.toFixed(1)}<span className={s.gaugeUnit}> V</span></span>
            <span className={s.gaugeLabel}>Pack Voltage</span>
          </div>
          <div className={s.gauge}>
            <span className={`${s.gaugeValue}${v.cell_delta > 0.1 ? ' ' + s.warn : ''}`}>
              {v.cell_delta.toFixed(3)}<span className={s.gaugeUnit}> V</span>
            </span>
            <span className={s.gaugeLabel}>Cell Δ (max−min)</span>
          </div>
          <div className={s.gauge}>
            <span className={`${s.gaugeValue} ${s.cyan}`}>{can.max_v.toFixed(3)}<span className={s.gaugeUnit}> V</span></span>
            <span className={s.gaugeLabel}>Max Cell Voltage</span>
          </div>
          <div className={s.gauge}>
            <span className={`${s.gaugeValue}${v.cell_delta > 0.1 ? ' ' + s.warn : ''}`}>{can.min_v.toFixed(3)}<span className={s.gaugeUnit}> V</span></span>
            <span className={s.gaugeLabel}>Min Cell Voltage</span>
          </div>
          <div className={s.gauge}>
            <span className={s.gaugeValue}>{can.dte.toFixed(1)}<span className={s.gaugeUnit}> km</span></span>
            <span className={s.gaugeLabel}>Range (DTE)</span>
          </div>
          <div className={s.gauge}>
            <span className={s.gaugeValue}>{can.vehicle_speed.toFixed(1)}<span className={s.gaugeUnit}> km/h</span></span>
            <span className={s.gaugeLabel}>Speed</span>
          </div>
          <div className={s.gauge}>
            <span className={`${s.gaugeValue}${can.battery_high_temp_telltale ? ' ' + s.warn : ' ' + s.good}`}>
              {avgTemp.toFixed(1)}<span className={s.gaugeUnit}> °C</span>
            </span>
            <span className={s.gaugeLabel}>Pack Temp (avg)</span>
          </div>
          <div className={s.gauge}>
            <span className={s.gaugeValue}>
              {v.hours_since_charge == null ? '—' : v.hours_since_charge.toFixed(1)}
              <span className={s.gaugeUnit}> h</span>
            </span>
            <span className={s.gaugeLabel}>Since Last Charge</span>
          </div>
          <div className={s.gauge}>
            <span className={`${s.gaugeValue} ${s.good}`}>{v.gps_distance_km.toFixed(2)}<span className={s.gaugeUnit}> km</span></span>
            <span className={s.gaugeLabel}>Range Traveled (GPS)</span>
          </div>
          <div className={s.gauge}>
            <span className={s.gaugeLabel} style={{ marginTop: 0 }}>MOS Gates</span>
            <div className={s.mosPills}>
              <span className={`${s.mosPill} ${can.chg_mos ? s.mosOn : s.mosOff}`}>CHG</span>
              <span className={`${s.mosPill} ${can.dischg_mos ? s.mosOn : s.mosOff}`}>DCHG</span>
            </div>
          </div>
        </div>
      </section>

      {/* Temperature sensors */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>Temperature Sensors</h2>
        <div className={s.tempGrid}>
          {[can.battery_temp_1, can.battery_temp_2, can.battery_temp_3, can.battery_temp_4].map((t, i) => (
            <div key={i} className={s.tempCell}>
              <span className={`${s.tempVal}${t >= 50 ? ' ' + s.tempWarn : ''}`}>{t.toFixed(1)}<span className={s.tempUnit}>°C</span></span>
              <span className={s.tempLabel}>Sensor {i + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Cell voltage chart */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>
          Cell Voltages ({can.cell_voltages.length} cells)
          {v.cell_delta > 0.1 && <span className={s.outlierBadge}>⚠ Imbalance detected</span>}
        </h2>
        <CellChart cells={can.cell_voltages} cellDelta={v.cell_delta} />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: '#6B7F9A', marginTop: 'var(--sp-2)' }}>
          <span style={{ color: '#00A8E8' }}>■</span> Max cell &nbsp;
          <span style={{ color: v.cell_delta > 0.1 ? '#C2410C' : '#FACC15' }}>■</span> Min cell &nbsp;
          <span style={{ color: '#1E5BFF' }}>■</span> Other cells
        </p>
      </section>

      {/* Time-series */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>History</h2>
        <TelemetryChart vehicleId={v.vehicleno} />
      </section>

      {/* Location */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>Location</h2>
        <div className={s.locationGrid}>
          <div className={s.locationData}>
            <div className={s.locationRow}>
              <span className={s.locationKey}>Latitude</span>
              <span className={s.locationVal}>{gps.latitude.toFixed(6)}°</span>
            </div>
            <div className={s.locationRow}>
              <span className={s.locationKey}>Longitude</span>
              <span className={s.locationVal}>{gps.longitude.toFixed(6)}°</span>
            </div>
            <div className={s.locationRow}>
              <span className={s.locationKey}>Odometer</span>
              <span className={s.locationVal}>{can.odometer.toFixed(1)} km</span>
            </div>
            <div className={s.locationRow}>
              <span className={s.locationKey}>Distance Traveled (GPS)</span>
              <span className={s.locationVal}>{v.gps_distance_km.toFixed(2)} km</span>
            </div>
            <div className={s.locationRow}>
              <span className={s.locationKey}>Cycle Count</span>
              <span className={s.locationVal}>{can.cycle_count}</span>
            </div>
          </div>
          <MiniMap gps={gps} className={s.miniMap} />
        </div>
      </section>

      {/* Alerts */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>Active Alerts</h2>
        {alerts.length === 0 ? (
          <div className={s.noAlerts}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="#0E9F6E" strokeWidth="1.4"/>
              <path d="M4.5 7L6.5 9L9.5 5" stroke="#0E9F6E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            No active alerts
          </div>
        ) : (
          <ul aria-label="Active alerts">
            {alerts.map(a => (
              <li key={a.id} className={s.alertItem}>
                <div className={s.alertIcon} aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L11.5 10.5H0.5L6 1Z" stroke="#C2410C" strokeWidth="1.2" fill="none"/>
                    <path d="M6 4.5V7" stroke="#C2410C" strokeWidth="1.2" strokeLinecap="round"/>
                    <circle cx="6" cy="8.5" r="0.6" fill="#C2410C"/>
                  </svg>
                </div>
                <div className={s.alertText}>
                  <div className={s.alertTitle}>{a.title}</div>
                  <div className={s.alertDesc}>{a.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
