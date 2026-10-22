import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { useCatalog } from '@/lib/schemes';
import { Button, Card, EmptyState, Field, Input, ListSkeleton, PageHeader, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { AgentReport, AgentReportStatus } from '@/types';

export const REPORT_META: Record<AgentReportStatus, { en: string; te: string; cls: string }> = {
  new: { en: 'Received', te: 'అందింది', cls: 'bg-ink-50 text-ink' },
  reviewing: { en: 'Staff are checking', te: 'సిబ్బంది పరిశీలిస్తున్నారు', cls: 'bg-amber-50 text-amber' },
  closed: { en: 'Closed', te: 'ముగిసింది', cls: 'bg-leaf-50 text-leaf' },
};

const EMPTY = { agent_name: '', agent_phone: '', place: '', amount_asked: '', scheme_id: '', details: '' };

export default function ReportAgent() {
  const { lang, tx } = useLang();
  const catalog = useCatalog();
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<AgentReport[] | null>(null);

  const load = async () => {
    const { data } = await supabase.from('agent_reports').select('*').order('created_at', { ascending: false });
    setMine((data as AgentReport[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.details.trim().length < 5) return toast.error(tx('Please describe what happened.', 'ఏం జరిగిందో వివరించండి.'));
    setSending(true);
    const amount = Number(form.amount_asked.replace(/[^\d]/g, ''));
    const { error } = await supabase.from('agent_reports').insert({
      agent_name: form.agent_name.trim() || null,
      agent_phone: form.agent_phone.replace(/[^\d+]/g, '') || null,
      place: form.place.trim() || null,
      amount_asked: form.amount_asked && Number.isFinite(amount) ? amount : null,
      scheme_id: form.scheme_id || null,
      details: form.details.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(tx('Report sent to Sachivalayam staff. Thank you.', 'రిపోర్ట్ సచివాలయ సిబ్బందికి పంపబడింది. ధన్యవాదాలు.'));
    setForm(EMPTY);
    void load();
  };

  const schemeName = (id: string | null) => {
    const s = id ? catalog.find((c) => c.id === id) : undefined;
    return s ? (lang === 'te' ? s.name.te : s.name.en) : null;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={tx('Report someone asking for money', 'డబ్బు అడిగిన వారిని రిపోర్ట్ చేయండి')}
        subtitle={tx(
          'Applying for government schemes and Sachivalayam services is free. If anyone asked you for money to apply, to approve or to add your name, tell us here. Staff will look into it.',
          'ప్రభుత్వ పథకాలు, సచివాలయ సేవలకు దరఖాస్తు ఉచితం. దరఖాస్తు, ఆమోదం లేదా పేరు చేర్చడం కోసం ఎవరైనా డబ్బు అడిగితే ఇక్కడ చెప్పండి. సిబ్బంది పరిశీలిస్తారు.',
        )}
      />

      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label={tx('Their name (if known)', 'వారి పేరు (తెలిస్తే)')} htmlFor="ra-name">
            <Input id="ra-name" value={form.agent_name} onChange={set('agent_name')} maxLength={120} />
          </Field>
          <Field label={tx('Their phone number (if known)', 'వారి ఫోన్ నంబర్ (తెలిస్తే)')} htmlFor="ra-phone">
            <Input id="ra-phone" inputMode="tel" value={form.agent_phone} onChange={set('agent_phone')} maxLength={15} />
          </Field>
          <Field label={tx('Where did it happen?', 'ఎక్కడ జరిగింది?')} htmlFor="ra-place">
            <Input id="ra-place" value={form.place} onChange={set('place')} maxLength={160} placeholder={tx('Village, ward or office', 'గ్రామం, వార్డు లేదా కార్యాలయం')} />
          </Field>
          <Field label={tx('Amount asked (₹)', 'అడిగిన మొత్తం (₹)')} htmlFor="ra-amount">
            <Input id="ra-amount" inputMode="numeric" value={form.amount_asked} onChange={set('amount_asked')} maxLength={8} />
          </Field>
          <Field label={tx('For which scheme or service?', 'ఏ పథకం లేదా సేవ కోసం?')} htmlFor="ra-scheme" className="sm:col-span-2">
            <Select id="ra-scheme" value={form.scheme_id} onChange={set('scheme_id')}>
              <option value="">{tx('Not sure / other', 'తెలియదు / ఇతర')}</option>
              {catalog
                .filter((c) => c.status !== 'retired')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === 'te' ? c.name.te : c.name.en}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={tx('What happened?', 'ఏం జరిగింది?')} htmlFor="ra-details" className="sm:col-span-2">
            <Textarea id="ra-details" rows={4} value={form.details} onChange={set('details')} maxLength={2000} required />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">
            {tx('Only Sachivalayam staff can see your report. Your name is not shown to the person you report.', 'మీ రిపోర్ట్‌ను సచివాలయ సిబ్బంది మాత్రమే చూడగలరు. మీరు రిపోర్ట్ చేసిన వ్యక్తికి మీ పేరు చూపించబడదు.')}
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" variant="danger" loading={sending}>
              <ShieldAlert className="size-4" /> {tx('Send report', 'రిపోర్ట్ పంపండి')}
            </Button>
          </div>
        </form>
      </Card>

      <h2 className="mt-8 text-lg font-semibold">{tx('Your reports', 'మీ రిపోర్ట్‌లు')}</h2>
      <div className="mt-3">
        {mine === null ? (
          <ListSkeleton rows={2} />
        ) : mine.length === 0 ? (
          <EmptyState title={tx('You have not reported anyone', 'మీరు ఎవరినీ రిపోర్ట్ చేయలేదు')} />
        ) : (
          <ul className="space-y-3">
            {mine.map((r) => (
              <li key={r.id} className="rounded-[18px] border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {[r.agent_name, r.place].filter(Boolean).join(' · ') || tx('Report', 'రిపోర్ట్')}
                    {r.amount_asked != null && <span className="text-muted"> · ₹{r.amount_asked.toLocaleString('en-IN')}</span>}
                  </p>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', (REPORT_META[r.status] ?? REPORT_META.new).cls)}>{tx((REPORT_META[r.status] ?? REPORT_META.new).en, (REPORT_META[r.status] ?? REPORT_META.new).te)}</span>
                </div>
                {schemeName(r.scheme_id) && <p className="mt-1 text-sm text-muted">{schemeName(r.scheme_id)}</p>}
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>
                {r.staff_note && (
                  <p className="mt-2 rounded-[12px] bg-mist px-3 py-2 text-sm">
                    <span className="font-semibold">{tx('Staff: ', 'సిబ్బంది: ')}</span>
                    {r.staff_note}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">{new Date(r.created_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
