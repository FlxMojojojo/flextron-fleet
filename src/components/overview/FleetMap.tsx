import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { VehicleState } from '../../types/telemetry';
import s from './FleetOverview.module.css';

/**
 * Map tile source: OpenStreetMap raster (keyless, no signup required).
 * Production recommendation: swap to MapTiler vector tiles or Protomaps
 * for crisp vector rendering, custom styling, and offline support.
 * MapTiler:   https://cloud.maptiler.com/maps/  (free tier available)
 * Protomaps:  https://protomaps.com/            (self-hostable)
 */
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

interface Props {
  vehicles: VehicleState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FleetMap({ vehicles, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [77.5946, 12.9716],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Sync markers on vehicle update
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(vehicles.map(v => v.vehicleno));

    // Remove stale
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    }

    // Add/update
    for (const v of vehicles) {
      const el = markersRef.current.get(v.vehicleno)?.getElement()
        ?? (() => {
          const div = document.createElement('div');
          div.setAttribute('role', 'button');
          div.setAttribute('tabindex', '0');
          div.setAttribute('aria-label', `${v.vehicleno} – ${v.status}`);
          div.addEventListener('click', () => onSelect(v.vehicleno));
          div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onSelect(v.vehicleno); });
          return div;
        })();

      el.className = `bike-marker ${v.status}`;
      el.setAttribute('aria-label', `${v.vehicleno} – ${v.status}`);
      el.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="3.5" fill="white" opacity="0.9"/>
      </svg>`;

      if (!markersRef.current.has(v.vehicleno)) {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.gps.longitude, v.gps.latitude])
          .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false })
            .setHTML(`<strong>${v.vehicleno}</strong><br>SOC ${v.can.soc.toFixed(0)}% · ${v.status}`))
          .addTo(map);
        markersRef.current.set(v.vehicleno, marker);
      } else {
        markersRef.current.get(v.vehicleno)!.setLngLat([v.gps.longitude, v.gps.latitude]);
      }
    }
  }, [vehicles, onSelect]);

  // Pan to selected
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const v = vehicles.find(x => x.vehicleno === selectedId);
    if (v) mapRef.current.flyTo({ center: [v.gps.longitude, v.gps.latitude], zoom: 14, duration: 800 });
  }, [selectedId, vehicles]);

  return <div ref={containerRef} className={s.map} aria-label="Fleet map" />;
}
