import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertOctagon, ChevronRight, FilePen, FolderOpen, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadUpdates } from '@/hooks/useUnreadUpdates';
import { MiniProgress, daysSince, schemeLabel } from '@/components/ApplicationBits';
import { Button, ButtonLink, EmptyState, ListSkeleton, PageHeader, Sheet, StatusBadge, Textarea } from '@/components/ui';
import type { Application, ApplicationDraft, Grievance } from '@/types';
import NotificationToggle from '@/components/NotificationToggle';

export default function MyApplications() {
  const { lang, tx } = useLang();
  const { user } = useAuth();
  const { unreadByApp } = useUnreadUpdates();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [escalate, setEscalate] = useState<Application | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const load = async () => {
      const [a, d, g] = await Promise.all([
        supabase.from('applications').select('*, scheme:schemes(name, name_telugu)').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('application_drafts').select('*, scheme:schemes(name, name_telugu)').eq('user_id', uid).order('updated_at', { ascending: false }),
        supabase.from('grievances').select('*').eq('user_id', uid),
      ]);
      setApps((a.data as unknown as Application[]) ?? []);
      setDrafts((d.data as unknown as ApplicationDraft[]) ?? []);
      setGrievances((g.data as Grievance[]) ?? []);
    };
    void load();
    const ch = supabase
      .channel('my-apps-' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications', filter: `user_id=eq.${uid}` }, (p) =>
        setApps((list) => list?.map((x) => (x.id === (p.new as Application).id ? { ...x, ...(p.new as Application), scheme: x.scheme } : x)) ?? list),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grievances', filter: `user_id=eq.${uid}` }, (p) => {
        const g = p.new as Grievance;
        if (p.eventType === 'UPDATE' && g.status === 'acknowledged') toast.success(tx('Staff acknowledged your grievance', 'సిబ్బంది మీ ఫిర్యాదును గుర్తించారు'));
        if (p.eventType === 'UPDATE' && g.status === 'resolved') toast.success(tx('Your grievance was resolved', 'మీ ఫిర్యాదు పరిష్కరించబడింది'));
        void supabase.from('grievances').select('*').eq('user_id', uid).then(({ data }) => setGrievances((data as Grievance[]) ?? []));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeDraft = async (d: ApplicationDraft) => {
    setDrafts((l) => l.filter((x) => x.id !== d.id));
    const { error } = await supabase.from('application_drafts').delete().eq('id', d.id);
    if (error) toast.error(error.message);
  };

  const submitGrievance = async () => {
    if (!escalate || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from('grievances')
      .insert({ application_id: escalate.id, user_id: user.id, reason: reason.trim() || null })
      .select()
      .single();
    setSending(false);
    if (error) {
      toast.error(/duplicate|unique/i.test(error.message) ? tx('A grievance is already open for this application.', 'ఈ దరఖాస్తుకు ఇప్పటికే ఫిర్యాదు ఉంది.') : error.message);
      return;
    }
    setGrievances((g) => [...g, data as Grievance]);
    toast.success(tx('Grievance sent. Staff have been alerted.', 'ఫిర్యాదు పంపబడింది. సిబ్బందికి తెలియజేశాం.'));
    setEscalate(null);
    setReason('');
  };

  const openGrievance = (id: string) => grievances.find((g) => g.application_id === id && g.status !== 'resolved');

  return (
    <div>
      <PageHeader
        title={tx('My applications', 'నా దరఖాస్తులు')}
        subtitle={tx('Updates appear here as soon as staff act on them.', 'సిబ్బంది చర్య తీసుకున్న వెంటనే అప్‌డేట్‌లు ఇక్కడ కనిపిస్తాయి.')}
        action={<ButtonLink to="/schemes" variant="outline" size="sm">{tx('New application', 'కొత్త దరఖాస్తు')}</ButtonLink>}
      />

      <NotificationToggle variant="card" className="mb-6" />

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{tx('Not finished yet', 'ఇంకా పూర్తి కాలేదు')}</h2>
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {drafts.map((d) => (
              <div key={d.id} className="w-[260px] shrink-0 rounded-[18px] border border-dashed border-turmeric-deep/40 bg-turmeric-50 p-4 sm:w-auto">
                <div className="flex items-start gap-3">
                  <FilePen className="mt-0.5 size-5 shrink-0 text-turmeric-deep" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.scheme ? (lang === 'te' ? d.scheme.name_telugu : d.scheme.name) : d.scheme_id}</p>
                    <p className="text-sm text-muted">
                      {d.completion_percentage}% · {tx('saved', 'సేవ్')} {new Date(d.updated_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-turmeric-deep" style={{ width: `${d.completion_percentage}%` }} />
                </div>
                <div className="mt-3 flex gap-2">
                  <ButtonLink to={`/schemes/${d.scheme_id}/apply`} size="sm" className="flex-1">
                    {tx('Continue', 'కొనసాగించు')}
                  </ButtonLink>
                  <button onClick={() => removeDraft(d)} className="grid size-9 place-items-center rounded-[10px] border border-line bg-paper text-muted hover:text-kumkum" aria-label={tx('Delete draft', 'ముసాయిదా తొలగించు')}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {apps === null ? (
        <ListSkeleton />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-5" />}
          title={tx('No applications yet', 'ఇంకా దరఖాస్తులు లేవు')}
          body={tx('Find a scheme that fits your family and apply in a few minutes.', 'మీ కుటుంబానికి సరిపోయే పథకం కనుగొని కొన్ని నిమిషాల్లో దరఖాస్తు చేయండి.')}
          action={<ButtonLink to="/eligible">{tx('Find my schemes', 'నా పథకాలు కనుగొనండి')}</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => {
            const stale = (a.status === 'submitted' || a.status === 'under_review') && daysSince(a.updated_at) >= 7;
            const g = openGrievance(a.id);
            return (
              <li key={a.id} className="overflow-hidden rounded-[18px] border border-line bg-paper">
                <Link to={`/my-applications/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-mist sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{schemeLabel(a, lang)}</p>
                      {unreadByApp[a.id] ? (
                        <span className="rounded-full bg-kumkum px-2 py-0.5 text-[11px] font-bold text-white">{tx('New', 'కొత్త')}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {a.token_number} · {new Date(a.created_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <StatusBadge status={a.status} lang={lang} />
                      <MiniProgress status={a.status} />
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" />
                </Link>
                {a.status === 'documents_requested' && (
                  <Link to={`/my-applications/${a.id}`} className="block border-t border-turmeric/40 bg-turmeric-50 px-5 py-2.5 text-sm font-semibold">
                    {tx('Staff asked for a document — tap to upload', 'సిబ్బంది పత్రం అడిగారు — అప్‌లోడ్ చేయడానికి నొక్కండి')}
                  </Link>
                )}
                {stale && (
                  <div className="flex items-center justify-between gap-3 border-t border-line bg-mist px-5 py-2.5 text-sm">
                    {g ? (
                      <span className="font-medium text-muted">
                        {g.status === 'acknowledged' ? tx('Grievance acknowledged by staff', 'ఫిర్యాదును సిబ్బంది గుర్తించారు') : tx('Grievance raised — waiting for staff', 'ఫిర్యాదు నమోదైంది — సిబ్బంది కోసం వేచి ఉంది')}
                      </span>
                    ) : (
                      <>
                        <span className="text-muted">{tx(`No update for ${daysSince(a.updated_at)} days`, `${daysSince(a.updated_at)} రోజులుగా అప్‌డేట్ లేదు`)}</span>
                        <button onClick={() => setEscalate(a)} className="flex shrink-0 items-center gap-1.5 font-semibold text-kumkum">
                          <AlertOctagon className="size-4" /> {tx('Escalate', 'ఫిర్యాదు చేయి')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={!!escalate}
        onClose={() => setEscalate(null)}
        title={tx('Raise a grievance', 'ఫిర్యాదు చేయండి')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEscalate(null)}>
              {tx('Cancel', 'రద్దు')}
            </Button>
            <Button variant="danger" onClick={submitGrievance} loading={sending}>
              {tx('Send grievance', 'ఫిర్యాదు పంపండి')}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">
          {tx('This alerts the officer at your Sachivalayam to look at your application urgently. You’ll be notified when they respond.', 'ఇది మీ సచివాలయ అధికారికి మీ దరఖాస్తును వెంటనే చూడమని తెలియజేస్తుంది. స్పందించినప్పుడు మీకు తెలియజేస్తాం.')}
        </p>
        <label className="mt-4 block text-sm font-semibold" htmlFor="reason">
          {tx('Anything you want them to know? (optional)', 'వారికి ఏమైనా చెప్పాలా? (ఐచ్ఛికం)')}
        </label>
        <Textarea id="reason" rows={3} className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Sheet>
    </div>
  );
}
