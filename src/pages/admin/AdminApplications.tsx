import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ChevronRight, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { EmptyState, ListSkeleton, PageHeader, StatusBadge, Tabs, STATUS_META } from '@/components/ui';
import { daysSince, schemeLabel } from '@/components/ApplicationBits';
import type { Application, ApplicationStatus } from '@/types';

const STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'documents_requested', 'visit_required', 'approved', 'rejected'];
const SELECT = '*, scheme:schemes(name, name_telugu), profile:profiles(full_name, email)';

export default function AdminApplications() {
  const { lang, tx } = useLang();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as ApplicationStatus | null) ?? 'all';
  const [apps, setApps] = useState<Application[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('applications')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data }) => setApps((data as unknown as Application[]) ?? []));

    const ch = supabase
      .channel('admin-apps')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, async (p) => {
        const { data } = await supabase.from('applications').select(SELECT).eq('id', (p.new as Application).id).maybeSingle();
        if (!data) return;
        const a = data as unknown as Application;
        setApps((l) => [a, ...(l ?? []).filter((x) => x.id !== a.id)]);
        toast(tx('New application', 'కొత్త దరఖాస్తు'), { description: `${a.applicant_details?.full_name ?? ''} · ${schemeLabel(a, lang)}` });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications' }, (p) =>
        setApps((l) => l?.map((x) => (x.id === (p.new as Application).id ? { ...x, ...(p.new as Application), scheme: x.scheme, profile: x.profile } : x)) ?? l),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (apps ?? []).forEach((a) => (c[a.status] = (c[a.status] ?? 0) + 1));
    return c;
  }, [apps]);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (apps ?? []).filter(
      (a) =>
        (status === 'all' || a.status === status) &&
        (!n ||
          [a.token_number, a.applicant_details?.full_name, a.applicant_details?.phone, a.profile?.email, a.scheme?.name, a.scheme_id]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(n)),
    );
  }, [apps, status, q]);

  const setStatus = async (a: Application, s: ApplicationStatus) => {
    setBusy(a.id);
    const { error } = await supabase.from('applications').update({ status: s }).eq('id', a.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setApps((l) => l?.map((x) => (x.id === a.id ? { ...x, status: s } : x)) ?? l);
    toast.success(`${a.token_number}: ${lang === 'te' ? STATUS_META[s].te : STATUS_META[s].en}`);
  };

  return (
    <div>
      <PageHeader title={tx('Applications', 'దరఖాస్తులు')} subtitle={tx('Newest first. Open one to message the citizen or request documents.', 'కొత్తవి ముందు. పౌరుడికి సందేశం పంపడానికి లేదా పత్రాలు అడగడానికి తెరవండి.')} />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx('Search name, phone, number or scheme', 'పేరు, ఫోన్, నంబర్ లేదా పథకం వెతకండి')}
          className="h-12 w-full rounded-[var(--radius-field)] border border-line bg-paper pl-12 pr-4 text-[15px] focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10"
        />
      </div>
      <Tabs
        value={status}
        onChange={(v) => setParams(v === 'all' ? {} : { status: v }, { replace: true })}
        tabs={[{ value: 'all' as const, label: tx('All', 'అన్నీ'), count: apps?.length ?? 0 }, ...STATUSES.map((s) => ({ value: s, label: lang === 'te' ? STATUS_META[s].te : STATUS_META[s].en, count: counts[s] ?? 0 }))]}
      />

      <div className="mt-4">
        {apps === null ? (
          <ListSkeleton rows={6} />
        ) : list.length === 0 ? (
          <EmptyState title={tx('Nothing here', 'ఇక్కడ ఏమీ లేదు')} body={status === 'submitted' ? tx('All new applications have been picked up.', 'కొత్త దరఖాస్తులన్నీ తీసుకోబడ్డాయి.') : undefined} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {list.map((a) => {
              const age = daysSince(a.created_at);
              const open = a.status === 'submitted' || a.status === 'under_review';
              return (
                <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/admin/applications/${a.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{a.applicant_details?.full_name || a.profile?.full_name || '—'}</p>
                      <StatusBadge status={a.status} lang={lang} />
                      {open && age >= 7 && <span className="rounded-full bg-kumkum-50 px-2 py-0.5 text-xs font-semibold text-kumkum">{tx(`${age} days old`, `${age} రోజులు`)}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {schemeLabel(a, lang)} · {a.token_number} · {new Date(a.created_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.status === 'submitted' && (
                      <button disabled={busy === a.id} onClick={() => setStatus(a, 'under_review')} className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold hover:border-ink/40">
                        {tx('Start review', 'సమీక్ష ప్రారంభించు')}
                      </button>
                    )}
                    {open && (
                      <>
                        <button disabled={busy === a.id} onClick={() => setStatus(a, 'approved')} className="grid size-9 place-items-center rounded-[10px] bg-leaf text-white" aria-label={tx('Approve', 'ఆమోదించు')} title={tx('Approve', 'ఆమోదించు')}>
                          <Check className="size-4" />
                        </button>
                        <button
                          disabled={busy === a.id}
                          onClick={() => confirm(tx('Reject this application?', 'ఈ దరఖాస్తును తిరస్కరించాలా?')) && setStatus(a, 'rejected')}
                          className="grid size-9 place-items-center rounded-[10px] border border-kumkum/30 text-kumkum"
                          aria-label={tx('Reject', 'తిరస్కరించు')}
                          title={tx('Reject', 'తిరస్కరించు')}
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    )}
                    <Link to={`/admin/applications/${a.id}`} className="grid size-9 place-items-center rounded-[10px] hover:bg-mist" aria-label={tx('Open', 'తెరవండి')}>
                      <ChevronRight className="size-5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
