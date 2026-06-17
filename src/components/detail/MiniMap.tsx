import type { GpsTelemetry } from '../../types/telemetry';
import { USE_GOOGLE_MAPS } from '../overview/mapConfig';
import { MiniMapOSM } from './MiniMapOSM';
import { MiniMapGoogle } from './MiniMapGoogle';

export function MiniMap(props: { gps: GpsTelemetry; className?: string }) {
  return USE_GOOGLE_MAPS ? <MiniMapGoogle {...props} /> : <MiniMapOSM {...props} />;
}
