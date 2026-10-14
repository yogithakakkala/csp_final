import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { Button, EmptyState, ListSkeleton, PageHeader, Sheet, Tabs, Textarea } from '@/components/ui';
import { daysSince, schemeLabel } from '@/components/ApplicationBits';
import { cn } from '@/lib/utils';
import type { Application, Grievance, GrievanceStatus } from '@/types';

type Row = Grievance & { application?: Application | null };

const META: Record<GrievanceStatus, { en: string; te: string; cls: string }> = {
  raised: { en: 'New', te: 'కొత్తది', cls: 'bg-kumkum-50 text-kumkum' },
  acknowledged: { en: 'Acknowledged', te: 'గుర్తించబడింది', cls: 'bg-amber-50 text-amber' },
  resolved: { en: 'Resolved', te: 'పరిష్కరించబడింది', cls: 'bg-leaf-50 text-leaf' },
};

export default function AdminGrievances() {
  const { lang, tx } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [resolving, setResolving] = useState<Row | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('grievances')
      .select('*, application:applications(id, status, scheme_id, token_number, updated_at, created_at, applicant_details, scheme:schemes(name, name_telugu))')
      .order('raised_at', { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
  };

  useEffect(() => {
    void load();
    const ch = supabase.channel('admin-griev').on('postgres_changes', { event: '*', schema: 'public', table: 'grievances' }, () => void load()).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const update = async (g: Row, patch: Partial<Grievance>) => {
    setBusy(g.id);
    const { error } = await supabase.from('grievances').update(patch).eq('id', g.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((l) => l?.map((x) => (x.id === g.id ? { ...x, ...patch } : x)) ?? l);
    return true;
  };

  const list = (rows ?? [])
    .filter((g) => (tab === 'open' ? g.status !== 'resolved' : g.status === 'resolved'))
    .sort((a, b) => (tab === 'open' ? new Date(a.application?.updated_at ?? 0).getTime() - new Date(b.application?.updated_at ?? 0).getTime() : 0));

  return (
    <div>
      <PageHeader title={tx('Grievances', 'ఫిర్యాదులు')} subtitle={tx('Raised by citizens whose application had no update for 7+ days. Oldest first.', '7+ రోజులు అప్‌డేట్ లేని పౌరులు చేసిన ఫిర్యాదులు. పాతవి ముందు.')} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'open', label: tx('Open', 'తెరిచినవి'), count: (rows ?? []).filter((g) => g.status !== 'resolved').length },
          { value: 'resolved', label: tx('Resolved', 'పరిష్కరించినవి'), count: (rows ?? []).filter((g) => g.status === 'resolved').length },
        ]}
      />
      <div className="mt-4">
        {rows === null ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <EmptyState title={tab === 'open' ? tx('No open grievances', 'తెరిచిన ఫిర్యాదులు లేవు') : tx('Nothing resolved yet', 'ఇంకా పరిష్కరించినవి లేవు')} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {list.map((g) => {
              const a = g.application;
              return (
                <li key={g.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{a?.applicant_details?.full_name ?? '—'}</p>
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', META[g.status].cls)}>{lang === 'te' ? META[g.status].te : META[g.status].en}</span>
                        {a && g.status !== 'resolved' && <span className="text-sm font-semibold text-kumkum">{tx(`${daysSince(a.updated_at)} days without update`, `${daysSince(a.updated_at)} రోజులుగా అప్‌డేట్ లేదు`)}</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {a ? `${schemeLabel(a, lang)} · ${a.token_number}` : ''} · {tx('raised', 'నమోదు')} {new Date(g.raised_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                      {g.reason && <p className="mt-2 max-w-[65ch] rounded-[12px] bg-mist px-3 py-2 text-[15px]">“{g.reason}”</p>}
                      {g.admin_response && <p className="mt-2 text-sm text-leaf">{tx('Reply', 'సమాధానం')}: {g.admin_response}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {a && (
                        <Link to={`/admin/applications/${a.id}`} className="inline-flex h-9 items-center rounded-[10px] border border-line px-3 text-sm font-semibold hover:border-ink/40">
                          {tx('Open application', 'దరఖాస్తు తెరవండి')}
                        </Link>
                      )}
                      {g.status === 'raised' && (
                        <Button size="sm" variant="outline" loading={busy === g.id} onClick={() => update(g, { status: 'acknowledged', acknowledged_at: new Date().toISOString() }).then((ok) => ok && toast.success(tx('Citizen notified', 'పౌరుడికి తెలియజేశాం')))}>
                          {tx('Acknowledge', 'గుర్తించు')}
                        </Button>
                      )}
                      {g.status !== 'resolved' && (
                        <Button size="sm" variant="success" onClick={() => setResolving(g)}>
                          {tx('Resolve', 'పరిష్కరించు')}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet
        open={!!resolving}
        onClose={() => setResolving(null)}
        title={tx('Resolve grievance', 'ఫిర్యాదు పరిష్కరించండి')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(null)}>{tx('Cancel', 'రద్దు')}</Button>
            <Button
              variant="success"
              loading={!!resolving && busy === resolving.id}
              onClick={async () => {
                if (!resolving) return;
                const ok = await update(resolving, { status: 'resolved', resolved_at: new Date().toISOString(), admin_response: reply.trim() || null });
                if (ok) {
                  toast.success(tx('Resolved. Citizen notified.', 'పరిష్కరించబడింది. పౌరుడికి తెలియజేశాం.'));
                  setResolving(null);
                  setReply('');
                }
              }}
            >
              {tx('Mark resolved', 'పరిష్కరించినట్లు గుర్తించు')}
            </Button>
          </>
        }
      >
        <label className="text-sm font-semibold" htmlFor="reply">{tx('Message to the citizen (optional)', 'పౌరుడికి సందేశం (ఐచ్ఛికం)')}</label>
        <Textarea id="reply" rows={4} className="mt-1.5" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tx('What was done, or what happens next', 'ఏం చేశారు లేదా తర్వాత ఏం జరుగుతుంది')} />
      </Sheet>
    </div>
  );
}
