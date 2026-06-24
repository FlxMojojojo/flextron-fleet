import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GpsTelemetry } from '../../types/telemetry';

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

import type { PathPoint } from '../../api/client';

export function MiniMapOSM({ gps, className, interactive, path = [] }:
  { gps: GpsTelemetry; className?: string; interactive?: boolean; path?: PathPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: [gps.longitude, gps.latitude],
      zoom: interactive ? 16 : 15,
      interactive: !!interactive,
    });
    if (interactive) map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      map.addSource('path', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      map.addLayer({ id: 'path', type: 'line', source: 'path', paint: { 'line-color': '#1E5BFF', 'line-width': 4, 'line-opacity': 0.9 } });
      readyRef.current = true;
    });
    const el = document.createElement('div');
    el.className = 'bike-marker ok';
    el.style.width = '22px';
    el.style.height = '22px';
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([gps.longitude, gps.latitude])
      .addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; readyRef.current = false; };
  }, []);

  useEffect(() => {
    markerRef.current?.setLngLat([gps.longitude, gps.latitude]);
    mapRef.current?.setCenter([gps.longitude, gps.latitude]);
  }, [gps.latitude, gps.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource('path') as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path.map(p => [p.lng, p.lat]) } });
  }, [path]);

  return <div ref={ref} className={className} aria-label="Bike location mini map" />;
}
