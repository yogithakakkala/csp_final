import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ChevronDown, ClipboardList, FileCheck2, Pencil, Send, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserDocuments } from '@/hooks/useUserDocuments';
import { answeredCount, PROFILE_FIELDS } from '@/lib/profile';
import { canApply, matchSchemes, needsApplication, useCatalog } from '@/lib/schemes';
import { combineDocs, INFO_ONLY } from '@/lib/combine';
import { docKey, ISSUER } from '@/lib/docs';
import { pick } from '@/data/catalog';
import ProfileForm from '@/components/ProfileForm';
import { MatchRow, VERDICT } from '@/components/SchemeBits';
import { Button, ButtonLink, Card, FullPageLoader } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function MySchemes() {
  const { lang, tx } = useLang();
  const { user } = useAuth();
  const { profile, ready, save } = useProfile();
  const entries = useCatalog();
  const userDocs = useUserDocuments();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showNo, setShowNo] = useState(false);
  const editing = params.get('edit') !== null || (ready && !profile);

  const matches = useMemo(() => matchSchemes(entries, profile), [entries, profile]);
  const open = matches.filter((m) => m.entry.status !== 'announced');
  const eligible = open.filter((m) => m.judgement.verdict === 'eligible');
  const likely = open.filter((m) => m.judgement.verdict === 'likely');
  const no = open.filter((m) => m.judgement.verdict === 'no');
  const upcoming = matches.filter((m) => m.entry.status === 'announced' && m.judgement.verdict !== 'no');
  const applicable = [...eligible, ...likely].filter((m) => canApply(m.entry) && needsApplication(m.entry));
  const docs = useMemo(() => combineDocs(applicable.map((m) => m.entry)), [applicable]);

  if (!ready) return <FullPageLoader />;

  if (editing)
    return (
      <div>
        {!profile && (
          <header className="mx-auto mb-6 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-turmeric-50 px-3 py-1 text-sm font-semibold text-ink">
              <Sparkles className="size-4 text-turmeric-deep" /> {tx('About 2 minutes · answer once', 'సుమారు 2 నిమిషాలు · ఒక్కసారే')}
            </span>
            <h1 className="display mt-3 text-[28px] leading-tight sm:text-[36px]">{tx('Find every scheme your family qualifies for', 'మీ కుటుంబానికి అర్హత ఉన్న అన్ని పథకాలు')}</h1>
            <p className="mt-2 text-[15px] text-muted">
              {tx(
                `A few questions about your family, the same ones Sachivalayam staff check. We compare them against all ${entries.filter((e) => e.kind === 'scheme').length} schemes at once.`,
                `సచివాలయ సిబ్బంది అడిగే ప్రశ్నలే. వాటిని ${entries.filter((e) => e.kind === 'scheme').length} పథకాలతో ఒకేసారి పోలుస్తాం.`,
              )}
            </p>
          </header>
        )}
        <ProfileForm
          initial={profile}
          saving={saving}
          onDone={async (p) => {
            setSaving(true);
            await save(p);
            setSaving(false);
            setParams({}, { replace: true });
            window.scrollTo({ top: 0 });
            toast.success(tx('Saved. Here are your schemes.', 'సేవ్ అయింది. మీ పథకాలు ఇవిగో.'));
          }}
        />
      </div>
    );

  const unanswered = PROFILE_FIELDS.length - answeredCount(profile);

  return (
    <div>
      {/* Result header */}
      <section className="muggu-faint -mx-4 mb-6 border-b border-line bg-paper px-4 py-6 sm:mx-0 sm:rounded-[var(--radius-card)] sm:border sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-muted">{tx('Your family qualifies for', 'మీ కుటుంబానికి అర్హత ఉన్నవి')}</p>
            <p className="display-wide mt-1 flex items-baseline gap-3 text-ink">
              <span className="text-[64px] leading-none sm:text-[80px]">{eligible.length}</span>
              <span className="text-[22px] sm:text-[26px]">{tx(eligible.length === 1 ? 'scheme' : 'schemes', 'పథకాలు')}</span>
            </p>
            {likely.length > 0 && (
              <p className="mt-2 text-[15px]">
                {tx(`+ ${likely.length} more likely — confirm a detail or two`, `+ మరో ${likely.length} పథకాలకు అర్హత ఉండవచ్చు — ఒకటి రెండు వివరాలు నిర్ధారించాలి`)}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setParams({ edit: '' })}>
            <Pencil className="size-4" /> {tx('Edit answers', 'జవాబులు మార్చండి')}
          </Button>
        </div>
        {applicable.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => navigate(user ? '/apply-all' : '/login', user ? undefined : { state: { redirectTo: '/apply-all' } })}>
              <Send className="size-5" /> {tx(`Apply for all ${applicable.length}`, `మొత్తం ${applicable.length} కి దరఖాస్తు`)}
            </Button>
            <span className="text-sm text-muted">{tx('One form, documents uploaded once.', 'ఒకే ఫారం, పత్రాలు ఒక్కసారే.')}</span>
          </div>
        )}
        {unanswered > 4 && (
          <p className="mt-4 text-sm text-muted">
            {tx(`${unanswered} questions skipped — answering them turns “likely” into a clear yes or no.`, `${unanswered} ప్రశ్నలు వదిలేశారు — జవాబిస్తే “అర్హత ఉండవచ్చు” స్పష్టమవుతుంది.`)}{' '}
            <button onClick={() => setParams({ edit: '' })} className="font-semibold text-ink underline">
              {tx('Answer now', 'ఇప్పుడు జవాబివ్వండి')}
            </button>
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Group verdict="eligible" count={eligible.length} empty={tx('No scheme is a clear yes yet. Check the “likely” list below.', 'ఇంకా స్పష్టంగా అర్హత ఉన్న పథకం లేదు. కింది జాబితా చూడండి.')}>
            {eligible.map((m) => <MatchRow key={m.entry.id} m={m} />)}
          </Group>
          {likely.length > 0 && (
            <Group verdict="likely" count={likely.length} sub={tx('One or two things to confirm at your Sachivalayam.', 'సచివాలయంలో ఒకటి రెండు విషయాలు నిర్ధారించాలి.')}>
              {likely.map((m) => <MatchRow key={m.entry.id} m={m} showReasons />)}
            </Group>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-1 text-lg font-semibold">{tx('Coming soon for you', 'త్వరలో మీకోసం')}</h2>
              <p className="mb-3 text-sm text-muted">{tx('Announced by the government but not open yet. We will show Apply here once they start.', 'ప్రభుత్వం ప్రకటించింది కానీ ఇంకా ప్రారంభం కాలేదు. ప్రారంభమైతే ఇక్కడ దరఖాస్తు చూపిస్తాం.')}</p>
              <Card className="divide-y divide-line overflow-hidden">{upcoming.map((m) => <MatchRow key={m.entry.id} m={m} />)}</Card>
            </section>
          )}
          {no.length > 0 && (
            <section>
              <button onClick={() => setShowNo((v) => !v)} className="flex w-full items-center justify-between rounded-[14px] border border-line bg-paper px-4 py-3 text-left" aria-expanded={showNo}>
                <span className="font-semibold">
                  {tx(`Not eligible (${no.length})`, `అర్హత లేనివి (${no.length})`)} <span className="font-normal text-muted">— {tx('see why', 'కారణం చూడండి')}</span>
                </span>
                <ChevronDown className={cn('size-5 transition-transform', showNo && 'rotate-180')} />
              </button>
              {showNo && <Card className="mt-2 divide-y divide-line overflow-hidden">{no.map((m) => <MatchRow key={m.entry.id} m={m} showReasons />)}</Card>}
            </section>
          )}
          <p className="text-xs text-muted">
            {tx('Based on your answers and current government rules. Sachivalayam staff make the final decision after verification.', 'మీ జవాబులు, ప్రస్తుత ప్రభుత్వ నిబంధనల ఆధారంగా. ధృవీకరణ తర్వాత సచివాలయ సిబ్బందే తుది నిర్ణయం తీసుకుంటారు.')}
          </p>
        </div>

        {/* Combined document checklist */}
        <aside>
          <Card className="p-5 lg:sticky lg:top-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-5 text-turmeric-deep" />
              <h2 className="text-lg font-semibold">{tx('Documents for all of them', 'అన్నింటికీ కావలసిన పత్రాలు')}</h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              {tx(`${docs.length} documents cover all ${applicable.length} applications.`, `${applicable.length} దరఖాస్తులకు ${docs.length} పత్రాలు చాలు.`)}
            </p>
            <ul className="mt-4 space-y-3">
              {docs.map((d) => {
                const got = !INFO_ONLY.has(d.key) && user && userDocs.docs.some((u) => docKey(u.document_type) === d.key);
                const n = new Set(d.names.map((x) => x.entryId)).size;
                const issuer = ISSUER[d.key];
                return (
                  <li key={d.key} className="flex items-start gap-2.5">
                    <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', got ? 'bg-leaf text-white' : 'border-2 border-ink/15')}>
                      {got && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 text-[15px] leading-snug">
                      {pick(d.label, lang)}
                      <span className="block text-xs text-muted">
                        {d.conditional ? tx('only if it applies to you · ', 'వర్తిస్తే మాత్రమే · ') : ''}
                        {tx(`needed for ${n}`, `${n} పథకాలకు`)}
                        {!got && issuer ? ` · ${pick(issuer, lang)}` : ''}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {user ? (
              <ButtonLink to="/documents" variant="outline" size="sm" className="mt-5 w-full">
                <FileCheck2 className="size-4" /> {tx('Upload to My documents', 'నా పత్రాలలో అప్‌లోడ్')}
              </ButtonLink>
            ) : (
              <p className="mt-5 text-sm text-muted">
                <Link to="/signup" className="font-semibold text-ink underline">
                  {tx('Create a free account', 'ఉచిత ఖాతా తెరవండి')}
                </Link>{' '}
                {tx('to keep documents ready and apply from your phone.', 'పత్రాలు సిద్ధంగా ఉంచుకుని ఫోన్ నుండే దరఖాస్తు చేయడానికి.')}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Group({ verdict, count, sub, empty, children }: { verdict: keyof typeof VERDICT; count: number; sub?: string; empty?: string; children: React.ReactNode }) {
  const { lang } = useLang();
  const v = VERDICT[verdict];
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <v.Icon className={cn('size-5', v.cls.split(' ').find((c) => c.startsWith('text-')))} />
        {lang === 'te' ? v.te : v.en} <span className="font-normal text-muted">({count})</span>
      </h2>
      {sub && <p className="mb-3 text-sm text-muted">{sub}</p>}
      {count === 0 && empty ? <p className="rounded-[14px] border border-dashed border-ink/15 p-4 text-sm text-muted">{empty}</p> : <Card className="mt-2 divide-y divide-line overflow-hidden">{children}</Card>}
    </section>
  );
}
