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

export function MiniMapOSM({ gps, className, interactive }: { gps: GpsTelemetry; className?: string; interactive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

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
    const el = document.createElement('div');
    el.className = 'bike-marker ok';
    el.style.width = '22px';
    el.style.height = '22px';
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([gps.longitude, gps.latitude])
      .addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    markerRef.current?.setLngLat([gps.longitude, gps.latitude]);
    mapRef.current?.setCenter([gps.longitude, gps.latitude]);
  }, [gps.latitude, gps.longitude]);

  return <div ref={ref} className={className} aria-label="Bike location mini map" />;
}
