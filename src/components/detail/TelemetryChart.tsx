import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { getVehicleHistory } from '../../api/client';
import type { HistoryMetric } from '../../types/telemetry';
import { HistoryRange, type TimeRange } from './HistoryRange';
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
  const [range, setRange] = useState<TimeRange | null>(null);
  const meta = METRICS.find(m => m.key === active)!;

  // Default view: the whole of today (midnight → now), live-updating. A custom
  // range from the picker freezes to that window instead.
  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const effFrom = range ? range.from : startOfToday;
  const effTo = range ? range.to : undefined;
  const live = !range;

  const { data = [] } = useQuery({
    queryKey: ['history', vehicleId, active, effFrom, effTo ?? 'live'],
    queryFn: () => getVehicleHistory(vehicleId, active, '1h', effFrom, effTo),
    refetchInterval: live ? 3000 : false,   // frozen when browsing a custom range
  });

  const points = data;

  // Axis scaling per metric:
  //  - Pack voltage → real operating range by pack type (20S 40–74 V, 24S 48–88 V)
  //  - Current → symmetric around 0 (charge is negative, discharge positive) so
  //    both directions are always visible; min ±5 A so an idle line still reads
  //  - Everything else → auto
  const is24S = cellCount >= 24;
  let yDomain: [number | 'auto', number | 'auto'] = ['auto', 'auto'];
  let yTicks: number[] | undefined;
  if (active === 'sum_voltage') {
    yDomain = is24S ? [48, 88] : [40, 74];
    yTicks = is24S ? [48, 58, 68, 78, 88] : [40, 48, 56, 64, 74];
  } else if (active === 'discharge_current') {
    const nums = points.map(p => p.value).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const maxAbs = Math.max(5, ...nums.map(v => Math.abs(v)));
    const bound = Math.ceil(maxAbs / 5) * 5;
    yDomain = [-bound, bound];
    yTicks = [-bound, -bound / 2, 0, bound / 2, bound];
  }

  return (
    <div>
      <HistoryRange range={range} onChange={setRange} />
      {range && points.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#94A3B8' }}>
          No data recorded in the selected window.
        </p>
      )}
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
            tickFormatter={(ts: number) => range
              ? new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : fmt(ts)}
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
            labelFormatter={(label) => new Date(Number(label)).toLocaleString([], {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
            formatter={(val) => [`${Number(val).toFixed(2)} ${meta.unit}`, meta.label]}
          />
          {active === 'discharge_current' && <ReferenceLine y={0} stroke="#B7C6DE" strokeDasharray="3 3" />}
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
