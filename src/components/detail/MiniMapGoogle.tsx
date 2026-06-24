import { useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { GpsTelemetry } from '../../types/telemetry';
import type { PathPoint } from '../../api/client';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID } from '../overview/mapConfig';

/** Draws the GPS breadcrumb trail as a blue polyline. */
function PathLine({ path }: { path: PathPoint[] }) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!map || !g?.maps) return;
    if (!lineRef.current) {
      lineRef.current = new g.maps.Polyline({
        geodesic: true, strokeColor: '#1E5BFF', strokeOpacity: 0.9, strokeWeight: 4,
      });
      lineRef.current.setMap(map);
    }
    lineRef.current.setPath(path.map(p => ({ lat: p.lat, lng: p.lng })));
  }, [map, path]);

  useEffect(() => () => { lineRef.current?.setMap(null); lineRef.current = null; }, []);
  return null;
}

export function MiniMapGoogle({ gps, className, interactive, path = [] }:
  { gps: GpsTelemetry; className?: string; interactive?: boolean; path?: PathPoint[] }) {
  const position = { lat: gps.latitude, lng: gps.longitude };
  return (
    <div className={className} aria-label="Bike location map">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          center={position}
          defaultZoom={interactive ? 15 : 15}
          mapId={GOOGLE_MAPS_MAP_ID}
          gestureHandling={interactive ? 'greedy' : 'none'}
          disableDefaultUI={!interactive}
          zoomControl={interactive}
          fullscreenControl={interactive}
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
        >
          {path.length > 1 && <PathLine path={path} />}
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
