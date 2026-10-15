import { useEffect, useMemo, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Center, LatLng } from '@/lib/places';
import { directionsUrl, TILE_ATTRIBUTION, TILE_URL } from '@/lib/places';

const youIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#2a63d6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(42,99,214,.25)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const BUSY_STROKE: Record<string, string> = { low: '#1f7a4d', moderate: '#c98a06', busy: '#b3261e' };

function Controller({
  focus,
  selected,
  onMoved,
}: {
  focus: { center: LatLng; zoom: number; key: string } | null;
  selected: Center | null;
  onMoved: (c: LatLng) => void;
}) {
  const map = useMap();
  const programmatic = useRef(false);

  // Leaflet's fly animation breaks on a hidden (0×0) map — e.g. the mobile list view.
  const visible = () => {
    const size = map.getSize();
    return size.x > 0 && size.y > 0;
  };
  const pending = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const go = (lat: number, lng: number, zoom: number, animate: boolean) => {
    programmatic.current = true;
    if (!visible()) {
      pending.current = { lat, lng, zoom };
      return;
    }
    pending.current = null;
    if (animate) map.flyTo([lat, lng], zoom, { duration: 0.7 });
    else map.setView([lat, lng], zoom);
  };

  useEffect(() => {
    if (focus) go(focus.center.lat, focus.center.lng, focus.zoom, true);
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected) go(selected.latitude, selected.longitude, Math.max(map.getZoom(), 15), true);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The map lives in a layout that can resize or be shown later; catch up when it appears.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (pending.current && visible()) {
        const p = pending.current;
        pending.current = null;
        programmatic.current = true;
        map.setView([p.lat, p.lng], p.zoom);
      }
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useMapEvents({
    moveend: () => {
      if (programmatic.current) {
        programmatic.current = false;
        return;
      }
      const c = map.getCenter();
      onMoved({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

export default function CenterMap({
  centers,
  you,
  focus,
  selected,
  onSelect,
  onMoved,
  lang,
}: {
  centers: Center[];
  you: (LatLng & { accuracy?: number }) | null;
  focus: { center: LatLng; zoom: number; key: string } | null;
  selected: Center | null;
  onSelect: (c: Center) => void;
  onMoved: (c: LatLng) => void;
  lang: 'en' | 'te';
}) {
  const initial = useMemo(() => focus?.center ?? { lat: 16.2, lng: 80.6 }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapContainer
      center={[initial.lat, initial.lng]}
      zoom={focus ? focus.zoom : 7}
      preferCanvas
      zoomControl
      className="size-full"
      attributionControl
    >
      <TileLayer
        attribution={TILE_ATTRIBUTION}
        url={TILE_URL}
        maxZoom={19}
      />
      <Controller focus={focus} selected={selected} onMoved={onMoved} />
      {you?.accuracy != null && you.accuracy > 30 && you.accuracy < 3000 && (
        <Circle center={[you.lat, you.lng]} radius={you.accuracy} pathOptions={{ color: '#2a63d6', weight: 1, fillOpacity: 0.08 }} />
      )}
      {you && <Marker position={[you.lat, you.lng]} icon={youIcon} />}
      {centers.map((c) => {
        const isSel = selected?.id === c.id;
        const fill = c.kind === 'meeseva' ? '#f2b632' : '#1c2566';
        const stroke = c.busy_level ? BUSY_STROKE[c.busy_level] : '#ffffff';
        return (
          <CircleMarker
            key={c.id}
            center={[c.latitude, c.longitude]}
            radius={isSel ? 11 : c.source === 'db' ? 8 : 7}
            pathOptions={{ color: isSel ? '#b3261e' : stroke, weight: isSel ? 4 : 2.5, fillColor: fill, fillOpacity: 0.95 }}
            eventHandlers={{ click: () => onSelect(c) }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <p className="text-[15px] font-semibold leading-snug text-ink">{lang === 'te' && c.name_telugu ? c.name_telugu : c.name}</p>
                <p className="mt-0.5 text-xs text-muted">{lang === 'te' ? c.typeLabel.te : c.typeLabel.en}</p>
                {c.address && <p className="mt-1 text-xs">{c.address}</p>}
                <a href={directionsUrl(c)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-ink underline decoration-turmeric decoration-2">
                  {lang === 'te' ? 'దారి చూపించు' : 'Get directions'}
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
