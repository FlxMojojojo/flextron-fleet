import { useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { VehicleState } from '../../types/telemetry';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, FLEET_CENTER } from './mapConfig';
import s from './FleetOverview.module.css';

interface Props {
  vehicles: VehicleState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Pans the map to the selected vehicle whenever it changes. */
function PanToSelected({ vehicles, selectedId }: { vehicles: VehicleState[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !selectedId) return;
    const v = vehicles.find(x => x.vehicleno === selectedId);
    if (v) { map.panTo({ lat: v.gps.latitude, lng: v.gps.longitude }); map.setZoom(15); }
  }, [map, selectedId, vehicles]);
  return null;
}

export function FleetMapGoogle({ vehicles, selectedId, onSelect }: Props) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        defaultCenter={FLEET_CENTER}
        defaultZoom={12}
        mapId={GOOGLE_MAPS_MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
        className={s.map}
        aria-label="Fleet map"
      >
        {vehicles.map(v => (
          <AdvancedMarker
            key={v.vehicleno}
            position={{ lat: v.gps.latitude, lng: v.gps.longitude }}
            onClick={() => onSelect(v.vehicleno)}
            title={`${v.vehicleno} – ${v.status}`}
          >
            <div className={`bike-marker ${v.status}`} aria-label={`${v.vehicleno} – ${v.status}`}>
              <img className="bike-marker-icon" src="/brand/flextron-mark.png" alt="" />
            </div>
          </AdvancedMarker>
        ))}
        <PanToSelected vehicles={vehicles} selectedId={selectedId} />
      </Map>
    </APIProvider>
  );
}
