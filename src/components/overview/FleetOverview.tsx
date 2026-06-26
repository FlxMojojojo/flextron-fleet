import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getVehicles } from '../../api/client';
import { StatusChip } from '../shared/StatusChip';
import { SocBar } from '../shared/SocBar';
import { FleetMap } from './FleetMap';
import type { VehicleState } from '../../types/telemetry';
import s from './FleetOverview.module.css';

function lastUpdate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function FleetOverview() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: vehicles = [] } = useQuery<VehicleState[]>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 3000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter(v =>
      v.vehicleno.toLowerCase().includes(q) ||
      v.owner?.name.toLowerCase().includes(q) ||
      v.owner?.mobile.includes(q),
    );
  }, [vehicles, search]);

  const counts = useMemo(() => ({
    total:    vehicles.length,
    online:   vehicles.filter(v => v.status !== 'offline').length,
    charging: vehicles.filter(v => v.status === 'charging').length,
    alerts:   vehicles.filter(v => v.status === 'alert').length,
  }), [vehicles]);

  function openBike(id: string) {
    setSelected(id);
    navigate(`/bike/${id}`);
  }

  return (
    <div className={s.root}>
      {/* Summary strip */}
      <div className={s.strip} aria-label="Fleet summary">
        <div className={s.stat}>
          <span className={s.statValue}>{counts.total}</span>
          <span className={s.statLabel}>Total</span>
        </div>
        <div className={s.stat}>
          <span className={`${s.statValue} ${s.good}`}>{counts.online}</span>
          <span className={s.statLabel}>Online</span>
        </div>
        <div className={s.stat}>
          <span className={`${s.statValue} ${s.blue}`}>{counts.charging}</span>
          <span className={s.statLabel}>Charging</span>
        </div>
        <div className={s.stat}>
          <span className={`${s.statValue} ${counts.alerts > 0 ? s.alert : ''}`}>{counts.alerts}</span>
          <span className={s.statLabel}>Alerts</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={s.sidebar} aria-label="Bike list">
        <div className={s.sidebarHead}>
          <div className={s.searchWrap}>
            <svg className={s.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              className={s.searchInput}
              type="search"
              placeholder="Search bike no, owner, mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search bikes by number"
            />
          </div>
        </div>

        <ul className={s.bikeList} role="list">
          {filtered.map(v => (
            <li key={v.vehicleno} role="listitem">
              <button
                className={`${s.bikeRow}${selected === v.vehicleno ? ' ' + s.selected : ''}`}
                onClick={() => openBike(v.vehicleno)}
                aria-current={selected === v.vehicleno ? 'true' : undefined}
                aria-label={`${v.vehicleno}, ${v.status}, SOC ${v.can.soc.toFixed(0)}%`}
              >
                <div className={s.bikeRowTop}>
                  <span className={s.bikeNo}>{v.vehicleno}</span>
                  <StatusChip status={v.status} />
                </div>
                <SocBar soc={v.can.soc} />
                <span className={s.lastSeen}>
                  {v.owner ? `${v.owner.name} · ${v.owner.vehicle_type} · ` : ''}{lastUpdate(v.last_seen)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Map */}
      <div className={s.mapWrap}>
        <FleetMap vehicles={vehicles} selectedId={selected} onSelect={openBike} />
      </div>
    </div>
  );
}
