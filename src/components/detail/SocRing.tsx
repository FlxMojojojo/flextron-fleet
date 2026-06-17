interface Props { soc: number; }

export function SocRing({ soc }: Props) {
  const r = 68;
  const cx = 80;
  const cy = 80;
  const stroke = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (soc / 100) * circ;

  const color = soc < 20 ? '#FF7A5C' : soc < 50 ? '#FACC15' : '#4ADE80';

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      {/* Fill */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
      />
      {/* Label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="26" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
        {soc.toFixed(0)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="Inter, sans-serif" letterSpacing="1">
        SOC %
      </text>
    </svg>
  );
}
