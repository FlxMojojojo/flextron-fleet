import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getVehicleHistory } from '../../api/client';
import type { HistoryMetric } from '../../types/telemetry';
import s from './BikeDetail.module.css';

const METRICS: { key: HistoryMetric; label: string; unit: string; color: string }[] = [
  { key: 'soc',              label: 'SOC',        unit: '%',  color: '#1E5BFF' },
  { key: 'sum_voltage',      label: 'Voltage',    unit: 'V',  color: '#00A8E8' },
  { key: 'battery_temp_1',   label: 'Temp',       unit: '°C', color: '#C2410C' },
  { key: 'discharge_current',label: 'Current',    unit: 'A',  color: '#0E9F6E' },
];

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TelemetryChart({ vehicleId, cellCount = 20 }: { vehicleId: string; cellCount?: number }) {
  const [active, setActive] = useState<HistoryMetric>('soc');
  const meta = METRICS.find(m => m.key === active)!;

  const { data = [] } = useQuery({
    queryKey: ['history', vehicleId, active],
    queryFn: () => getVehicleHistory(vehicleId, active, '1h'),
    refetchInterval: 3000,
  });

  const points = data.slice(-40);

  // Pack voltage axis is bounded to the real operating range per pack type:
  //   20S → 40–74 V, 24S → 48–88 V. Other metrics auto-scale.
  const is24S = cellCount >= 24;
  const yDomain: [number | 'auto', number | 'auto'] =
    active === 'sum_voltage' ? (is24S ? [48, 88] : [40, 74]) : ['auto', 'auto'];
  const yTicks = active === 'sum_voltage'
    ? (is24S ? [48, 58, 68, 78, 88] : [40, 48, 56, 64, 74])
    : undefined;

  return (
    <div>
      <div className={s.tabBar} role="tablist" aria-label="Telemetry metric">
        {METRICS.map(m => (
          <button
            key={m.key}
            role="tab"
            aria-selected={m.key === active}
            className={`${s.tab}${m.key === active ? ' ' + s.active : ''}`}
            onClick={() => setActive(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 2" stroke="#EAF2FF" />
          <XAxis
            dataKey="ts"
            tickFormatter={fmt}
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#6B7F9A' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            allowDataOverflow
            tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#6B7F9A' }}
            tickFormatter={v => `${v}${meta.unit}`}
            width={48}
          />
          <Tooltip
            contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, borderRadius: 6, border: '1px solid #D4E2F7' }}
            labelFormatter={(label) => fmt(Number(label))}
            formatter={(val) => [`${Number(val).toFixed(2)} ${meta.unit}`, meta.label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={meta.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
