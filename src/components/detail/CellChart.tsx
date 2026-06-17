import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface Props {
  cells: number[];
  cellDelta: number;
}

export function CellChart({ cells, cellDelta }: Props) {
  const maxV = Math.max(...cells);
  const minV = Math.min(...cells);
  const avg  = cells.reduce((a, b) => a + b, 0) / cells.length;
  const isOutlier = cellDelta > 0.1;

  const data = cells.map((v, i) => ({
    cell: `C${(i + 1).toString().padStart(2, '0')}`,
    v: parseFloat(v.toFixed(3)),
    isMax: v === maxV,
    isMin: v === minV,
  }));

  function getColor(entry: typeof data[0]) {
    if (entry.isMax) return '#00A8E8';
    if (entry.isMin && isOutlier) return '#C2410C';
    if (entry.isMin) return '#FACC15';
    return '#1E5BFF';
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={10}>
        <XAxis dataKey="cell" tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#6B7F9A' }} />
        <YAxis
          domain={[parseFloat((avg - 0.25).toFixed(2)), parseFloat((avg + 0.25).toFixed(2))]}
          tickCount={5}
          tick={{ fontFamily: 'JetBrains Mono', fontSize: 9, fill: '#6B7F9A' }}
          tickFormatter={v => v.toFixed(2)}
        />
        <Tooltip
          contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, borderRadius: 6, border: '1px solid #D4E2F7' }}
          formatter={(val) => [`${Number(val).toFixed(3)} V`, 'Voltage']}
        />
        <ReferenceLine y={avg} stroke="#D4E2F7" strokeDasharray="4 2" />
        <Bar dataKey="v" radius={[2, 2, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getColor(entry)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
