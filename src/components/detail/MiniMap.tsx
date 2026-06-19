import type { GpsTelemetry } from '../../types/telemetry';
import { USE_GOOGLE_MAPS } from '../overview/mapConfig';
import { MapErrorBoundary } from '../overview/MapErrorBoundary';
import { MiniMapOSM } from './MiniMapOSM';
import { MiniMapGoogle } from './MiniMapGoogle';

export function MiniMap(props: { gps: GpsTelemetry; className?: string; interactive?: boolean }) {
  if (!USE_GOOGLE_MAPS) return <MiniMapOSM {...props} />;
  return (
    <MapErrorBoundary fallback={<MiniMapOSM {...props} />}>
      <MiniMapGoogle {...props} />
    </MapErrorBoundary>
  );
}
