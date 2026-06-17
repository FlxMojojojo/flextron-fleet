import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import type { GpsTelemetry } from '../../types/telemetry';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID } from '../overview/mapConfig';

export function MiniMapGoogle({ gps, className }: { gps: GpsTelemetry; className?: string }) {
  const position = { lat: gps.latitude, lng: gps.longitude };
  return (
    <div className={className} aria-label="Bike location mini map">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          center={position}
          defaultZoom={15}
          mapId={GOOGLE_MAPS_MAP_ID}
          gestureHandling="none"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={position}>
            <div className="bike-marker ok" style={{ width: 20, height: 20 }}>
              <img className="bike-marker-icon" src="/brand/flextron-mark.png" alt="" />
            </div>
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  );
}
