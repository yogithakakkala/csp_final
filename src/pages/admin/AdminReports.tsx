import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { useCatalog } from '@/lib/schemes';
import { Button, EmptyState, ListSkeleton, PageHeader, Tabs, Textarea } from '@/components/ui';
import { REPORT_META } from '@/pages/ReportAgent';
import { cn } from '@/lib/utils';
import type { AgentReport, AgentReportStatus } from '@/types';

type Row = AgentReport & { reporter?: { full_name: string | null; email: string | null } | null };

export default function AdminReports() {
  const { lang, tx } = useLang();
  const catalog = useCatalog();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('agent_reports').select('*, reporter:profiles(full_name, email)').order('created_at', { ascending: false });
    if (error) {
      // Older databases without the profile link: load the reports alone.
      const plain = await supabase.from('agent_reports').select('*').order('created_at', { ascending: false });
      setRows((plain.data as Row[]) ?? []);
      return;
    }
    setRows((data as unknown as Row[]) ?? []);
  };

  useEffect(() => {
    void load();
    const ch = supabase.channel('admin-reports').on('postgres_changes', { event: '*', schema: 'public', table: 'agent_reports' }, () => void load()).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const save = async (r: Row, status: AgentReportStatus) => {
    setBusy(r.id);
    const staff_note = (notes[r.id] ?? r.staff_note ?? '').trim() || null;
    const { error } = await supabase.from('agent_reports').update({ status, staff_note }).eq('id', r.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === 'closed' ? tx('Report closed', 'రిపోర్ట్ ముగించబడింది') : tx('Saved', 'సేవ్ అయింది'));
    void load();
  };

  const list = (rows ?? []).filter((r) => (tab === 'open' ? r.status !== 'closed' : r.status === 'closed'));
  const open = (rows ?? []).filter((r) => r.status !== 'closed').length;
  const schemeName = (id: string | null) => {
    const s = id ? catalog.find((c) => c.id === id) : undefined;
    return s ? (lang === 'te' ? s.name.te : s.name.en) : null;
  };

  return (
    <div>
      <PageHeader
        title={tx('Fake-agent reports', 'నకిలీ ఏజెంట్ రిపోర్ట్‌లు')}
        subtitle={tx('Citizens report anyone who asked them for money to apply. Check each one, add a note the citizen can read, and close it.', 'దరఖాస్తు కోసం డబ్బు అడిగిన వారిని పౌరులు రిపోర్ట్ చేస్తారు. ప్రతిదాన్ని పరిశీలించి, పౌరుడు చదవగలిగే గమనిక రాసి ముగించండి.')}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'open', label: tx('Open', 'తెరిచినవి'), count: open },
          { value: 'closed', label: tx('Closed', 'ముగిసినవి'), count: (rows ?? []).length - open },
        ]}
      />
      <div className="mt-4">
        {rows === null ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <EmptyState title={tab === 'open' ? tx('No open reports', 'తెరిచిన రిపోర్ట్‌లు లేవు') : tx('Nothing closed yet', 'ఇంకా ముగిసినవి లేవు')} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {list.map((r) => (
              <li key={r.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {r.agent_name || tx('Name not given', 'పేరు ఇవ్వలేదు')}
                      {r.agent_phone && (
                        <a href={`tel:${r.agent_phone}`} className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-muted underline">
                          <Phone className="size-3.5" /> {r.agent_phone}
                        </a>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {[r.place, schemeName(r.scheme_id), r.amount_asked != null ? `₹${r.amount_asked.toLocaleString('en-IN')} ${tx('asked', 'అడిగారు')}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', (REPORT_META[r.status] ?? REPORT_META.new).cls)}>{tx((REPORT_META[r.status] ?? REPORT_META.new).en, (REPORT_META[r.status] ?? REPORT_META.new).te)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[15px]">{r.details}</p>
                <p className="mt-2 text-xs text-muted">
                  {tx('Reported by', 'రిపోర్ట్ చేసినవారు')} {r.reporter?.full_name || tx('a citizen', 'ఒక పౌరుడు')}
                  {r.reporter?.email ? ` · ${r.reporter.email}` : ''} · {new Date(r.created_at).toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Textarea
                    rows={2}
                    placeholder={tx('Note for the citizen (what was done)', 'పౌరుడి కోసం గమనిక (ఏం చేశారు)')}
                    value={notes[r.id] ?? r.staff_note ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    {r.status !== 'closed' && (
                      <Button size="sm" variant="outline" loading={busy === r.id} onClick={() => save(r, 'reviewing')}>
                        {tx('Mark checking', 'పరిశీలనలో')}
                      </Button>
                    )}
                    <Button size="sm" variant={r.status === 'closed' ? 'outline' : 'success'} loading={busy === r.id} onClick={() => save(r, r.status === 'closed' ? 'reviewing' : 'closed')}>
                      {r.status === 'closed' ? tx('Reopen', 'మళ్లీ తెరవండి') : tx('Close', 'ముగించండి')}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
