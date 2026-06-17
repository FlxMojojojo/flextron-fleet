import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { VehicleState } from '../../types/telemetry';
import s from './FleetOverview.module.css';

/**
 * Map tile source: OpenStreetMap raster (keyless, no signup required).
 * Production recommendation: swap to MapTiler vector tiles or Protomaps
 * for crisp vector rendering, custom styling, and offline support.
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

/** Build a branded marker element (Flextron icon + status-colored ring). */
function makeMarkerEl(): HTMLDivElement {
  const div = document.createElement('div');
  div.setAttribute('role', 'button');
  div.setAttribute('tabindex', '0');
  const img = document.createElement('img');
  img.src = '/brand/flextron-mark.png';
  img.alt = '';
  img.className = 'bike-marker-icon';
  div.appendChild(img);
  return div;
}

export function FleetMap({ vehicles, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Keep the latest onSelect without re-running the marker effect.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Init map once per mount.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [77.5946, 12.9716],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      // Clear markers tied to THIS map so none linger across remounts.
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sync markers whenever data changes (and once the map is ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const currentIds = new Set(vehicles.map(v => v.vehicleno));

    // Remove markers for vehicles that no longer exist.
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    }

    for (const v of vehicles) {
      let marker = markersRef.current.get(v.vehicleno);

      if (!marker) {
        const el = makeMarkerEl();
        el.addEventListener('click', () => onSelectRef.current(v.vehicleno));
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectRef.current(v.vehicleno); }
        });
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.gps.longitude, v.gps.latitude])
          .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }))
          .addTo(map);
        markersRef.current.set(v.vehicleno, marker);
      } else {
        marker.setLngLat([v.gps.longitude, v.gps.latitude]);
      }

      // Update status styling + popup content every tick.
      const el = marker.getElement();
      el.className = `bike-marker ${v.status}`;
      el.setAttribute('aria-label', `${v.vehicleno} – ${v.status}`);
      marker.getPopup()?.setHTML(
        `<strong>${v.vehicleno}</strong><br>SOC ${v.can.soc.toFixed(0)}% · ${v.status}`,
      );
    }
  }, [vehicles, mapReady]);

  // Pan to the selected vehicle.
  useEffect(() => {
    if (!mapRef.current || !mapReady || !selectedId) return;
    const v = vehicles.find(x => x.vehicleno === selectedId);
    if (v) mapRef.current.flyTo({ center: [v.gps.longitude, v.gps.latitude], zoom: 14, duration: 800 });
  }, [selectedId, mapReady, vehicles]);

  return <div ref={containerRef} className={s.map} aria-label="Fleet map" />;
}
