import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, Bot, ClipboardCheck, FilePen, FileSearch, ListChecks, LocateFixed, MapPin, Send, Sparkles, Stamp } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { canApply, matchSchemes, needsApplication, useCatalog } from '@/lib/schemes';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useUnreadUpdates } from '@/hooks/useUnreadUpdates';
import { loadDbCenters, withDistance, busyIsStale, type Center } from '@/lib/places';
import { MiniProgress, schemeLabel } from '@/components/ApplicationBits';
import { Card, Skeleton, StatusBadge } from '@/components/ui';
import type { Application, ApplicationDraft } from '@/types';

export default function Home() {
  const { lang, tx } = useLang();
  const { user, profile } = useAuth();
  const { unreadByApp } = useUnreadUpdates();
  const geo = useGeolocation('if-granted'); // never prompts on the home screen
  const [apps, setApps] = useState<Application[] | null>(null);
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [nearest, setNearest] = useState<Center | null>(null);
  const { profile: family } = useProfile();
  const entries = useCatalog();
  const matches = useMemo(() => (family ? matchSchemes(entries, family) : []), [entries, family]);
  const eligibleN = matches.filter((m) => m.judgement.verdict === 'eligible' && m.entry.status !== 'announced').length;
  const likelyN = matches.filter((m) => m.judgement.verdict === 'likely' && m.entry.status !== 'announced').length;
  const appliedIds = new Set((apps ?? []).filter((a) => a.status !== 'rejected').map((a) => a.scheme_id));
  const toApply = matches.filter((m) => m.judgement.verdict !== 'no' && canApply(m.entry) && needsApplication(m.entry) && !appliedIds.has(m.entry.id)).length;
  const schemeCount = entries.filter((e) => e.kind === 'scheme').length;
  const serviceCount = entries.filter((e) => e.kind === 'service').length;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('applications').select('id, status, scheme_id, token_number, created_at, updated_at, scheme:schemes(name, name_telugu)').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(20),
      supabase.from('application_drafts').select('id, scheme_id, completion_percentage, updated_at, scheme:schemes(name, name_telugu)').eq('user_id', user.id).order('updated_at', { ascending: false }),
    ]).then(([a, d]) => {
      setApps((a.data as unknown as Application[]) ?? []);
      setDrafts((d.data as unknown as ApplicationDraft[]) ?? []);
    });
  }, [user]);

  useEffect(() => {
    if (!geo.loc) return;
    loadDbCenters(geo.loc, 10).then((rows) => {
      const s = withDistance(rows.filter((r) => r.kind === 'sachivalayam'), geo.loc)[0];
      if (s && (s.distanceKm ?? 99) < 10) setNearest(s);
    });
  }, [geo.loc]);

  const first = (profile?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];
  const needDocs = (apps ?? []).filter((a) => a.status === 'documents_requested');
  const needVisit = (apps ?? []).filter((a) => a.status === 'visit_required');
  const busyNearest = !!nearest?.busy_level && nearest.busy_level !== 'low' && !busyIsStale(nearest.busy_updated_at);
  const hour = new Date().getHours();
  const greet = hour < 12 ? tx('Good morning', 'శుభోదయం') : hour < 17 ? tx('Good afternoon', 'శుభ మధ్యాహ్నం') : tx('Good evening', 'శుభ సాయంత్రం');

  const services = [
    { to: '/eligible', Icon: Sparkles, en: 'My schemes', te: 'నా పథకాలు', den: 'What your family gets', dte: 'మీ కుటుంబానికి వచ్చేవి' },
    { to: '/schemes', Icon: ListChecks, en: 'All schemes', te: 'అన్ని పథకాలు', den: `${schemeCount} schemes`, dte: `${schemeCount} పథకాలు` },
    { to: '/services', Icon: Stamp, en: 'Certificates & services', te: 'ధృవపత్రాలు & సేవలు', den: `${serviceCount} services, fees`, dte: `${serviceCount} సేవలు, రుసుములు` },
    { to: '/nearest-center?near=1', Icon: MapPin, en: 'Nearest centre', te: 'సమీప కేంద్రం', den: 'One tap, with directions', dte: 'ఒక్క నొక్కుతో, దారితో' },
    { to: '/documents', Icon: ClipboardCheck, en: 'My documents', te: 'నా పత్రాలు', den: 'What you have', dte: 'మీ దగ్గర ఉన్నవి' },
    { to: '/track', Icon: FileSearch, en: 'Track by number', te: 'నంబర్‌తో ట్రాక్', den: 'APP-… or SC-…', dte: 'APP-… లేదా SC-…' },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[24px] bg-ink px-6 py-7 text-white sm:px-8 sm:py-9">
        <div className="muggu absolute inset-y-0 right-0 w-1/2 opacity-35 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
        <p className="relative text-[15px] text-white/70">{greet}</p>
        <h1 className="display relative mt-1 text-[30px] sm:text-[40px]">{first || tx('Welcome', 'స్వాగతం')}</h1>
        {family ? (
          <div className="relative mt-4">
            <p className="text-white/75">{tx('Your family qualifies for', 'మీ కుటుంబానికి అర్హత ఉన్నవి')}</p>
            <p className="display-wide flex items-baseline gap-2.5">
              <span className="text-[56px] leading-none text-turmeric">{eligibleN}</span>
              <span className="text-[20px]">{tx(eligibleN === 1 ? 'scheme' : 'schemes', 'పథకాలు')}</span>
              {likelyN > 0 && <span className="text-[15px] text-white/70">{tx(`+ ${likelyN} likely`, `+ ${likelyN} ఉండవచ్చు`)}</span>}
            </p>
          </div>
        ) : (
          <p className="relative mt-2 max-w-[44ch] text-white/80">
            {tx('Answer a few questions once and see every scheme your family qualifies for — then apply for all of them together.', 'కొన్ని ప్రశ్నలకు ఒక్కసారి జవాబివ్వండి — మీ కుటుంబానికి అర్హత ఉన్న అన్ని పథకాలు చూసి, అన్నింటికీ ఒకేసారి దరఖాస్తు చేయండి.')}
          </p>
        )}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {family ? (
            <>
              <Link to="/eligible" className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-turmeric px-4 font-semibold text-ink">
                <Sparkles className="size-4" /> {tx('See my schemes', 'నా పథకాలు చూడండి')}
              </Link>
              {toApply > 0 && (
                <Link to="/apply-all" className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-white/10 px-4 font-semibold text-white ring-1 ring-white/25">
                  <Send className="size-4" /> {tx(`Apply for all ${toApply}`, `మొత్తం ${toApply} కి దరఖాస్తు`)}
                </Link>
              )}
            </>
          ) : (
            <Link to="/eligible" className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-turmeric px-4 font-semibold text-ink">
              <Sparkles className="size-4" /> {tx('Find my schemes', 'నా పథకాలు కనుగొనండి')}
            </Link>
          )}
          <Link to="/nearest-center?near=1" className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 font-semibold text-white/85 hover:text-white">
            <LocateFixed className="size-4" /> {tx('Nearest centre', 'సమీప కేంద్రం')}
          </Link>
        </div>
      </section>

      {/* Things that need the citizen's attention — one list, most urgent first */}
      {(needDocs.length > 0 || needVisit.length > 0 || drafts.length > 0 || busyNearest) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{tx('Needs your attention', 'మీ శ్రద్ధ అవసరం')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {needDocs.map((a) => (
              <AttentionRow key={a.id} to={`/my-applications/${a.id}`} icon={<AlertTriangle className="size-5" />} tone="amber" title={tx('Upload the document staff asked for', 'సిబ్బంది అడిగిన పత్రం అప్‌లోడ్ చేయండి')} sub={schemeLabel(a, lang)} />
            ))}
            {needVisit.map((a) => (
              <AttentionRow key={a.id} to={`/my-applications/${a.id}`} icon={<Building2 className="size-5" />} tone="ink" title={tx('Visit your Sachivalayam to verify', 'ధృవీకరణకు మీ సచివాలయానికి వెళ్లండి')} sub={schemeLabel(a, lang)} />
            ))}
            {drafts.slice(0, 2).map((d) => (
              <AttentionRow
                key={d.id}
                to={`/schemes/${d.scheme_id}/apply`}
                icon={<FilePen className="size-5" />}
                tone="ink"
                title={tx('Finish your application', 'మీ దరఖాస్తు పూర్తి చేయండి')}
                sub={`${d.scheme ? (lang === 'te' ? d.scheme.name_telugu : d.scheme.name) : d.scheme_id} · ${d.completion_percentage}% ${tx('done', 'పూర్తి')}`}
              />
            ))}
            {busyNearest && nearest && (
              <AttentionRow
                to="/nearest-center?filter=less&tab=sachivalayam"
                icon={<MapPin className="size-5" />}
                tone="red"
                title={nearest.busy_level === 'busy' ? tx('Your nearest Sachivalayam is very busy', 'మీ సమీప సచివాలయం చాలా రద్దీగా ఉంది') : tx('Your nearest Sachivalayam has a queue', 'మీ సమీప సచివాలయంలో క్యూ ఉంది')}
                sub={`${lang === 'te' && nearest.name_telugu ? nearest.name_telugu : nearest.name} · ${tx('see less crowded ones', 'తక్కువ రద్దీవి చూడండి')}`}
              />
            )}
          </ul>
        </section>
      )}

      {/* Recent applications */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">{tx('Your applications', 'మీ దరఖాస్తులు')}</h2>
          {apps && apps.length > 0 && (
            <Link to="/my-applications" className="text-sm font-semibold underline decoration-turmeric decoration-2 underline-offset-2">
              {tx('See all', 'అన్నీ చూడండి')}
            </Link>
          )}
        </div>
        {apps === null ? (
          <Skeleton className="h-[180px]" />
        ) : apps.length === 0 ? (
          <Card className="p-5 text-[15px] text-muted">
            {tx('Nothing yet. When you apply for a scheme, its progress shows up here.', 'ఇంకా ఏమీ లేదు. పథకానికి దరఖాస్తు చేసిన తర్వాత దాని పురోగతి ఇక్కడ కనిపిస్తుంది.')}
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {apps.slice(0, 4).map((a) => (
              <Link key={a.id} to={`/my-applications/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-mist">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{schemeLabel(a, lang)}</p>
                    {unreadByApp[a.id] ? <span className="size-2 shrink-0 rounded-full bg-kumkum" aria-label="New update" /> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{a.token_number}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <StatusBadge status={a.status} lang={lang} />
                    <MiniProgress status={a.status} />
                  </div>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* Services */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{tx('Services', 'సేవలు')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {services.map(({ to, Icon, en, te, den, dte }) => (
            <Link key={to} to={to} className="group rounded-[16px] border border-line bg-paper p-4 transition-colors hover:border-ink/30">
              <Icon className="size-6 text-turmeric-deep" />
              <p className="mt-3 font-semibold leading-tight">{tx(en, te)}</p>
              <p className="mt-0.5 text-sm text-muted">{tx(den, dte)}</p>
            </Link>
          ))}
        </div>
      </section>

      <button
        onClick={() => window.dispatchEvent(new Event('sachibot:open'))}
        className="flex w-full items-center gap-4 rounded-[18px] bg-ink-50 p-5 text-left hover:bg-ink-100"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-turmeric">
          <Bot className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">{tx('Not sure what to do?', 'ఏం చేయాలో తెలియడం లేదా?')}</span>
          <span className="text-sm text-muted">{tx('Ask SachiBot in Telugu or English — type or speak.', 'సచిబాట్‌ను తెలుగు లేదా ఇంగ్లీష్‌లో అడగండి — టైప్ చేయండి లేదా మాట్లాడండి.')}</span>
        </span>
        <ArrowRight className="size-5" />
      </button>
    </div>
  );
}

function AttentionRow({ to, icon, tone, title, sub }: { to: string; icon: React.ReactNode; tone: 'amber' | 'ink' | 'red'; title: string; sub: string }) {
  const iconCls = { amber: 'bg-amber-50 text-turmeric-deep', ink: 'bg-ink-50 text-ink', red: 'bg-kumkum-50 text-kumkum' }[tone];
  return (
    <li>
      <Link to={to} className="flex items-center gap-4 p-4 hover:bg-mist">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${iconCls}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{title}</span>
          <span className="block truncate text-sm text-muted">{sub}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
