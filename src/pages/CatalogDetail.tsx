import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, ExternalLink, FileText, IndianRupee, MapPin, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserDocuments } from '@/hooks/useUserDocuments';
import { judge } from '@/lib/rules';
import { canApply, needsApplication, useCatalog } from '@/lib/schemes';
import { docKey, ISSUER } from '@/lib/docs';
import { INFO_ONLY } from '@/lib/combine';
import { CATEGORY, pick } from '@/data/catalog';
import { StatusTag, VerdictBadge } from '@/components/SchemeBits';
import ListenButton from '@/components/ListenButton';
import { ButtonLink, Card, Notice } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function CatalogDetail({ kind }: { kind: 'scheme' | 'service' }) {
  const { id = '' } = useParams();
  const { lang, tx } = useLang();
  const { user } = useAuth();
  const { profile } = useProfile();
  const userDocs = useUserDocuments();
  const entries = useCatalog();
  const e = entries.find((x) => x.id === id);
  const back = kind === 'service' ? '/services' : '/schemes';

  if (!e)
    return (
      <Notice tone="error">
        {tx('We couldn’t find that.', 'అది కనబడలేదు.')}{' '}
        <Link to={back} className="font-semibold underline">
          {kind === 'service' ? tx('See all services', 'అన్ని సేవలు') : tx('See all schemes', 'అన్ని పథకాలు')}
        </Link>
      </Notice>
    );

  const other = lang === 'te' ? 'en' : 'te';
  const j = e.kind === 'scheme' && profile ? judge(e.rules, profile) : null;
  const benefit = (profile && e.benefitFor?.(profile)) || e.benefit;
  const applyable = canApply(e) && needsApplication(e);
  const applyTo = `/schemes/${e.id}/apply`;
  const applyLabel = e.kind === 'service' ? tx('Request this service', 'ఈ సేవ కోసం అభ్యర్థించండి') : tx('Apply now', 'ఇప్పుడే దరఖాస్తు చేయండి');
  const listenText = `${pick(e.name, lang)}. ${pick(e.summary, lang)}`;

  return (
    <article className="pb-24 lg:pb-0">
      <Link to={back} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {kind === 'service' ? tx('All services', 'అన్ని సేవలు') : tx('All schemes', 'అన్ని పథకాలు')}
      </Link>

      <header className="mt-3 flex items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-[18px] bg-turmeric-50 text-[34px] leading-none">{e.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">{pick(CATEGORY[e.category], lang)}</p>
          <h1 className="display text-[26px] leading-tight sm:text-[34px]">{pick(e.name, lang)}</h1>
          <p className="text-[15px] text-muted">{pick(e.name, other)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {j && <VerdictBadge verdict={j.verdict} />}
            <StatusTag entry={e} />
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <p className="max-w-[65ch] text-[16px] leading-relaxed">{pick(e.summary, lang)}</p>
            <ListenButton text={listenText} />
          </div>

          {e.status === 'announced' && (
            <Notice tone="warn">{tx('The government has announced this but applications have not opened. Do not pay anyone who offers to register you.', 'ప్రభుత్వం ప్రకటించింది కానీ దరఖాస్తులు ఇంకా ప్రారంభం కాలేదు. నమోదు చేస్తామని డబ్బు అడిగేవారికి చెల్లించవద్దు.')}</Notice>
          )}
          {e.note && <Notice>{pick(e.note, lang)}</Notice>}

          {j && j.verdict !== 'eligible' && (
            <Card className={cn('p-4', j.verdict === 'no' ? 'border-kumkum/30' : 'border-amber/30')}>
              <p className="font-semibold">{j.verdict === 'no' ? tx('Why not', 'ఎందుకు కాదు') : tx('To confirm', 'నిర్ధారించాల్సినవి')}</p>
              <ul className="mt-2 space-y-1 text-[15px]">
                {(j.verdict === 'no' ? j.failed : j.confirm).map((r) => (
                  <li key={r.en} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-50" />
                    {pick(r, lang)}
                  </li>
                ))}
              </ul>
              <Link to="/eligible?edit" className="mt-3 inline-block text-sm font-semibold underline">
                {tx('Update my answers', 'నా జవాబులు మార్చండి')}
              </Link>
            </Card>
          )}
          {e.kind === 'scheme' && !profile && (
            <Link to="/eligible" className="flex items-center gap-3 rounded-[14px] bg-ink p-4 text-white">
              <Sparkles className="size-5 shrink-0 text-turmeric" />
              <span className="flex-1 text-[15px] font-semibold">{tx('Check if your family qualifies — and for which other schemes', 'మీ కుటుంబానికి అర్హత ఉందా — ఇంకా ఏ పథకాలకు — చూడండి')}</span>
            </Link>
          )}

          {e.who.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{e.kind === 'service' ? tx('Who can get it', 'ఎవరు పొందవచ్చు') : tx('Who qualifies', 'ఎవరికి అర్హత')}</h2>
              <ul className="space-y-2">
                {e.who.map((w) => (
                  <li key={w.en} className="flex gap-2.5 text-[15px] leading-relaxed">
                    <Check className="mt-1 size-4 shrink-0 text-leaf" />
                    {pick(w, lang)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {e.docs.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{tx('Documents needed', 'కావలసిన పత్రాలు')}</h2>
              <Card className="divide-y divide-line">
                {e.docs.map((d) => {
                  const k = docKey(d.en);
                  const got = user && !INFO_ONLY.has(k) && userDocs.find(d.en);
                  const issuer = ISSUER[k];
                  return (
                    <div key={d.en} className="flex items-start gap-3 p-3.5">
                      {got ? <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-leaf text-white"><Check className="size-3" strokeWidth={3} /></span> : <FileText className="mt-0.5 size-5 shrink-0 text-ink/40" />}
                      <div className="min-w-0">
                        <p className="text-[15px] leading-snug">{pick(d, lang)}</p>
                        {lang === 'te' && d.te !== d.en && <p className="text-xs text-muted">{d.en}</p>}
                        {got ? (
                          <p className="text-xs text-leaf">{tx('In My documents', 'నా పత్రాలలో ఉంది')}</p>
                        ) : issuer ? (
                          <p className="text-xs text-muted">{tx('Get it at', 'ఎక్కడ పొందాలి')}: {pick(issuer, lang)}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          )}

          {e.steps.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{tx('How to get it', 'ఎలా పొందాలి')}</h2>
              <ol className="space-y-3">
                {e.steps.map((s, i) => (
                  <li key={s.en} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                    <span className="pt-0.5">{pick(s, lang)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-3">
          <Card className="p-5 lg:sticky lg:top-6">
            {benefit && (
              <>
                <p className="text-sm text-muted">{profile && e.benefitFor?.(profile) ? tx('Your benefit', 'మీ ప్రయోజనం') : tx('Benefit', 'ప్రయోజనం')}</p>
                <p className="display mt-0.5 text-[22px] leading-snug">{pick(benefit, lang)}</p>
              </>
            )}
            <dl className={cn('space-y-3 text-[15px]', benefit && 'mt-4 border-t border-line pt-4')}>
              <Fact Icon={MapPin} label={tx('Where', 'ఎక్కడ')} value={pick(e.where, lang)} />
              {e.fee && <Fact Icon={IndianRupee} label={tx('Fee', 'రుసుము')} value={pick(e.fee, lang)} />}
              {e.time && <Fact Icon={Clock3} label={tx('Time limit', 'గడువు')} value={pick(e.time, lang)} />}
            </dl>
            <div className="mt-5 hidden flex-col gap-2 lg:flex">
              {applyable && (
                <ButtonLink to={applyTo} state={user ? undefined : { redirectTo: applyTo }} size="lg">
                  {applyLabel}
                </ButtonLink>
              )}
              <ButtonLink to={`/nearest-center${e.where.en.includes('MeeSeva') ? '?tab=meeseva' : ''}`} variant="outline">
                <MapPin className="size-4" /> {tx('Nearest centre', 'సమీప కేంద్రం')}
              </ButtonLink>
            </div>
            {!!e.links?.length && (
              <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
                {e.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-2 hover:underline">
                      <ExternalLink className="size-3.5" /> {pick(l.label, lang)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="px-1 text-xs text-muted">{tx('Sachivalayam officials make the final decision. Rules can change — staff will tell you if something is different.', 'అంతిమ నిర్ణయం సచివాలయ అధికారులదే. నిబంధనలు మారవచ్చు — ఏదైనా మారితే సిబ్బంది చెబుతారు.')}</p>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="pb-safe fixed inset-x-0 bottom-[64px] z-30 flex gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <ButtonLink to={`/nearest-center${e.where.en.includes('MeeSeva') ? '?tab=meeseva' : ''}`} variant="outline" aria-label={tx('Nearest centre', 'సమీప కేంద్రం')}>
          <MapPin className="size-4" />
        </ButtonLink>
        {applyable ? (
          <ButtonLink to={applyTo} state={user ? undefined : { redirectTo: applyTo }} className="flex-1">
            {applyLabel}
          </ButtonLink>
        ) : (
          <span className="flex flex-1 items-center text-sm text-muted">
            {e.status === 'announced' ? tx('Not open for applications yet', 'దరఖాస్తులు ఇంకా ప్రారంభం కాలేదు') : !needsApplication(e) ? tx('No application needed', 'దరఖాస్తు అవసరం లేదు') : tx('Apply at your Sachivalayam', 'సచివాలయంలో దరఖాస్తు చేయండి')}
          </span>
        )}
      </div>
    </article>
  );
}

function Fact({ Icon, label, value }: { Icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-turmeric-deep" />
      <div>
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className="leading-snug">{value}</dd>
      </div>
    </div>
  );
}
