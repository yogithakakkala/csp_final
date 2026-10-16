import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crosshair, ExternalLink, List, Loader2, LocateFixed, Map as MapIcon, MapPin, Navigation, Phone, Search, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  BUSY_META,
  busyIsStale,
  directionsUrl,
  formatDistance,
  geocode,
  googleNearbyUrl,
  loadDbCenters,
  mergeCenters,
  searchGoogleCenters,
  searchOsmCenters,
  travelEstimate,
  withDistance,
  type Center,
  type CenterKind,
  type LatLng,
  type PlaceHit,
} from '@/lib/places';
import { haversineDistanceKm } from '@/lib/haversine';
import { Button, Notice, PageHeader, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

const CenterMap = lazy(() => import('@/components/CenterMap'));

type Filter = 'all' | CenterKind;
type Origin = LatLng & { label: string; source: 'gps' | 'search' | 'map'; accuracy?: number };

/** Search widens step by step until a Sachivalayam AND a MeeSeva are found. */
const RADII = [3, 8, 20, 45];
const PAGE = 20;

function readOrigin(): Origin | null {
  try {
    return JSON.parse(sessionStorage.getItem('sachiseva:origin') ?? 'null') as Origin | null;
  } catch {
    return null;
  }
}

export default function NearestCenter() {
  const { lang, tx } = useLang();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('tab') as Filter) || 'all';
  const lessCrowded = params.get('filter') === 'less';
  const setParam = (k: string, v: string | null) =>
    setParams((p) => (v ? p.set(k, v) : p.delete(k), p), { replace: true });

  const geo = useGeolocation('manual');
  const [origin, setOrigin] = useState<Origin | null>(() => (params.get('near') ? null : readOrigin()));
  const [radius, setRadius] = useState(RADII[0]);
  const [db, setDb] = useState<Center[]>([]);
  const [osm, setOsm] = useState<Center[]>([]);
  const [google, setGoogle] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [osmFailed, setOsmFailed] = useState(false);
  const [selected, setSelected] = useState<Center | null>(null);
  const [moved, setMoved] = useState<LatLng | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [focusKey, setFocusKey] = useState(0);
  const [retry, setRetry] = useState(0);

  const locate = useCallback(async () => {
    const fix = await geo.request();
    if (!fix) return;
    setRadius(RADII[0]);
    setSelected(null);
    setMoved(null);
    setOrigin({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, label: tx('your location', 'మీ స్థానం'), source: 'gps' });
    setFocusKey((k) => k + 1);
  }, [geo, tx]);

  // One tap: opening the page finds you straight away.
  useEffect(() => {
    if (!origin) void locate();
    if (params.get('near')) setParam('near', null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (origin) sessionStorage.setItem('sachiseva:origin', JSON.stringify(origin));
    } catch {
      /* ignore */
    }
  }, [origin]);

  // All sources in parallel; widen the radius until both kinds are found.
  useEffect(() => {
    if (!origin) {
      loadDbCenters(null, 0).then(setDb);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setOsmFailed(false);
    setShown(PAGE);
    Promise.all([
      loadDbCenters(origin, radius),
      searchOsmCenters(origin, radius, ctrl.signal).catch(() => {
        if (!ctrl.signal.aborted) setOsmFailed(true);
        return [] as Center[];
      }),
      searchGoogleCenters(origin, radius, ctrl.signal).catch(() => [] as Center[]),
    ]).then(([d, o, g]) => {
      if (ctrl.signal.aborted) return;
      setDb(d);
      setOsm(o);
      setGoogle(g);
      const all = [...d, ...o, ...g];
      const next = RADII[RADII.indexOf(radius) + 1];
      const enough = all.some((c) => c.kind === 'sachivalayam') && all.some((c) => c.kind === 'meeseva');
      if (!enough && next) setRadius(next);
      else setLoading(false);
    });
    return () => ctrl.abort();
  }, [origin?.lat, origin?.lng, radius, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live crowd levels from staff.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const ch = supabase
      .channel('centers-busy')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sachivalayam_centers' }, (p) => {
        const row = p.new as Partial<Center> & { id: string };
        setDb((list) => list.map((c) => (c.id === row.id && c.kind === 'sachivalayam' ? { ...c, busy_level: row.busy_level, busy_note: row.busy_note, busy_updated_at: row.busy_updated_at } : c)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const all = useMemo(() => withDistance(mergeCenters(db, google, osm), origin), [db, google, osm, origin]);
  const nearestSach = origin ? all.find((c) => c.kind === 'sachivalayam') : undefined;
  const nearestMee = origin ? all.find((c) => c.kind === 'meeseva') : undefined;
  const list = useMemo(
    () => all.filter((c) => (filter === 'all' || c.kind === filter) && (!lessCrowded || c.kind !== 'sachivalayam' || (c.source === 'db' && c.busy_level !== 'busy'))),
    [all, filter, lessCrowded],
  );
  const counts = { all: all.length, sachivalayam: all.filter((c) => c.kind === 'sachivalayam').length, meeseva: all.filter((c) => c.kind === 'meeseva').length };

  const goTo = (o: Origin) => {
    setRadius(RADII[0]);
    setSelected(null);
    setMoved(null);
    setOrigin(o);
    setFocusKey((k) => k + 1);
  };

  const onMapMoved = useCallback(
    (c: LatLng) => {
      if (!origin || haversineDistanceKm(origin.lat, origin.lng, c.lat, c.lng) > Math.max(1.5, radius * 0.4)) setMoved(c);
    },
    [origin, radius],
  );

  const select = (c: Center) => {
    setSelected(c);
    const idx = list.findIndex((x) => x.id === c.id);
    if (idx >= shown) setShown(idx + 5);
    requestAnimationFrame(() => document.getElementById(`c-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const locating = geo.status === 'requesting';
  const approximate = origin?.source === 'gps' && (origin.accuracy ?? 0) > 1500;
  const focus = origin ? { center: origin, zoom: radius >= 20 ? 11 : radius >= 8 ? 13 : 14, key: `${focusKey}-${radius}` } : null;

  return (
    <div>
      <PageHeader
        title={tx('Nearest centre', 'సమీప కేంద్రం')}
        subtitle={tx('Your closest Sachivalayam and MeeSeva centre, with directions — anywhere in Andhra Pradesh.', 'మీకు దగ్గరి సచివాలయం, మీసేవ కేంద్రం — దారితో సహా, ఆంధ్రప్రదేశ్‌లో ఎక్కడైనా.')}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" variant="ink" className="h-12 shrink-0 sm:order-2" onClick={() => void locate()} loading={locating}>
          {!locating && <LocateFixed className="size-5" />}
          {locating ? tx('Finding you…', 'మిమ్మల్ని గుర్తిస్తోంది…') : origin?.source === 'gps' ? tx('Update my location', 'లొకేషన్ రిఫ్రెష్') : tx('Find nearest to me', 'నా దగ్గరివి చూపించు')}
        </Button>
        <PlaceSearch onPick={(h) => goTo({ lat: h.lat, lng: h.lng, label: h.label, source: 'search' })} />
      </div>

      {origin && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
          <MapPin className="size-4 text-ink" />
          {tx('Near', 'సమీపంలో')} <strong className="font-semibold text-ink">{origin.label}</strong>
          {origin.source === 'gps' && origin.accuracy != null && !approximate && <span>· {tx(`accurate to ±${formatDistance(origin.accuracy / 1000)}`, `±${formatDistance(origin.accuracy / 1000)} ఖచ్చితత్వం`)}</span>}
        </p>
      )}
      {approximate && (
        <Notice tone="warn" className="mt-3">
          {tx(
            `Your location is approximate (±${formatDistance((origin!.accuracy ?? 0) / 1000)}). Turn on GPS / Location on your phone and tap “Update my location”, or type your village above.`,
            `మీ లొకేషన్ సుమారుగా ఉంది (±${formatDistance((origin!.accuracy ?? 0) / 1000)}). ఫోన్‌లో GPS ఆన్ చేసి “లొకేషన్ రిఫ్రెష్” నొక్కండి, లేదా పైన మీ గ్రామం టైప్ చేయండి.`,
          )}
        </Notice>
      )}
      {(geo.status === 'denied' || geo.status === 'unavailable') && !origin && (
        <Notice tone="warn" className="mt-3">
          {geo.status === 'denied'
            ? tx('Location permission is off. Tap the 🔒 icon beside the web address → Location → Allow, then tap “Find nearest to me”. Or type your village or town above.', 'లొకేషన్ అనుమతి ఆఫ్‌లో ఉంది. వెబ్ చిరునామా పక్కన 🔒 → Location → Allow నొక్కి “నా దగ్గరివి చూపించు” నొక్కండి. లేదా పైన మీ గ్రామం టైప్ చేయండి.')
            : tx('We couldn’t get your location. Turn on GPS and try again, or type your village or town above.', 'మీ లొకేషన్ రాలేదు. GPS ఆన్ చేసి మళ్లీ ప్రయత్నించండి, లేదా పైన మీ గ్రామం టైప్ చేయండి.')}
        </Notice>
      )}

      {(origin || locating) && (
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <NearestCard kind="sachivalayam" c={nearestSach} loading={loading || locating} radius={radius} origin={origin} />
          <NearestCard kind="meeseva" c={nearestMee} loading={loading || locating} radius={radius} origin={origin} />
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold">{origin ? tx('More nearby', 'దగ్గరలో మరిన్ని') : tx('Centres', 'కేంద్రాలు')}</h2>
          <div className="flex rounded-full bg-paper p-1 ring-1 ring-line lg:hidden" role="tablist">
            {(['list', 'map'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold', view === v ? 'bg-ink text-white' : 'text-ink/70')}>
                {v === 'list' ? <List className="size-4" /> : <MapIcon className="size-4" />}
                {v === 'list' ? tx('List', 'జాబితా') : tx('Map', 'మ్యాప్')}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(
            [
              ['all', tx('All', 'అన్నీ'), counts.all],
              ['sachivalayam', tx('Sachivalayam', 'సచివాలయం'), counts.sachivalayam],
              ['meeseva', tx('MeeSeva', 'మీసేవ'), counts.meeseva],
            ] as [Filter, string, number][]
          ).map(([v, label, n]) => (
            <button key={v} onClick={() => setParam('tab', v === 'all' ? null : v)} className={cn('h-9 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors', filter === v ? 'bg-ink text-white ring-ink' : 'bg-paper text-ink ring-line hover:ring-ink/30')}>
              {label} <span className="ml-1 opacity-60">{n}</span>
            </button>
          ))}
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-paper px-3.5 text-sm font-medium ring-1 ring-line">
            <input type="checkbox" className="size-4 accent-[#1f7a4d]" checked={lessCrowded} onChange={(e) => setParam('filter', e.target.checked ? 'less' : null)} />
            {tx('Less crowded', 'తక్కువ రద్దీ')}
          </label>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className={cn(view === 'map' && 'hidden lg:block')}>
            {osmFailed && (
              <Notice tone="warn" className="mb-3 flex items-center justify-between gap-3">
                <span>{tx('The live map search didn’t answer. Showing saved centres.', 'లైవ్ మ్యాప్ శోధన స్పందించలేదు. సేవ్ చేసిన కేంద్రాలు చూపిస్తున్నాం.')}</span>
                <button onClick={() => setRetry((r) => r + 1)} className="shrink-0 font-semibold underline">{tx('Retry', 'మళ్లీ')}</button>
              </Notice>
            )}
            {loading && list.length === 0 ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}</div>
            ) : list.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-line bg-paper p-6 text-center text-[15px] text-muted">
                {origin ? tx('Nothing found nearby on the map yet.', 'మ్యాప్‌లో దగ్గరలో ఏమీ కనబడలేదు.') : tx('Find your location or search a place to see centres.', 'కేంద్రాలు చూడటానికి లొకేషన్ కనుగొనండి లేదా ప్రాంతం వెతకండి.')}
                {origin && (
                  <a href={googleNearbyUrl(filter === 'meeseva' ? 'meeseva' : 'sachivalayam', origin)} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 font-semibold text-ink underline">
                    <ExternalLink className="size-4" /> {tx('Search on Google Maps', 'Google Mapsలో వెతకండి')}
                  </a>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-[16px] border border-line bg-paper">
                {list.slice(0, shown).map((c) => (
                  <CenterRow key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => select(c)} />
                ))}
              </ul>
            )}
            {list.length > shown && (
              <Button variant="outline" className="mt-3 w-full" onClick={() => setShown((s) => s + PAGE)}>
                {tx(`Show ${Math.min(PAGE, list.length - shown)} more`, `మరో ${Math.min(PAGE, list.length - shown)} చూపించు`)}
              </Button>
            )}
            {origin && list.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {tx('“From map” places come from OpenStreetMap. Crowd levels are set by Sachivalayam staff.', '“మ్యాప్ నుండి” అనేవి OpenStreetMap నుండి. రద్దీ స్థాయిని సచివాలయ సిబ్బంది సెట్ చేస్తారు.')}{' '}
                <a href={googleNearbyUrl(filter === 'meeseva' ? 'meeseva' : 'sachivalayam', origin)} target="_blank" rel="noreferrer" className="font-semibold text-ink underline">
                  {tx('Compare on Google Maps', 'Google Mapsలో పోల్చండి')}
                </a>
              </p>
            )}
          </div>

          <div className={cn('relative h-[60vh] overflow-hidden rounded-[16px] border border-line bg-[#eef0f3] lg:sticky lg:top-6 lg:block lg:h-[calc(100dvh-120px)]', view === 'list' && 'hidden')}>
            <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
              <CenterMap centers={list} you={origin} focus={focus} selected={selected} onSelect={select} onMoved={onMapMoved} lang={lang} />
            </Suspense>
            {moved && (
              <button
                onClick={() => goTo({ ...moved, label: tx('this map area', 'ఈ మ్యాప్ ప్రాంతం'), source: 'map' })}
                className="absolute left-1/2 top-3 z-[500] flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 text-sm font-semibold shadow-[var(--shadow-pop)]"
              >
                <Search className="size-4" /> {tx('Search this area', 'ఈ ప్రాంతంలో వెతకండి')}
              </button>
            )}
            {loading && (
              <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs font-medium shadow">
                <Loader2 className="size-3.5 animate-spin" /> {tx('Searching…', 'వెతుకుతోంది…')}
              </div>
            )}
            <div className="absolute bottom-3 left-3 z-[500] flex gap-3 rounded-full bg-paper/95 px-3 py-1.5 text-xs font-medium shadow">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" />{tx('Sachivalayam', 'సచివాలయం')}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-turmeric" />{tx('MeeSeva', 'మీసేవ')}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BusyPill({ c }: { c: Center }) {
  const { lang } = useLang();
  if (c.kind !== 'sachivalayam' || c.source !== 'db' || !c.busy_level) return null;
  const stale = busyIsStale(c.busy_updated_at);
  const m = BUSY_META[c.busy_level];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', stale ? 'bg-mist text-muted' : m.cls)}>
      <span className={cn('size-1.5 rounded-full', stale ? 'bg-muted' : m.dot)} />
      {stale ? (lang === 'te' ? 'ఈరోజు రద్దీ తెలియదు' : 'Crowd unknown today') : lang === 'te' ? m.te : m.en}
    </span>
  );
}

function NearestCard({ kind, c, loading, radius, origin }: { kind: CenterKind; c?: Center; loading: boolean; radius: number; origin: Origin | null }) {
  const { lang, tx } = useLang();
  const title = kind === 'sachivalayam' ? tx('Nearest Sachivalayam', 'సమీప సచివాలయం') : tx('Nearest MeeSeva centre', 'సమీప మీసేవ కేంద్రం');
  return (
    <div className={cn('flex flex-col rounded-[18px] border-2 bg-paper p-5', kind === 'sachivalayam' ? 'border-ink/15' : 'border-turmeric/45')}>
      <p className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span className={cn('size-2.5 rounded-full', kind === 'sachivalayam' ? 'bg-ink' : 'bg-turmeric')} />
        {title}
      </p>
      {!c && loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <p className="pt-1 text-xs text-muted">{tx(`Searching within ${radius} km…`, `${radius} కి.మీ. లోపు వెతుకుతోంది…`)}</p>
        </div>
      ) : !c ? (
        <div className="mt-2 text-[15px] text-muted">
          {tx('None found within 45 km on the map.', '45 కి.మీ. లోపు మ్యాప్‌లో కనబడలేదు.')}
          <a href={googleNearbyUrl(kind, origin)} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 font-semibold text-ink underline">
            <ExternalLink className="size-4" /> {tx('Search on Google Maps', 'Google Mapsలో వెతకండి')}
          </a>
        </div>
      ) : (
        <>
          <p className="mt-2 text-lg font-semibold leading-snug">{lang === 'te' && c.name_telugu ? c.name_telugu : c.name}</p>
          {c.distanceKm != null && (
            <p className="mt-1 text-[15px]">
              <strong className="font-semibold">{formatDistance(c.distanceKm)}</strong>
              <span className="text-muted"> · {travelEstimate(c.distanceKm, lang)}</span>
            </p>
          )}
          {c.address && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.address}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 empty:hidden">
            <BusyPill c={c} />
            {c.busy_note && !busyIsStale(c.busy_updated_at) && <span className="text-xs italic text-muted">“{c.busy_note}”</span>}
          </div>
          <div className="mt-auto flex gap-2 pt-4">
            <a href={directionsUrl(c)} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-turmeric font-semibold text-ink">
              <Navigation className="size-4" /> {tx('Directions', 'దారి చూపించు')}
            </a>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-line px-4 font-semibold" aria-label={tx('Call', 'కాల్')}>
                <Phone className="size-4" /> <span className="hidden sm:inline">{tx('Call', 'కాల్')}</span>
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CenterRow({ c, selected, onSelect }: { c: Center; selected: boolean; onSelect: () => void }) {
  const { lang, tx } = useLang();
  const hasBusy = c.kind === 'sachivalayam' && c.source === 'db' && !!c.busy_level;
  return (
    <li id={`c-${c.id}`} className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors', selected ? 'bg-turmeric-50' : 'hover:bg-mist')}>
      <button onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', c.kind === 'meeseva' ? 'bg-turmeric' : 'bg-ink')} />
          <span className="truncate font-semibold">{lang === 'te' && c.name_telugu ? c.name_telugu : c.name}</span>
        </div>
        <p className="mt-0.5 truncate pl-4 text-[13px] text-muted">
          {c.distanceKm != null && <span className="font-semibold text-ink">{formatDistance(c.distanceKm)} · </span>}
          {lang === 'te' ? c.typeLabel.te : c.typeLabel.en}
          {c.source === 'osm' && ` · ${tx('from map', 'మ్యాప్ నుండి')}`}
          {c.address && ` · ${c.address}`}
        </p>
        {hasBusy && (
          <div className="mt-1 pl-4">
            <BusyPill c={c} />
          </div>
        )}
      </button>
      {c.phone && (
        <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="grid size-10 shrink-0 place-items-center rounded-full border border-line" aria-label={tx('Call', 'కాల్')}>
          <Phone className="size-4" />
        </a>
      )}
      <a href={directionsUrl(c)} target="_blank" rel="noreferrer" className="grid size-10 shrink-0 place-items-center rounded-full bg-turmeric text-ink" aria-label={tx('Directions', 'దారి')}>
        <Navigation className="size-4" />
      </a>
    </li>
  );
}

function PlaceSearch({ onPick }: { onPick: (h: PlaceHit) => void }) {
  const { lang, tx } = useLang();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noHits, setNoHits] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  // Nominatim asks for at most 1 request a second — debounce generously.
  useEffect(() => {
    if (q.trim().length < 3) {
      setHits([]);
      setNoHits(false);
      return;
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setLoading(true);
      try {
        const r = await geocode(q, lang, ctrl.current.signal);
        setHits(r);
        setNoHits(r.length === 0);
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [q, lang]);

  const pick = (h: PlaceHit) => {
    setQ(h.label);
    setOpen(false);
    onPick(h);
  };

  return (
    <form
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (hits[0]) pick(hits[0]);
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={tx('Or type a village, town or PIN code', 'లేదా గ్రామం, పట్టణం, పిన్ కోడ్ టైప్ చేయండి')}
        className="h-12 w-full rounded-[var(--radius-field)] border border-line bg-paper pl-12 pr-10 text-[15px] focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10"
        aria-label={tx('Search place', 'ప్రాంతం వెతకండి')}
        autoComplete="off"
      />
      {loading ? (
        <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />
      ) : q ? (
        <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-ink-50" aria-label="Clear">
          <X className="size-4" />
        </button>
      ) : null}
      {open && (hits.length > 0 || noHits) && (
        <ul className="absolute inset-x-0 top-[calc(100%+6px)] z-[600] max-h-80 overflow-y-auto rounded-[14px] border border-line bg-paper py-1 shadow-[var(--shadow-pop)]">
          {noHits && <li className="px-4 py-3 text-sm text-muted">{tx('No matching place. Check the spelling or try the mandal name.', 'సరిపోలే ప్రాంతం లేదు. స్పెల్లింగ్ చూడండి లేదా మండలం పేరు ప్రయత్నించండి.')}</li>}
          {hits.map((h, i) => (
            <li key={`${h.lat}${h.lng}${i}`}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-mist">
                <Crosshair className="mt-0.5 size-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.label}</span>
                  <span className="block truncate text-xs text-muted">{h.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
