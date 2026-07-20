import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import { getSeries } from '../../api/client';
import type { HistoryMetric } from '../../types/telemetry';
import { HistoryRange, type TimeRange } from './HistoryRange';
import s from './BikeDetail.module.css';

const METRICS: { key: HistoryMetric; label: string; unit: string; color: string }[] = [
  { key: 'soc', label: 'SOC', unit: '%', color: '#1E5BFF' },
  { key: 'sum_voltage', label: 'Voltage', unit: 'V', color: '#00A8E8' },
  { key: 'battery_temp_1', label: 'Temp', unit: '°C', color: '#C2410C' },
  { key: 'discharge_current', label: 'Current', unit: 'A', color: '#0E9F6E' },
];
const META = Object.fromEntries(METRICS.map(m => [m.key, m])) as Record<HistoryMetric, typeof METRICS[number]>;

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtFull(ts: number) {
  return new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompareTooltip({ active, payload, label, selected }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: '#fff', border: '1px solid #D4E2F7', borderRadius: 6, padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
      <div style={{ color: '#6B7F9A', marginBottom: 4 }}>{fmtFull(Number(label))}</div>
      {(selected as HistoryMetric[]).map(m => (
        <div key={m} style={{ color: META[m].color }}>
          ● {META[m].label}: <strong>{typeof row[m] === 'number' ? row[m].toFixed(2) : '—'} {META[m].unit}</strong>
        </div>
      ))}
    </div>
  );
}

export function TelemetryChart({ vehicleId, cellCount = 20 }: { vehicleId: string; cellCount?: number }) {
  const [selected, setSelected] = useState<HistoryMetric[]>(['soc']);
  const [range, setRange] = useState<TimeRange | null>(null);
  const [zoom, setZoom] = useState<{ from: number; to: number } | null>(null);
  const [refL, setRefL] = useState<number | null>(null);
  const [refR, setRefR] = useState<number | null>(null);

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const effFrom = range ? range.from : startOfToday;
  const effTo = range ? range.to : undefined;
  const live = !range;

  const { data = [] } = useQuery({
    queryKey: ['series', vehicleId, selected.join(','), effFrom, effTo ?? 'live'],
    queryFn: () => getSeries(vehicleId, selected, effFrom, effTo),
    refetchInterval: live && !zoom ? 3000 : false,   // pause live refresh while zoomed
    enabled: selected.length > 0,
  });

  const rows = zoom ? data.filter(r => r.ts >= zoom.from && r.ts <= zoom.to) : data;
  const multi = selected.length > 1;

  // Normalize each metric to 0–100% of its own range (over the visible window)
  // so differently-scaled series can be compared by shape.
  const chartData = useMemo(() => {
    if (!multi) return rows;
    const ranges: Record<string, { min: number; max: number }> = {};
    for (const m of selected) {
      let mn = Infinity, mx = -Infinity;
      for (const r of rows) { const v = r[m]; if (typeof v === 'number' && Number.isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; } }
      ranges[m] = { min: mn === Infinity ? 0 : mn, max: mx === -Infinity ? 1 : mx };
    }
    return rows.map(r => {
      const o: Record<string, number> = { ts: r.ts };
      for (const m of selected) {
        const v = r[m];
        o[m] = v as number;
        const { min, max } = ranges[m];
        o[`${m}__n`] = (typeof v === 'number' && max > min) ? ((v - min) / (max - min)) * 100 : 50;
      }
      return o;
    });
  }, [rows, selected, multi]);

  // Single-metric axis: real values with sensible domains.
  const single = selected[0];
  const is24S = cellCount >= 24;
  let yDomain: [number | 'auto', number | 'auto'] = ['auto', 'auto'];
  let yTicks: number[] | undefined;
  if (!multi) {
    if (single === 'sum_voltage') { yDomain = is24S ? [48, 88] : [40, 74]; yTicks = is24S ? [48, 58, 68, 78, 88] : [40, 48, 56, 64, 74]; }
    else if (single === 'discharge_current') {
      const nums = rows.map(r => r.discharge_current).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const b = Math.ceil(Math.max(5, ...nums.map(Math.abs)) / 5) * 5;
      yDomain = [-b, b]; yTicks = [-b, -b / 2, 0, b / 2, b];
    }
  } else { yDomain = [0, 100]; yTicks = [0, 25, 50, 75, 100]; }

  function toggle(m: HistoryMetric) {
    setZoom(null);
    setSelected(prev => prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]);
  }

  function commitZoom() {
    if (refL != null && refR != null && refL !== refR) {
      setZoom({ from: Math.min(refL, refR), to: Math.max(refL, refR) });
    }
    setRefL(null); setRefR(null);
  }

  return (
    <div>
      <HistoryRange range={range} onChange={r => { setRange(r); setZoom(null); }} />

      <div className={s.tabBar} role="group" aria-label="Metrics to compare">
        {METRICS.map(m => (
          <button
            key={m.key}
            aria-pressed={selected.includes(m.key)}
            className={`${s.tab}${selected.includes(m.key) ? ' ' + s.active : ''}`}
            style={selected.includes(m.key) ? { background: m.color, borderColor: m.color } : undefined}
            onClick={() => toggle(m.key)}
          >
            {m.label}
          </button>
        ))}
        {zoom && <button className={s.tab} onClick={() => setZoom(null)}>⤢ Reset zoom</button>}
      </div>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: '#94A3B8', margin: '0 0 6px' }}>
        {multi
          ? 'Comparing — lines normalized to each metric’s range; hover for real values. Drag on the chart to zoom.'
          : 'Tap metrics to overlay & compare. Drag on the chart to zoom in.'}
      </p>

      {rows.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#94A3B8' }}>No data in this window.</p>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart
            data={chartData}
            margin={{ top: 6, right: 8, left: -8, bottom: 0 }}
            onMouseDown={(e: { activeLabel?: string | number }) => { if (e?.activeLabel != null) setRefL(Number(e.activeLabel)); }}
            onMouseMove={(e: { activeLabel?: string | number }) => { if (refL != null && e?.activeLabel != null) setRefR(Number(e.activeLabel)); }}
            onMouseUp={commitZoom}
          >
            <CartesianGrid strokeDasharray="4 2" stroke="#EAF2FF" />
            <XAxis
              dataKey="ts" type="number" domain={['dataMin', 'dataMax']}
              tickFormatter={range || zoom ? (ts: number) => new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : fmtTime}
              tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#6B7F9A' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain} ticks={yTicks} allowDataOverflow width={44}
              tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#6B7F9A' }}
              tickFormatter={v => multi ? `${v}%` : `${v}${META[single].unit}`}
            />
            {!multi && single === 'discharge_current' && <ReferenceLine y={0} stroke="#B7C6DE" strokeDasharray="3 3" />}
            <Tooltip content={<CompareTooltip selected={selected} />} />
            {selected.map(m => (
              <Line
                key={m} type="monotone"
                dataKey={multi ? `${m}__n` : m}
                name={META[m].label} stroke={META[m].color} strokeWidth={2}
                dot={false} isAnimationActive={false} connectNulls
              />
            ))}
            {refL != null && refR != null && <ReferenceArea x1={refL} x2={refR} strokeOpacity={0.3} fill="#1E5BFF" fillOpacity={0.08} />}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
