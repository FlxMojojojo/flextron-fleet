/**
 * Flextron brand assets.
 *
 * <BrandMark> — the lightning-bolt "F" icon (gradient cyan→purple).
 * <BrandLockup> — icon + "FLEXTRON" wordmark + product/tagline line.
 *
 * The mark is a faithful vector recreation of the official logo. To use the
 * exact brand export instead, drop it at public/flextron-mark.svg (favicon)
 * and replace the <svg> paths below — geometry is the only thing to swap.
 */

let gradSeq = 0;

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  // Unique gradient id per instance so multiple marks render correctly.
  const id = `flx-grad-${gradSeq++}`;
  return (
    <svg
      width={size}
      height={(size * 134) / 120}
      viewBox="0 0 120 134"
      className={className}
      role="img"
      aria-label="Flextron"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="96" y1="2" x2="20" y2="132">
          <stop offset="0" stopColor="#2DB7CB" />
          <stop offset="0.5" stopColor="#3A6FA8" />
          <stop offset="1" stopColor="#3B2A63" />
        </linearGradient>
      </defs>
      <path d="M28 4 L116 4 L98 34 L54 34 L6 130 Z" fill={`url(#${id})`} />
      <path d="M52 44 L104 44 L82 70 L100 70 L44 112 L64 76 L46 76 Z" fill={`url(#${id})`} />
    </svg>
  );
}

interface LockupProps {
  /** Wordmark + tagline color. Use white on dark surfaces. */
  tone?: 'dark' | 'light';
  /** Product line under the wordmark (defaults to the tagline). */
  tagline?: string;
  markSize?: number;
}

export function BrandLockup({ tone = 'dark', tagline = 'Fleet Telemetry', markSize = 30 }: LockupProps) {
  const wordColor = tone === 'light' ? '#FFFFFF' : '#251A3D';
  const tagColor = tone === 'light' ? 'rgba(255,255,255,0.55)' : '#6B5E86';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <BrandMark size={markSize} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: markSize * 0.62,
            letterSpacing: '0.06em',
            color: wordColor,
          }}
        >
          FLEXTRON
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: markSize * 0.3,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: tagColor,
            marginTop: 3,
          }}
        >
          {tagline}
        </span>
      </span>
    </span>
  );
}
