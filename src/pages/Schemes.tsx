import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Clock3, IndianRupee, Search, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useProfile } from '@/hooks/useProfile';
import { judge } from '@/lib/rules';
import { detailPath, useCatalog, type Entry } from '@/lib/schemes';
import { CATEGORY, pick, type Category } from '@/data/catalog';
import { StatusTag, VerdictBadge } from '@/components/SchemeBits';
import { EmptyState, PageHeader, Tabs } from '@/components/ui';

export default function Schemes() {
  return <CatalogList kind="scheme" />;
}

export function Services() {
  return <CatalogList kind="service" />;
}

function CatalogList({ kind }: { kind: 'scheme' | 'service' }) {
  const { lang, tx } = useLang();
  const { profile } = useProfile();
  const all = useCatalog();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const cat = params.get('cat') ?? 'all';
  const legacyOpen = params.get('s');

  const items = useMemo(() => all.filter((e) => e.kind === kind && e.status !== 'retired'), [all, kind]);
  const verdicts = useMemo(() => new Map(items.map((e) => [e.id, kind === 'scheme' && profile ? judge(e.rules, profile).verdict : null])), [items, profile, kind]);

  const cats = useMemo(() => {
    const m = new Map<Category, number>();
    items.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + 1));
    return [...m.entries()];
  }, [items]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((e) => {
      if (cat === 'mine') {
        const v = verdicts.get(e.id);
        if (v !== 'eligible' && v !== 'likely') return false;
      } else if (cat !== 'all' && e.category !== cat) return false;
      if (!needle) return true;
      const hay = [e.name.en, e.name.te, e.summary.en, e.summary.te, CATEGORY[e.category].en, CATEGORY[e.category].te, ...e.docs.map((d) => `${d.en} ${d.te}`)].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [items, cat, q, verdicts]);

  // Old links used ?s=<id> to open a sheet.
  if (legacyOpen) return <Navigate to={detailPath({ id: legacyOpen, kind })} replace />;

  const mineCount = [...verdicts.values()].filter((v) => v === 'eligible' || v === 'likely').length;
  const flagship = kind === 'scheme' && cat === 'all' && !q ? list.filter((e) => e.priority <= 6) : [];
  const rest = list.filter((e) => !flagship.includes(e));

  return (
    <div>
      <PageHeader
        title={kind === 'scheme' ? tx('Welfare schemes', 'సంక్షేమ పథకాలు') : tx('Sachivalayam services', 'సచివాలయ సేవలు')}
        subtitle={
          kind === 'scheme'
            ? tx(`${items.length} State and Central schemes — who qualifies, the benefit, documents and how to apply.`, `${items.length} రాష్ట్ర, కేంద్ర పథకాలు — అర్హత, ప్రయోజనం, పత్రాలు, దరఖాస్తు విధానం.`)
            : tx('Certificates, rice card, land records and connections — with the official fee, time limit and documents.', 'ధృవపత్రాలు, రేషన్ కార్డు, భూ రికార్డులు, కనెక్షన్లు — అధికారిక రుసుము, గడువు, పత్రాలతో.')
        }
      />

      {kind === 'scheme' && !profile && (
        <Link to="/eligible" className="mb-5 flex items-center gap-3 rounded-[16px] bg-ink p-4 text-white sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-turmeric text-ink">
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold">{tx('Which of these can my family get?', 'వీటిలో మా కుటుంబానికి ఏవి వస్తాయి?')}</span>
            <span className="block text-sm text-white/70">{tx('Answer once — see every scheme you qualify for.', 'ఒక్కసారి జవాబివ్వండి — అర్హత ఉన్న అన్ని పథకాలు చూడండి.')}</span>
          </span>
        </Link>
      )}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder={kind === 'scheme' ? tx('Search: pension, farmer, gas, student…', 'వెతకండి: పింఛన్, రైతు, గ్యాస్, విద్యార్థి…') : tx('Search: income, caste, birth, rice card…', 'వెతకండి: ఆదాయం, కులం, జననం, రేషన్ కార్డు…')}
          className="h-12 w-full rounded-[var(--radius-field)] border border-line bg-paper pl-12 pr-4 text-[15px] focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10"
        />
      </div>
      <Tabs
        value={cat}
        onChange={(v) => setParams((p) => (v === 'all' ? p.delete('cat') : p.set('cat', v), p), { replace: true })}
        tabs={[
          { value: 'all', label: tx('All', 'అన్నీ'), count: items.length },
          ...(kind === 'scheme' && profile ? [{ value: 'mine', label: tx('For me', 'నాకు'), count: mineCount }] : []),
          ...cats.map(([c, n]) => ({ value: c as string, label: pick(CATEGORY[c], lang), count: n })),
        ]}
      />

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<Search className="size-5" />} title={tx('Nothing matches that', 'సరిపోలేది లేదు')} body={tx('Try a simpler word, or clear the filter.', 'సులభమైన పదం ప్రయత్నించండి లేదా ఫిల్టర్ తీసేయండి.')} />
        </div>
      ) : (
        <>
          {flagship.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">{tx('Most-used schemes', 'ఎక్కువ మంది వాడే పథకాలు')}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {flagship.map((e) => (
                  <Link key={e.id} to={detailPath(e)} className="flex flex-col rounded-[18px] border border-line bg-paper p-5 transition-colors hover:border-ink/40">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[34px] leading-none">{e.icon}</span>
                      {verdicts.get(e.id) && <VerdictBadge verdict={verdicts.get(e.id)!} />}
                    </span>
                    <span className="mt-3 text-[17px] font-semibold leading-snug">{pick(e.name, lang)}</span>
                    <span className="text-sm text-muted">{pick(e.name, lang === 'te' ? 'en' : 'te')}</span>
                    {e.benefit && <span className="mt-auto pt-3"><span className="block rounded-[10px] bg-turmeric-50 px-3 py-2 text-sm font-semibold">{pick((profile && e.benefitFor?.(profile)) || e.benefit, lang)}</span></span>}
                  </Link>
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="mt-6">
              {flagship.length > 0 && <h2 className="mb-3 text-lg font-semibold">{tx('More schemes', 'మరిన్ని పథకాలు')}</h2>}
              <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
                {rest.map((e) => (
                  <Row key={e.id} e={e} verdict={verdicts.get(e.id) ?? null} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Row({ e, verdict }: { e: Entry; verdict: ReturnType<typeof judge>['verdict'] | null }) {
  const { lang } = useLang();
  return (
    <li>
      <Link to={detailPath(e)} className="flex items-start gap-4 p-4 hover:bg-mist">
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-mist text-2xl">{e.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{pick(e.name, lang)}</span>
          <span className="line-clamp-2 text-sm text-muted">{pick(e.benefit ?? e.summary, lang)}</span>
          {(e.fee || e.time || verdict || e.status !== 'active') && (
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink/80">
              {verdict && <VerdictBadge verdict={verdict} />}
              <StatusTag entry={e} />
              {e.fee && (
                <span className="inline-flex items-center gap-1">
                  <IndianRupee className="size-3.5 text-muted" />
                  {pick(e.fee, lang).replace(/^₹/, '')}
                </span>
              )}
              {e.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5 text-muted" />
                  {pick(e.time, lang)}
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
