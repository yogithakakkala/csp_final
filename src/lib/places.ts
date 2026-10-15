import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { haversineDistanceKm } from '@/lib/haversine';

export type CenterKind = 'sachivalayam' | 'meeseva';
export type BusyLevel = 'low' | 'moderate' | 'busy';

export interface Center {
  id: string;
  kind: CenterKind;
  /** human label for what this place is, e.g. "Ward Secretariat", "Panchayat office" */
  typeLabel: { en: string; te: string };
  name: string;
  name_telugu?: string | null;
  address: string;
  area?: string | null;
  district?: string | null;
  latitude: number;
  longitude: number;
  phone?: string | null;
  services: string[];
  busy_level?: BusyLevel | null;
  busy_updated_at?: string | null;
  busy_note?: string | null;
  opening_hours?: string | null;
  source: 'db' | 'osm' | 'google';
  distanceKm?: number | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Andhra Pradesh bounding box (west, south, east, north). */
export const AP_BBOX = { west: 76.75, south: 12.6, east: 84.8, north: 19.95 };
export const AP_CENTER: LatLng = { lat: 16.2, lng: 80.6 };

/* ───────────────────────── OpenStreetMap (Overpass) ───────────────────────── */

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const MEESEVA_RE = /mee\s?-?seva|మీ\s?సేవ|మీసేవ|e-?seva|ఈ-?సేవ|aadhaa?r|ఆధార్|common service|\bcsc\b|digital seva|jan seva/i;
const SECRETARIAT_RE = /sachiv|secretariat|సచివాలయ|panchayat|పంచాయతీ|ward office|village office|grama|gram /i;

function overpassQuery(p: LatLng, radiusM: number) {
  const a = `(around:${Math.round(radiusM)},${p.lat.toFixed(5)},${p.lng.toFixed(5)})`;
  return `[out:json][timeout:25];
(
  nwr${a}["name"~"sachiv|secretariat|సచివాలయ|panchayat office|panchayat bhavan|panchayath|పంచాయతీ కార్యాలయ",i];
  nwr${a}["name:te"~"సచివాలయ|పంచాయతీ"];
  nwr${a}["amenity"="townhall"];
  nwr${a}["office"="government"]["name"~"ward|village|grama|gram|mandal|tahsil|tehsil|revenue|municipal",i];
  nwr${a}["name"~"mee ?-?seva|మీ ?సేవ|e-?seva|aadhaa?r (seva|kendra|center|centre)|common service cent|^csc ",i];
  nwr${a}["office"="government"]["government"="citizen_services"];
);
out center tags 600;`;
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function classify(tags: Record<string, string>): { kind: CenterKind; label: { en: string; te: string } } | null {
  const name = `${tags.name ?? ''} ${tags['name:en'] ?? ''} ${tags['name:te'] ?? ''}`;
  if (MEESEVA_RE.test(name) || tags.government === 'citizen_services')
    return { kind: 'meeseva', label: /aadhaa?r|ఆధార్/i.test(name) && !/mee|seva/i.test(name) ? { en: 'Aadhaar centre', te: 'ఆధార్ కేంద్రం' } : { en: 'MeeSeva centre', te: 'మీసేవ కేంద్రం' } };
  if (/sachiv|secretariat|సచివాలయ/i.test(name)) {
    const ward = /ward|వార్డు/i.test(name);
    return { kind: 'sachivalayam', label: ward ? { en: 'Ward Sachivalayam', te: 'వార్డు సచివాలయం' } : { en: 'Sachivalayam', te: 'సచివాలయం' } };
  }
  if (/panchayat|పంచాయతీ/i.test(name) || tags.amenity === 'townhall')
    return { kind: 'sachivalayam', label: { en: 'Panchayat / village office', te: 'పంచాయతీ / గ్రామ కార్యాలయం' } };
  if (tags.office === 'government' && (SECRETARIAT_RE.test(name) || /mandal|tahsil|tehsil|revenue|municipal/i.test(name)))
    return { kind: 'sachivalayam', label: /tahsil|tehsil|mandal|revenue/i.test(name) ? { en: 'Mandal / Tahsildar office', te: 'మండల / తహసీల్దార్ కార్యాలయం' } : { en: 'Government office', te: 'ప్రభుత్వ కార్యాలయం' } };
  return null;
}

function osmToCenter(el: OsmElement): Center | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const c = classify(tags);
  if (!c) return null;
  const name = tags['name:en'] || tags.name || (c.kind === 'meeseva' ? 'MeeSeva centre' : c.label.en);
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = tags['addr:suburb'] || tags['addr:village'] || tags['addr:hamlet'] || tags['addr:city'] || tags['is_in'] || '';
  const address = [street, locality, tags['addr:district'], tags['addr:postcode']].filter(Boolean).join(', ');
  return {
    id: `osm-${el.type}-${el.id}`,
    kind: c.kind,
    typeLabel: c.label,
    name,
    name_telugu: tags['name:te'] || (/[ఀ-౿]/.test(tags.name ?? '') ? tags.name : null),
    address,
    area: locality || null,
    district: tags['addr:district'] || null,
    latitude: lat,
    longitude: lng,
    phone: tags.phone || tags['contact:phone'] || null,
    services: [],
    opening_hours: tags.opening_hours || null,
    source: 'osm',
  };
}

const memo = new Map<string, Center[]>();
const LS_PREFIX = 'sachiseva:osm:';
const TTL = 1000 * 60 * 60 * 24 * 3;

function cacheKey(p: LatLng, r: number) {
  return `${p.lat.toFixed(2)},${p.lng.toFixed(2)},${Math.round(r / 1000)}`;
}

function readLS(k: string): Center[] | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + k);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw) as { t: number; d: Center[] };
    if (Date.now() - t > TTL) return null;
    return d;
  } catch {
    return null;
  }
}

function writeLS(k: string, d: Center[]) {
  try {
    localStorage.setItem(LS_PREFIX + k, JSON.stringify({ t: Date.now(), d }));
  } catch {
    // Storage full: drop old OSM caches and move on.
    try {
      Object.keys(localStorage)
        .filter((x) => x.startsWith(LS_PREFIX))
        .forEach((x) => localStorage.removeItem(x));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Asks every public Overpass server at once and uses the first good answer.
 * (One at a time, a single slow server made the whole search time out.)
 */
async function overpassFetch(query: string, signal?: AbortSignal): Promise<OsmElement[]> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(new Error('The map search servers are busy — try again in a minute.')), 30000);
  const tries = OVERPASS.map(async (endpoint) => {
    const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
    if (!json.elements) throw new Error(json.remark || 'Overpass returned no data');
    return json.elements;
  });
  try {
    return await Promise.any(tries);
  } catch (e) {
    if (signal?.aborted) throw signal.reason ?? e;
    const reason = ctrl.signal.aborted ? ctrl.signal.reason : (e as AggregateError).errors?.[0];
    throw reason instanceof Error ? reason : new Error('Map data unavailable');
  } finally {
    clearTimeout(timer);
    ctrl.abort(); // stop the slower servers
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Live search of OpenStreetMap for Sachivalayams / MeeSeva centres around a point. */
export async function searchOsmCenters(p: LatLng, radiusKm: number, signal?: AbortSignal): Promise<Center[]> {
  const k = cacheKey(p, radiusKm * 1000);
  const hit = memo.get(k) ?? readLS(k);
  if (hit) {
    memo.set(k, hit);
    return hit;
  }
  const elements = await overpassFetch(overpassQuery(p, radiusKm * 1000), signal);
  const seen = new Set<string>();
  const out: Center[] = [];
  for (const el of elements) {
    const c = osmToCenter(el);
    if (!c) continue;
    const dupKey = `${c.kind}:${c.name.toLowerCase()}:${c.latitude.toFixed(3)}:${c.longitude.toFixed(3)}`;
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    out.push(c);
  }
  memo.set(k, out);
  writeLS(k, out);
  return out;
}

/* ───────────────────────── Your Supabase centres ───────────────────────── */

type DbRow = {
  id: string;
  name: string;
  name_telugu: string | null;
  address: string;
  area: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  services?: string[] | null;
  busy_level?: BusyLevel | null;
  busy_updated_at?: string | null;
  busy_note?: string | null;
};

function dbToCenter(r: DbRow, kind: CenterKind): Center {
  return {
    ...r,
    services: r.services ?? [],
    kind,
    typeLabel: kind === 'meeseva' ? { en: 'MeeSeva centre', te: 'మీసేవ కేంద్రం' } : { en: 'Sachivalayam', te: 'సచివాలయం' },
    source: 'db',
  };
}

/** Centres stored in Supabase within a box around a point (all of them if no point). */
export async function loadDbCenters(p: LatLng | null, radiusKm: number): Promise<Center[]> {
  if (!isSupabaseConfigured) return [];
  const build = (table: string) => {
    let q = supabase.from(table).select('*');
    if (p) {
      const dLat = radiusKm / 111;
      const dLng = radiusKm / (111 * Math.cos((p.lat * Math.PI) / 180));
      q = q.gte('latitude', p.lat - dLat).lte('latitude', p.lat + dLat).gte('longitude', p.lng - dLng).lte('longitude', p.lng + dLng);
    }
    return q.limit(1000);
  };
  const [s, m] = await Promise.all([build('sachivalayam_centers'), build('meeseva_centers')]);
  return [
    ...((s.data as DbRow[] | null) ?? []).map((r) => dbToCenter(r, 'sachivalayam')),
    ...((m.data as DbRow[] | null) ?? []).map((r) => dbToCenter(r, 'meeseva')),
  ];
}

/**
 * Combine sources, earlier lists win on duplicates (same kind within 150 m):
 * your database (crowd level, verified phone) → Google → OpenStreetMap.
 */
export function mergeCenters(...lists: Center[][]): Center[] {
  const out: Center[] = [];
  for (const list of lists)
    for (const c of list)
      if (!out.some((d) => d.kind === c.kind && haversineDistanceKm(d.latitude, d.longitude, c.latitude, c.longitude) < 0.15)) out.push(c);
  return out;
}

/* ───────────────────────── Google Places (optional, via /api/places) ───────────────────────── */

let googleAvailable: boolean | null = null;

export async function searchGoogleCenters(p: LatLng, radiusKm: number, signal?: AbortSignal): Promise<Center[]> {
  if (googleAvailable === false) return [];
  const k = `g:${cacheKey(p, radiusKm * 1000)}`;
  const hit = memo.get(k);
  if (hit) return hit;
  try {
    const res = await fetch('/api/places', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat: p.lat, lng: p.lng, radiusKm }),
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { configured: boolean; places: { id: string; kind: CenterKind; name: string; address: string; latitude: number; longitude: number; phone: string | null }[] };
    googleAvailable = data.configured;
    const out: Center[] = (data.places ?? []).map((g) => ({
      ...g,
      services: [],
      typeLabel: g.kind === 'meeseva' ? { en: 'MeeSeva centre', te: 'మీసేవ కేంద్రం' } : { en: 'Sachivalayam', te: 'సచివాలయం' },
      source: 'google' as const,
    }));
    memo.set(k, out);
    return out;
  } catch (e) {
    if (signal?.aborted) throw e;
    return [];
  }
}

/* ───────────────────────── Travel time (rough) ───────────────────────── */

/** Straight-line distance → a friendly estimate. Roads are ~1.3× longer than a straight line. */
export function travelEstimate(km: number, lang: 'en' | 'te') {
  const road = km * 1.3;
  if (road <= 1.5) {
    const min = Math.max(1, Math.round((road / 4.5) * 60));
    return lang === 'te' ? `నడకలో ~${min} నిమి.` : `~${min} min walk`;
  }
  const min = Math.max(2, Math.round((road / 22) * 60));
  return lang === 'te' ? `వాహనంలో ~${min} నిమి.` : `~${min} min by road`;
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

// OpenStreetMap's own tiles: free, no API key. (CARTO's basemaps now need a key.)
// Set VITE_MAP_TILE_URL to use another provider, e.g. a keyed MapTiler / Stadia URL.
export const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function withDistance(list: Center[], from: LatLng | null): Center[] {
  if (!from) return list.map((c) => ({ ...c, distanceKm: null }));
  return list
    .map((c) => ({ ...c, distanceKm: haversineDistanceKm(from.lat, from.lng, c.latitude, c.longitude) }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/* ───────────────────────── Place search (any village / town) ───────────────────────── */

export interface PlaceHit {
  label: string;
  sub: string;
  lat: number;
  lng: number;
}

export async function geocode(q: string, lang: 'en' | 'te', signal?: AbortSignal): Promise<PlaceHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const pin = /^\d{6}$/.test(query);
  const { west, south, east, north } = AP_BBOX;
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      format: 'jsonv2',
      q: pin ? query : `${query}, Andhra Pradesh`,
      countrycodes: 'in',
      limit: '8',
      addressdetails: '1',
      viewbox: `${west},${north},${east},${south}`,
      'accept-language': lang === 'te' ? 'te,en' : 'en',
    }).toString();
    const res = await fetch(url, { signal });
    if (res.ok) {
      const rows = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
      if (rows.length)
        return rows.map((r) => {
          const parts = r.display_name.split(',').map((x) => x.trim());
          return { label: r.name || parts[0], sub: parts.slice(1, 4).join(', '), lat: Number(r.lat), lng: Number(r.lon) };
        });
    }
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  // Fallback geocoder
  const url = new URL('https://photon.komoot.io/api/');
  url.search = new URLSearchParams({ q: query, limit: '8', bbox: `${west},${south},${east},${north}` }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; county?: string; state?: string; district?: string } }[];
  };
  return json.features.map((f) => ({
    label: f.properties.name ?? query,
    sub: [f.properties.city, f.properties.district ?? f.properties.county, f.properties.state].filter(Boolean).join(', '),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}

/* ───────────────────────── Links ───────────────────────── */

export function directionsUrl(c: { latitude: number; longitude: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
}

export function googleNearbyUrl(kind: CenterKind, near?: LatLng | null) {
  const q = kind === 'meeseva' ? 'MeeSeva centre' : 'Grama Ward Sachivalayam';
  return near
    ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${near.lat},${near.lng},14z`
    : `https://www.google.com/maps/search/${encodeURIComponent(q + ' Andhra Pradesh')}`;
}

export function busyIsStale(updated?: string | null) {
  return !updated || Date.now() - new Date(updated).getTime() > 8 * 3600 * 1000;
}

export const BUSY_META = {
  low: { en: 'Less crowded', te: 'తక్కువ రద్దీ', cls: 'bg-leaf-50 text-leaf', dot: 'bg-leaf' },
  moderate: { en: 'Moderate queue', te: 'మధ్యస్థ రద్దీ', cls: 'bg-amber-50 text-amber', dot: 'bg-turmeric-deep' },
  busy: { en: 'Very busy', te: 'చాలా రద్దీ', cls: 'bg-kumkum-50 text-kumkum', dot: 'bg-kumkum' },
} as const;
