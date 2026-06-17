import type { VehicleStatus } from '../../types/telemetry';
import s from './StatusChip.module.css';

const LABELS: Record<VehicleStatus, string> = {
  ok: 'OK',
  charging: 'Charging',
  alert: 'Alert',
  offline: 'Offline',
};

export function StatusChip({ status }: { status: VehicleStatus }) {
  return (
    <span className={`${s.chip} ${s[status]}`} role="status" aria-label={`Status: ${LABELS[status]}`}>
      <span className={s.dot} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
