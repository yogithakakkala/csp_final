import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Crosshair, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { BUSY_META, busyIsStale, directionsUrl, type BusyLevel } from '@/lib/places';
import { Button, EmptyState, Field, Input, ListSkeleton, PageHeader, Sheet, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';

type Kind = 'sachivalayam_centers' | 'meeseva_centers';
interface Row {
  id: string;
  name: string;
  name_telugu: string | null;
  address: string;
  area: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  services?: string[];
  busy_level?: BusyLevel | null;
  busy_updated_at?: string | null;
  busy_note?: string | null;
  osm_id?: string | null;
}
const PAGE = 30;
const BLANK = { name: '', name_telugu: '', address: '', area: '', district: '', latitude: '', longitude: '', phone: '', services: '' };

export default function AdminCenters() {
  const { lang, tx } = useLang();
  const [table, setTable] = useState<Kind>('sachivalayam_centers');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    let query = supabase.from(table).select('*', { count: 'exact' });
    const n = q.trim().replace(/[%,()]/g, ' ');
    if (n) query = query.or(`name.ilike.%${n}%,area.ilike.%${n}%,district.ilike.%${n}%,address.ilike.%${n}%`);
    const { data, count, error } = await query.order('district').order('name').range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setTotal(count ?? 0);
  }, [table, q, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const setBusy = async (r: Row, level: BusyLevel) => {
    const patch = { busy_level: level, busy_updated_at: new Date().toISOString(), busy_note: (notes[r.id] ?? r.busy_note ?? '').slice(0, 60) || null };
    setRows((l) => l?.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) ?? l);
    const { error } = await supabase.from('sachivalayam_centers').update(patch).eq('id', r.id);
    if (error) {
      toast.error(error.message);
      void load();
    } else toast.success(`${r.name}: ${lang === 'te' ? BUSY_META[level].te : BUSY_META[level].en}`);
  };

  const bulk = async (level: BusyLevel) => {
    if (!rows?.length || !confirm(tx(`Set all ${rows.length} centres on this page to “${BUSY_META[level].en}”?`, `ఈ పేజీలోని ${rows.length} కేంద్రాలను “${BUSY_META[level].te}”గా మార్చాలా?`))) return;
    const { error } = await supabase
      .from('sachivalayam_centers')
      .update({ busy_level: level, busy_updated_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    if (error) toast.error(error.message);
    else void load();
  };

  const openEdit = (r: Row | 'new') => {
    setEditing(r);
    setForm(
      r === 'new'
        ? BLANK
        : {
            name: r.name,
            name_telugu: r.name_telugu ?? '',
            address: r.address,
            area: r.area ?? '',
            district: r.district ?? '',
            latitude: String(r.latitude),
            longitude: String(r.longitude),
            phone: r.phone ?? '',
            services: (r.services ?? []).join(', '),
          },
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!(lat > 12 && lat < 20.5 && lng > 76 && lng < 85.5)) return toast.error(tx('Coordinates are outside Andhra Pradesh. Check latitude / longitude.', 'అక్షాంశాలు ఆంధ్రప్రదేశ్ బయట ఉన్నాయి.'));
    setSaving(true);
    const row: Record<string, unknown> = {
      name: form.name.trim(),
      name_telugu: form.name_telugu.trim() || form.name.trim(),
      address: form.address.trim(),
      area: form.area.trim() || form.district.trim(),
      district: form.district.trim(),
      latitude: lat,
      longitude: lng,
      phone: form.phone.trim() || null,
    };
    if (table === 'meeseva_centers') row.services = form.services.split(',').map((s) => s.trim()).filter(Boolean);
    const res = editing === 'new' ? await supabase.from(table).insert(row) : await supabase.from(table).update(row).eq('id', (editing as Row).id);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(tx('Saved', 'సేవ్ అయింది'));
    setEditing(null);
    void load();
  };

  const remove = async (r: Row) => {
    if (!confirm(tx(`Delete ${r.name}?`, `${r.name} తొలగించాలా?`))) return;
    const { error } = await supabase.from(table).delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    setRows((l) => l?.filter((x) => x.id !== r.id) ?? l);
  };

  const fillMyLocation = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => toast.error(tx('Location not available', 'లొకేషన్ అందుబాటులో లేదు')),
      { enableHighAccuracy: true, timeout: 15000 },
    );

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <PageHeader
        title={tx('Centres & crowd', 'కేంద్రాలు & రద్దీ')}
        subtitle={tx('Set how busy your Sachivalayam is so citizens can pick a less crowded one. Crowd info older than 8 hours is shown as “not updated”.', 'పౌరులు తక్కువ రద్దీ కేంద్రం ఎంచుకునేలా మీ సచివాలయ రద్దీని సెట్ చేయండి. 8 గంటల కంటే పాత సమాచారం “అప్‌డేట్ కాలేదు” అని చూపబడుతుంది.')}
        action={
          <Button size="sm" onClick={() => openEdit('new')}>
            <Plus className="size-4" /> {tx('Add centre', 'కేంద్రం జోడించు')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={table}
          onChange={(v) => {
            setTable(v);
            setPage(0);
          }}
          tabs={[
            { value: 'sachivalayam_centers', label: tx('Sachivalayams', 'సచివాలయాలు') },
            { value: 'meeseva_centers', label: tx('MeeSeva', 'మీసేవ') },
          ]}
        />
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={tx('Search name, area or district', 'పేరు, ప్రాంతం లేదా జిల్లా')}
            className="h-10 w-full rounded-full border border-line bg-paper pl-10 pr-4 text-sm focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      {table === 'sachivalayam_centers' && rows && rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{tx('Set all on this page:', 'ఈ పేజీలో అన్నిటికీ:')}</span>
          {(Object.keys(BUSY_META) as BusyLevel[]).map((l) => (
            <button key={l} onClick={() => bulk(l)} className={cn('rounded-full px-3 py-1 font-semibold', BUSY_META[l].cls)}>
              {lang === 'te' ? BUSY_META[l].te : BUSY_META[l].en}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {rows === null ? (
          <ListSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<MapPin className="size-5" />} title={tx('No centres match', 'సరిపోలే కేంద్రాలు లేవు')} body={tx('Add one, or import every AP centre from OpenStreetMap with `npm run import:centers` (see README).', 'ఒకటి జోడించండి, లేదా README చూసి `npm run import:centers`తో దిగుమతి చేయండి.')} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {rows.map((r) => {
              const stale = busyIsStale(r.busy_updated_at);
              return (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{lang === 'te' && r.name_telugu ? r.name_telugu : r.name}</p>
                      <p className="text-sm text-muted">
                        {[r.area, r.district].filter(Boolean).join(', ')}
                        {r.phone ? ` · ${r.phone}` : ''}
                        {r.osm_id ? ` · ${tx('imported', 'దిగుమతి')}` : ''}
                      </p>
                      {table === 'meeseva_centers' && (r.services ?? []).length > 0 && <p className="mt-1 text-xs text-muted">{r.services!.join(' · ')}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={directionsUrl(r)} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-full hover:bg-mist" aria-label={tx('Map', 'మ్యాప్')}>
                        <MapPin className="size-4" />
                      </a>
                      <button onClick={() => openEdit(r)} className="grid size-9 place-items-center rounded-full hover:bg-mist" aria-label={tx('Edit', 'సవరించు')}>
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => remove(r)} className="grid size-9 place-items-center rounded-full text-kumkum hover:bg-kumkum-50" aria-label={tx('Delete', 'తొలగించు')}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {table === 'sachivalayam_centers' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(Object.keys(BUSY_META) as BusyLevel[]).map((l) => {
                        const on = r.busy_level === l && !stale;
                        return (
                          <button
                            key={l}
                            onClick={() => setBusy(r, l)}
                            aria-pressed={on}
                            className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 transition-colors', on ? `${BUSY_META[l].cls} ring-current` : 'bg-paper text-muted ring-line hover:text-ink')}
                          >
                            <span className={cn('size-2 rounded-full', BUSY_META[l].dot)} />
                            {lang === 'te' ? BUSY_META[l].te : BUSY_META[l].en}
                          </button>
                        );
                      })}
                      <input
                        placeholder={tx('Note, e.g. “Aadhaar server slow”', 'గమనిక, ఉదా. “ఆధార్ సర్వర్ నెమ్మదిగా ఉంది”')}
                        defaultValue={r.busy_note ?? ''}
                        maxLength={60}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        className="h-9 min-w-[200px] flex-1 rounded-full border border-line px-3.5 text-sm focus:border-ink focus:outline-none"
                      />
                      <span className="text-xs text-muted">
                        {r.busy_updated_at && !stale
                          ? `${tx('Updated', 'అప్‌డేట్')} ${new Date(r.busy_updated_at).toLocaleTimeString(lang === 'te' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' })}`
                          : tx('Not updated today', 'ఈరోజు అప్‌డేట్ కాలేదు')}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {total > PAGE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">
              {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} {tx('of', '/')} {total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tx('Previous', 'మునుపటి')}</Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>{tx('Next', 'తదుపరి')}</Button>
            </div>
          </div>
        )}
      </div>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? tx('Add centre', 'కేంద్రం జోడించు') : tx('Edit centre', 'కేంద్రం సవరించు')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>{tx('Cancel', 'రద్దు')}</Button>
            <Button form="center-form" type="submit" loading={saving}>{tx('Save', 'సేవ్')}</Button>
          </>
        }
      >
        <form id="center-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label={tx('Name (English)', 'పేరు (ఇంగ్లీష్)')} className="sm:col-span-2"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={tx('Name (Telugu)', 'పేరు (తెలుగు)')} className="sm:col-span-2"><Input value={form.name_telugu} onChange={(e) => setForm({ ...form, name_telugu: e.target.value })} /></Field>
          <Field label={tx('Address', 'చిరునామా')} className="sm:col-span-2"><Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label={tx('Area / mandal', 'ప్రాంతం / మండలం')}><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
          <Field label={tx('District', 'జిల్లా')}><Input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
          <Field label={tx('Latitude', 'అక్షాంశం')}><Input required inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field>
          <Field label={tx('Longitude', 'రేఖాంశం')}><Input required inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={fillMyLocation}>
              <Crosshair className="size-4" /> {tx('I’m at this centre — use my location', 'నేను ఈ కేంద్రంలో ఉన్నాను — నా లొకేషన్ వాడండి')}
            </Button>
          </div>
          <Field label={tx('Phone', 'ఫోన్')}><Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          {table === 'meeseva_centers' && (
            <Field label={tx('Services (comma separated)', 'సేవలు (కామాలతో)')} className="sm:col-span-2"><Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="Caste Certificate, Income Certificate, Aadhaar Update" /></Field>
          )}
        </form>
      </Sheet>
    </div>
  );
}

