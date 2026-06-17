/**
 * Flextron brand assets — uses the official logo files in public/brand/.
 *
 * <BrandMark>   — the lightning-bolt "F" icon (public/brand/flextron-mark.png).
 * <BrandLockup> — icon + "FLEXTRON" wordmark + product/tagline line, for the
 *                 dark nav (the official full-color wordmark is dark-on-
 *                 transparent, so on dark surfaces we set it in white here).
 * <BrandLogoFull> — the official full lockup PNG, for light/print surfaces.
 */

const MARK_SRC = '/brand/flextron-mark.png';
const FULL_SRC = '/brand/flextron-logo-full.png';
const MARK_RATIO = 604 / 534; // native icon height / width

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src={MARK_SRC}
      width={size}
      height={Math.round(size * MARK_RATIO)}
      className={className}
      alt="Flextron"
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

export function BrandLogoFull({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <img
      src={FULL_SRC}
      height={height}
      width={Math.round((height * 1004) / 350)}
      className={className}
      alt="Flextron · Ft.energy"
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

interface LockupProps {
  /** Wordmark + tagline color. Use white on dark surfaces. */
  tone?: 'dark' | 'light';
  /** Product line under the wordmark. */
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
