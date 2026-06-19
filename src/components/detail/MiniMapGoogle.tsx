import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import type { GpsTelemetry } from '../../types/telemetry';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID } from '../overview/mapConfig';

export function MiniMapGoogle({ gps, className, interactive }: { gps: GpsTelemetry; className?: string; interactive?: boolean }) {
  const position = { lat: gps.latitude, lng: gps.longitude };
  return (
    <div className={className} aria-label="Bike location map">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          center={position}
          defaultZoom={interactive ? 16 : 15}
          mapId={GOOGLE_MAPS_MAP_ID}
          gestureHandling={interactive ? 'greedy' : 'none'}
          disableDefaultUI={!interactive}
          zoomControl={interactive}
          fullscreenControl={interactive}
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={position}>
            <div className="bike-marker ok" style={{ width: 24, height: 24 }}>
              <img className="bike-marker-icon" src="/brand/flextron-mark.png" alt="" />
            </div>
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  );
}
