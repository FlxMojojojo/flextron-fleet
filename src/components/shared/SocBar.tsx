import s from './SocBar.module.css';

export function SocBar({ soc }: { soc: number }) {
  const cls = soc < 20 ? s.low : soc < 50 ? s.mid : s.good;
  return (
    <div className={s.wrap}>
      <div className={s.track} role="progressbar" aria-valuenow={soc} aria-valuemin={0} aria-valuemax={100} aria-label={`SOC ${soc}%`}>
        <div className={`${s.fill} ${cls}`} style={{ width: `${soc}%` }} />
      </div>
      <span className={s.label}>{soc.toFixed(0)}%</span>
    </div>
  );
}
