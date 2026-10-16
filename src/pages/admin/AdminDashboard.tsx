import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { Card, PageHeader, Skeleton, StatusBadge, STATUS_META } from '@/components/ui';
import { schemeLabel } from '@/components/ApplicationBits';
import { getCachedSchemes } from '@/lib/schemes';
import type { Application, ApplicationStatus } from '@/types';

const STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'documents_requested', 'approved', 'rejected'];

interface Stats {
  byStatus: Record<string, number>;
  total: number;
  today: number;
  week: number;
  griev: number;
  avgDays: number | null;
  citizens: number;
  recent: Application[];
  topSchemes: [string, number][];
}

export default function AdminDashboard() {
  const { lang, tx } = useLang();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const [apps, griev, citizens, recent] = await Promise.all([
        supabase.from('applications').select('status, scheme_id, created_at, updated_at').limit(5000),
        supabase.from('grievances').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_staff', false),
        supabase.from('applications').select('id, status, scheme_id, token_number, created_at, updated_at, applicant_details, scheme:schemes(name, name_telugu)').order('updated_at', { ascending: false }).limit(8),
      ]);
      const rows = (apps.data as { status: string; scheme_id: string; created_at: string; updated_at: string }[]) ?? [];
      const byStatus: Record<string, number> = {};
      const schemeCount: Record<string, number> = {};
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      let today = 0;
      let week = 0;
      let doneDays = 0;
      let doneN = 0;
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        schemeCount[r.scheme_id] = (schemeCount[r.scheme_id] ?? 0) + 1;
        if (new Date(r.created_at) >= startToday) today++;
        if (r.created_at >= since) week++;
        if (r.status === 'approved' || r.status === 'rejected') {
          doneDays += (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 86400000;
          doneN++;
        }
      }
      setS({
        byStatus,
        total: rows.length,
        today,
        week,
        griev: griev.count ?? 0,
        avgDays: doneN ? doneDays / doneN : null,
        citizens: citizens.count ?? 0,
        recent: (recent.data as unknown as Application[]) ?? [],
        topSchemes: Object.entries(schemeCount).sort((a, b) => b[1] - a[1]).slice(0, 5),
      });
    };
    void load();
    const ch = supabase.channel('admin-dash').on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, load).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!s)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );

  const waiting = (s.byStatus.submitted ?? 0) + (s.byStatus.under_review ?? 0);
  const max = Math.max(1, ...STATUSES.map((x) => s.byStatus[x] ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader title={tx('Overview', 'అవలోకనం')} subtitle={tx('Live — updates as citizens apply.', 'ప్రత్యక్షం — పౌరులు దరఖాస్తు చేయగానే అప్‌డేట్.')} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat to="/admin/applications?status=submitted" label={tx('Waiting for action', 'చర్య కోసం వేచి ఉన్నవి')} value={waiting} accent />
        <Stat to="/admin/grievances" label={tx('Open grievances', 'తెరిచి ఉన్న ఫిర్యాదులు')} value={s.griev} danger={s.griev > 0} />
        <Stat label={tx('New today · this week', 'ఈరోజు · ఈ వారం')} value={`${s.today} · ${s.week}`} />
        <Stat label={tx('Avg. days to decide', 'నిర్ణయానికి సగటు రోజులు')} value={s.avgDays == null ? '—' : s.avgDays.toFixed(1)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <p className="font-semibold">{tx('Applications by status', 'స్థితి వారీగా దరఖాస్తులు')}</p>
          <p className="text-sm text-muted">{tx(`${s.total} in total · ${s.citizens} registered citizens`, `మొత్తం ${s.total} · ${s.citizens} నమోదైన పౌరులు`)}</p>
          <ul className="mt-5 space-y-3">
            {STATUSES.map((st) => {
              const n = s.byStatus[st] ?? 0;
              return (
                <li key={st}>
                  <Link to={`/admin/applications?status=${st}`} className="group grid grid-cols-[140px_1fr_40px] items-center gap-3">
                    <span className="text-[15px] group-hover:underline">{lang === 'te' ? STATUS_META[st].te : STATUS_META[st].en}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-ink-50">
                      <span className={`block h-full rounded-full ${STATUS_META[st].dot}`} style={{ width: `${(n / max) * 100}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <p className="font-semibold">{tx('Most requested schemes', 'ఎక్కువగా అడిగిన పథకాలు')}</p>
          {s.topSchemes.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted">{tx('No applications yet.', 'ఇంకా దరఖాస్తులు లేవు.')}</p>
          ) : (
            <ol className="mt-4 space-y-2.5">
              {s.topSchemes.map(([id, n]) => (
                <li key={id} className="flex items-center justify-between gap-3 text-[15px]">
                  <span className="truncate">{(() => { const sc = getCachedSchemes().find((x) => x.id === id); return sc ? (lang === 'te' ? sc.name_telugu : sc.name) : id; })()}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-semibold">{tx('Recent activity', 'ఇటీవలి కార్యకలాపం')}</p>
          <Link to="/admin/applications" className="flex items-center gap-1 text-sm font-semibold">
            {tx('All applications', 'అన్ని దరఖాస్తులు')} <ArrowRight className="size-4" />
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {s.recent.map((a) => (
            <li key={a.id}>
              <Link to={`/admin/applications/${a.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-mist">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.applicant_details?.full_name || '—'}</p>
                  <p className="truncate text-sm text-muted">{schemeLabel(a, lang)} · {a.token_number}</p>
                </div>
                <StatusBadge status={a.status} lang={lang} />
              </Link>
            </li>
          ))}
          {s.recent.length === 0 && <li className="px-5 py-6 text-[15px] text-muted">{tx('Nothing yet.', 'ఇంకా ఏమీ లేదు.')}</li>}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, to, accent, danger }: { label: string; value: number | string; to?: string; accent?: boolean; danger?: boolean }) {
  const body = (
    <div className={`h-full rounded-[18px] p-5 ${accent ? 'bg-ink text-white' : danger ? 'bg-kumkum-50 ring-1 ring-kumkum/25' : 'bg-paper ring-1 ring-line'}`}>
      <p className={`text-sm ${accent ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className={`display mt-1 text-[34px] leading-none ${accent ? 'text-turmeric' : danger ? 'text-kumkum' : ''}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to} className="block transition-transform hover:-translate-y-0.5">{body}</Link> : body;
}
