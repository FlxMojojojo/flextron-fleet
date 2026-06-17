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

export function MiniMapOSM({ gps, className }: { gps: GpsTelemetry; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: [gps.longitude, gps.latitude],
      zoom: 15,
      interactive: false,
    });
    const el = document.createElement('div');
    el.className = 'bike-marker ok';
    el.style.width = '18px';
    el.style.height = '18px';
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
