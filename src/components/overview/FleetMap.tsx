import type { VehicleState } from '../../types/telemetry';
import { USE_GOOGLE_MAPS } from './mapConfig';
import { FleetMapOSM } from './FleetMapOSM';
import { FleetMapGoogle } from './FleetMapGoogle';

interface Props {
  vehicles: VehicleState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Renders the real Google basemap when VITE_GOOGLE_MAPS_API_KEY is set,
 * otherwise falls back to the keyless OpenStreetMap (MapLibre) map.
 */
export function FleetMap(props: Props) {
  return USE_GOOGLE_MAPS ? <FleetMapGoogle {...props} /> : <FleetMapOSM {...props} />;
}
