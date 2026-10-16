import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { invalidateSchemes, loadSchemes } from '@/lib/schemes';
import { Button, Field, Input, ListSkeleton, Notice, PageHeader, Segmented, Sheet, Tabs, Textarea } from '@/components/ui';
import { getItem, STATUS_LABEL, pick } from '@/data/catalog';
import { cn } from '@/lib/utils';
import type { Caste, Scheme } from '@/types';
import { askConfirm } from '@/components/ConfirmDialog';

const CASTES: Caste[] = ['SC', 'ST', 'BC', 'OC', 'EWS', 'Minority'];
interface Form {
  id: string;
  name: string;
  name_telugu: string;
  description: string;
  docs: string[];
  max_annual_income: string;
  min_age: string;
  max_age: string;
  castes: Caste[];
  women: '' | 'yes' | 'no';
}
const BLANK: Form = { id: '', name: '', name_telugu: '', description: '', docs: [], max_annual_income: '', min_age: '', max_age: '', castes: [], women: 'no' };

export default function AdminSchemes() {
  const { lang, tx } = useLang();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<'new' | Scheme | null>(null);
  const [f, setF] = useState<Form>(BLANK);
  const [doc, setDoc] = useState('');
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<'scheme' | 'service'>('scheme');

  const load = async () => {
    invalidateSchemes();
    const [list, apps] = await Promise.all([loadSchemes(true), supabase.from('applications').select('scheme_id').limit(10000)]);
    setSchemes(list);
    const c: Record<string, number> = {};
    for (const a of (apps.data as { scheme_id: string }[]) ?? []) c[a.scheme_id] = (c[a.scheme_id] ?? 0) + 1;
    setCounts(c);
  };
  useEffect(() => {
    void load();
  }, []);

  const open = (s: 'new' | Scheme) => {
    setEditing(s);
    if (s === 'new') return setF(BLANK);
    const r = s.eligibility_rules;
    setF({
      id: s.id,
      name: s.name,
      name_telugu: s.name_telugu,
      description: s.description,
      docs: [...s.required_documents],
      max_annual_income: String(r.max_annual_income ?? r.max_income ?? ''),
      min_age: String(r.min_age ?? r.age_min ?? ''),
      max_age: String(r.max_age ?? r.age_max ?? ''),
      castes: (r.castes ?? (r.caste_categories as Caste[]) ?? []).filter((c) => CASTES.includes(c)),
      women: r.gender_female ? 'yes' : 'no',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const isNew = editing === 'new';
    const base = isNew ? {} : { ...(editing as Scheme).eligibility_rules };
    const rules: Record<string, unknown> = { ...base };
    const setNum = (k: string, v: string) => (v ? (rules[k] = Number(v)) : delete rules[k]);
    setNum('max_annual_income', f.max_annual_income);
    setNum('min_age', f.min_age);
    setNum('max_age', f.max_age);
    delete rules.max_income;
    delete rules.age_min;
    delete rules.age_max;
    delete rules.caste_categories;
    if (f.castes.length) rules.castes = f.castes;
    else delete rules.castes;
    if (f.women === 'yes') rules.gender_female = true;
    else delete rules.gender_female;
    const id = isNew ? f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : f.id;
    const { error } = await supabase.from('schemes').upsert({
      id,
      name: f.name.trim(),
      name_telugu: f.name_telugu.trim() || f.name.trim(),
      description: f.description.trim(),
      required_documents: f.docs,
      eligibility_rules: rules,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? tx('Scheme added', 'పథకం జోడించబడింది') : tx('Scheme updated', 'పథకం అప్‌డేట్ అయింది'));
    setEditing(null);
    void load();
  };

  const remove = async (s: Scheme) => {
    if (counts[s.id]) return toast.error(tx('This scheme has applications, so it can’t be deleted.', 'ఈ పథకానికి దరఖాస్తులు ఉన్నాయి, తొలగించలేము.'));
    if (!(await askConfirm({ title: tx(`Delete ${s.name}?`, `${s.name_telugu} తొలగించాలా?`), confirmLabel: tx('Delete', 'తొలగించు'), tone: 'danger' }))) return;
    const { error } = await supabase.from('schemes').delete().eq('id', s.id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div>
      <PageHeader
        title={tx('Schemes & services', 'పథకాలు & సేవలు')}
        subtitle={tx('Built-in schemes and services come with Telugu text and eligibility rules. You can change their document list, or add your own schemes. Changes show up for citizens immediately.', 'అంతర్నిర్మిత పథకాలు, సేవలకు తెలుగు పాఠం, అర్హత నిబంధనలు ఉన్నాయి. పత్రాల జాబితా మార్చవచ్చు లేదా కొత్త పథకాలు జోడించవచ్చు. మార్పులు పౌరులకు వెంటనే కనిపిస్తాయి.')}
        action={<Button size="sm" onClick={() => open('new')}><Plus className="size-4" /> {tx('Add scheme', 'పథకం జోడించు')}</Button>}
      />
      {schemes && (
        <div className="mb-4">
          <Tabs
            value={kind}
            onChange={setKind}
            tabs={[
              { value: 'scheme', label: tx('Schemes', 'పథకాలు'), count: schemes.filter((x) => !x.id.startsWith('svc-')).length },
              { value: 'service', label: tx('Services', 'సేవలు'), count: schemes.filter((x) => x.id.startsWith('svc-')).length },
            ]}
          />
        </div>
      )}
      {schemes === null ? (
        <ListSkeleton rows={8} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
          {schemes.filter((x) => x.id.startsWith('svc-') === (kind === 'service')).map((s) => (
            <li key={s.id} className="flex items-center gap-4 p-4">
              <span className="text-2xl">{s.icon}</span>
              <button onClick={() => open(s)} className="min-w-0 flex-1 text-left">
                <p className="font-semibold hover:underline">{lang === 'te' ? s.name_telugu : s.name}</p>
                <p className="truncate text-sm text-muted">
                  {getItem(s.id) ? pick(STATUS_LABEL[getItem(s.id)!.status], lang) : tx('Added by staff', 'సిబ్బంది జోడించారు')} · {s.required_documents.length} {tx('documents', 'పత్రాలు')} · {counts[s.id] ?? 0} {tx('applications', 'దరఖాస్తులు')}
                </p>
              </button>
              <Button size="sm" variant="outline" onClick={() => open(s)}>{tx('Edit', 'సవరించు')}</Button>
              <button onClick={() => remove(s)} className="grid size-9 place-items-center rounded-full text-kumkum hover:bg-kumkum-50" aria-label={tx('Delete', 'తొలగించు')}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? tx('New scheme', 'కొత్త పథకం') : tx('Edit scheme', 'పథకం సవరించు')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>{tx('Cancel', 'రద్దు')}</Button>
            <Button form="scheme-form" type="submit" loading={saving}>{tx('Save', 'సేవ్')}</Button>
          </>
        }
      >
        <form id="scheme-form" onSubmit={save} className="space-y-4">
          <Field label={tx('Name (English)', 'పేరు (ఇంగ్లీష్)')}><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={tx('Name (Telugu)', 'పేరు (తెలుగు)')}><Input value={f.name_telugu} onChange={(e) => setF({ ...f, name_telugu: e.target.value })} /></Field>
          <Field label={tx('Description', 'వివరణ')}><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          {editing !== 'new' && editing && getItem(editing.id) ? (
            <Notice>{tx('Eligibility rules for this built-in item are maintained in src/data/catalog.ts, so the “My schemes” check stays accurate. Citizens see its Telugu and English text from there too — here you can change the document list.', 'ఈ అంతర్నిర్మిత అంశం అర్హత నిబంధనలు, తెలుగు/ఇంగ్లీష్ పాఠం src/data/catalog.ts లో ఉంటాయి — ఇక్కడ పత్రాల జాబితా మార్చవచ్చు.')}</Notice>
          ) : (<>
          <div className="grid grid-cols-3 gap-3">
            <Field label={tx('Max income / yr (₹)', 'గరిష్ఠ ఆదాయం (₹)')}><Input inputMode="numeric" value={f.max_annual_income} onChange={(e) => setF({ ...f, max_annual_income: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label={tx('Min age', 'కనీస వయసు')}><Input inputMode="numeric" value={f.min_age} onChange={(e) => setF({ ...f, min_age: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label={tx('Max age', 'గరిష్ఠ వయసు')}><Input inputMode="numeric" value={f.max_age} onChange={(e) => setF({ ...f, max_age: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
          <Field label={tx('Only for these castes (none = everyone)', 'ఈ కులాలకు మాత్రమే (ఏదీ లేకపోతే అందరూ)')}>
            <div className="flex flex-wrap gap-2">
              {CASTES.map((c) => {
                const on = f.castes.includes(c);
                return (
                  <button key={c} type="button" onClick={() => setF({ ...f, castes: on ? f.castes.filter((x) => x !== c) : [...f.castes, c] })} className={cn('h-9 rounded-full px-3.5 text-sm font-semibold ring-1', on ? 'bg-ink text-white ring-ink' : 'ring-line')}>
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={tx('Women only?', 'మహిళలకు మాత్రమేనా?')}>
            <Segmented value={f.women} onChange={(v) => setF({ ...f, women: v })} options={[{ value: 'yes', label: tx('Yes', 'అవును') }, { value: 'no', label: tx('No', 'కాదు') }]} />
          </Field>
          </>)}
          <Field label={tx('Required documents', 'అవసరమైన పత్రాలు')}>
            <ul className="mb-2 space-y-1.5">
              {f.docs.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-[10px] bg-mist px-3 py-2 text-[15px]">
                  {d}
                  <button type="button" onClick={() => setF({ ...f, docs: f.docs.filter((_, j) => j !== i) })} aria-label="Remove"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                placeholder={tx('Add a document', 'పత్రం జోడించండి')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (doc.trim()) setF({ ...f, docs: [...f.docs, doc.trim()] });
                    setDoc('');
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => { if (doc.trim()) setF({ ...f, docs: [...f.docs, doc.trim()] }); setDoc(''); }}>{tx('Add', 'జోడించు')}</Button>
            </div>
          </Field>
        </form>
      </Sheet>
    </div>
  );
}
