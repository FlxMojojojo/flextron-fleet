import type { VehicleState } from '../../types/telemetry';
import { USE_GOOGLE_MAPS } from './mapConfig';
import { FleetMapOSM } from './FleetMapOSM';
import { FleetMapGoogle } from './FleetMapGoogle';
import { MapErrorBoundary } from './MapErrorBoundary';

interface Props {
  vehicles: VehicleState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Renders the real Google basemap when VITE_GOOGLE_MAPS_API_KEY is set,
 * otherwise (or if Google fails at runtime) falls back to the keyless
 * OpenStreetMap (MapLibre) map.
 */
export function FleetMap(props: Props) {
  if (!USE_GOOGLE_MAPS) return <FleetMapOSM {...props} />;
  return (
    <MapErrorBoundary fallback={<FleetMapOSM {...props} />}>
      <FleetMapGoogle {...props} />
    </MapErrorBoundary>
  );
}
