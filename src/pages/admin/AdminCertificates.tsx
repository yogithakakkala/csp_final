import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { CERTIFICATE_SERVICES } from '@/data/certificateServices';
import { Button, Card, EmptyState, Field, Input, ListSkeleton, PageHeader, Select, Tabs } from '@/components/ui';
import type { CertificateRequest, CertificateStatus } from '@/types';

const META: Record<CertificateStatus, { en: string; te: string; cls: string }> = {
  pending: { en: 'Processing', te: 'ప్రాసెస్‌లో', cls: 'bg-ink-50 text-ink' },
  ready: { en: 'Ready to collect', te: 'సిద్ధం', cls: 'bg-leaf-50 text-leaf' },
  collected: { en: 'Collected', te: 'తీసుకున్నారు', cls: 'bg-mist text-muted' },
};

function token() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 90000;
  return `SC-${new Date().getFullYear()}-${10000 + n}`;
}

export default function AdminCertificates() {
  const { lang, tx } = useLang();
  const [rows, setRows] = useState<CertificateRequest[] | null>(null);
  const [tab, setTab] = useState<CertificateStatus | 'all'>('pending');
  const [form, setForm] = useState({ citizen_name: '', certificate_type: CERTIFICATE_SERVICES[0].name, contact_phone: '', contact_email: '' });
  const [saving, setSaving] = useState(false);

  const load = () =>
    supabase
      .from('certificate_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .then(({ data }) => setRows((data as CertificateRequest[]) ?? []));
  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let t = token();
    let { data, error } = await supabase.from('certificate_requests').insert({ ...form, token_number: t, status: 'pending', contact_email: form.contact_email || null, contact_phone: form.contact_phone || null }).select().single();
    if (error && /duplicate/i.test(error.message)) {
      t = token();
      ({ data, error } = await supabase.from('certificate_requests').insert({ ...form, token_number: t, status: 'pending' }).select().single());
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    setRows((r) => [data as CertificateRequest, ...(r ?? [])]);
    setForm((f) => ({ ...f, citizen_name: '', contact_phone: '', contact_email: '' }));
    toast.success(`${tx('Token created', 'టోకెన్ సృష్టించబడింది')}: ${t}`, { action: { label: tx('Copy', 'కాపీ'), onClick: () => navigator.clipboard?.writeText(t) } });
  };

  const setStatus = async (r: CertificateRequest, status: CertificateStatus) => {
    const { error } = await supabase.from('certificate_requests').update({ status }).eq('id', r.id);
    if (error) return toast.error(error.message);
    setRows((l) => l?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? l);
  };

  const list = (rows ?? []).filter((r) => tab === 'all' || r.status === tab);

  return (
    <div>
      <PageHeader title={tx('Certificates', 'ధృవపత్రాలు')} subtitle={tx('Create a token for a walk-in certificate request. The citizen tracks it on “Track by number”.', 'కౌంటర్ వద్ద ధృవపత్ర అభ్యర్థనకు టోకెన్ సృష్టించండి. పౌరుడు “నంబర్‌తో ట్రాక్”లో చూడవచ్చు.')} />

      <Card className="mb-6 p-5">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={tx('Citizen name', 'పౌరుని పేరు')} htmlFor="cn">
            <Input id="cn" required value={form.citizen_name} onChange={(e) => setForm({ ...form, citizen_name: e.target.value })} />
          </Field>
          <Field label={tx('Certificate', 'ధృవపత్రం')} htmlFor="ct">
            <Select id="ct" value={form.certificate_type} onChange={(e) => setForm({ ...form, certificate_type: e.target.value })}>
              {CERTIFICATE_SERVICES.map((c) => (
                <option key={c.id} value={c.name}>{lang === 'te' ? c.name_telugu : c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={tx('Mobile (optional)', 'మొబైల్ (ఐచ్ఛికం)')} htmlFor="cp">
            <Input id="cp" inputMode="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </Field>
          <Field label={tx('Email for updates (optional)', 'అప్‌డేట్‌ల ఇమెయిల్ (ఐచ్ఛికం)')} htmlFor="ce">
            <Input id="ce" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" loading={saving}>{tx('Create token', 'టోకెన్ సృష్టించు')}</Button>
          </div>
        </form>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ...(['pending', 'ready', 'collected'] as CertificateStatus[]).map((s) => ({ value: s, label: lang === 'te' ? META[s].te : META[s].en, count: (rows ?? []).filter((r) => r.status === s).length })),
          { value: 'all' as const, label: tx('All', 'అన్నీ'), count: rows?.length ?? 0 },
        ]}
      />
      <div className="mt-4">
        {rows === null ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <EmptyState title={tx('No requests here', 'ఇక్కడ అభ్యర్థనలు లేవు')} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {list.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => { void navigator.clipboard?.writeText(r.token_number); toast.success(tx('Copied', 'కాపీ అయింది')); }} className="flex items-center gap-1 font-semibold tabular-nums hover:underline">
                      {r.token_number} <Copy className="size-3.5 text-muted" />
                    </button>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${META[r.status].cls}`}>{lang === 'te' ? META[r.status].te : META[r.status].en}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {r.citizen_name} · {r.certificate_type}
                    {r.contact_phone ? ` · ${r.contact_phone}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'pending' && <Button size="sm" variant="success" onClick={() => setStatus(r, 'ready')}>{tx('Mark ready', 'సిద్ధం')}</Button>}
                  {r.status === 'ready' && <Button size="sm" variant="outline" onClick={() => setStatus(r, 'collected')}>{tx('Mark collected', 'తీసుకున్నారు')}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
