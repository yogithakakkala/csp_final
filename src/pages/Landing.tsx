import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, FileSearch, ListChecks, MapPin, Send, Sparkles, Stamp } from 'lucide-react';
import { getCatalog } from '@/lib/schemes';
import { useLang } from '@/lib/i18n';
import { LogoMark } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import PageReader from '@/components/PageReader';

export default function Landing() {
  const { lang, toggle, tx } = useLang();
  const navigate = useNavigate();
  const [token, setToken] = useState('');

  const nSchemes = getCatalog().filter((e) => e.kind === 'scheme').length;
  const nServices = getCatalog().filter((e) => e.kind === 'service').length;
  const services = [
    { Icon: Sparkles, to: '/eligible', en: 'Every scheme you qualify for', te: 'మీకు అర్హత ఉన్న అన్ని పథకాలు', den: 'Answer once — the same checks Sachivalayam staff do — and see them all, with your benefit.', dte: 'సచివాలయ సిబ్బంది చేసే పరిశీలనకు ఒక్కసారి జవాబివ్వండి — మీ ప్రయోజనంతో అన్నీ చూడండి.' },
    { Icon: Send, to: '/eligible', en: 'Apply for all of them at once', te: 'అన్నింటికీ ఒకేసారి దరఖాస్తు', den: 'One form, each document uploaded once, a number for every application.', dte: 'ఒకే ఫారం, ప్రతి పత్రం ఒక్కసారే, ప్రతి దరఖాస్తుకు ఒక నంబర్.' },
    { Icon: ListChecks, to: '/schemes', en: `All ${nSchemes} schemes, explained`, te: `${nSchemes} పథకాలు, వివరంగా`, den: 'Who qualifies, the benefit, documents and steps — in Telugu and English.', dte: 'ఎవరికి అర్హత, ప్రయోజనం, పత్రాలు, విధానం — తెలుగు, ఇంగ్లీష్‌లో.' },
    { Icon: Stamp, to: '/services', en: `${nServices} certificates & services`, te: `${nServices} ధృవపత్రాలు & సేవలు`, den: 'Income, caste, rice card, birth, land records — official fee, time limit and documents.', dte: 'ఆదాయం, కులం, రేషన్ కార్డు, జననం, భూ రికార్డులు — అధికారిక రుసుము, గడువు, పత్రాలు.' },
    { Icon: MapPin, to: '/nearest-center?near=1', en: 'Nearest Sachivalayam & MeeSeva', te: 'సమీప సచివాలయం & మీసేవ', den: 'Anywhere in Andhra Pradesh, with directions.', dte: 'ఆంధ్రప్రదేశ్‌లో ఎక్కడైనా, దారితో సహా.' },
    { Icon: FileSearch, to: '/track', en: 'Track without logging in', te: 'లాగిన్ లేకుండా ట్రాక్', den: 'Type your application number to see where it is.', dte: 'మీ దరఖాస్తు నంబర్ టైప్ చేసి స్థితి చూడండి.' },
    { Icon: Bot, to: '/sachibot', en: 'Ask SachiBot', te: 'సచిబాట్‌ను అడగండి', den: 'Questions answered in Telugu or English — speak or type.', dte: 'తెలుగు లేదా ఇంగ్లీష్‌లో — మాట్లాడండి లేదా టైప్ చేయండి.' },
  ];

  return (
    <div className="min-h-dvh bg-paper" data-read-root>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="muggu absolute inset-y-0 right-0 w-full opacity-40 [mask-image:linear-gradient(to_left,black,transparent_75%)] sm:w-2/3" aria-hidden />
        <div className="relative mx-auto max-w-[1080px] px-5 sm:px-8">
          <nav className="flex h-16 items-center justify-between">
            <span className="flex items-center gap-2.5">
              <LogoMark className="size-9 ring-1 ring-white/20 rounded-[10px]" />
              <span className="display text-lg">SachiSeva</span>
            </span>
            <div className="flex items-center gap-2">
              <PageReader className="border-white/25 text-white hover:border-white/50" />
              <button onClick={toggle} className="h-9 rounded-full border border-white/25 px-3.5 text-sm font-semibold hover:bg-white/10">
                {lang === 'en' ? 'తెలుగు' : 'English'}
              </button>
              <Link to="/login" className="hidden h-9 rounded-full px-3.5 text-sm font-semibold leading-9 hover:bg-white/10 sm:block">
                {tx('Log in', 'లాగిన్')}
              </Link>
            </div>
          </nav>

          <div className="pb-14 pt-10 sm:pb-20 sm:pt-16">
            <p className="display-wide text-[64px] leading-[0.95] text-turmeric sm:text-[112px]" lang="te">సచిసేవ</p>
            <h1 className="mt-5 max-w-[22ch] text-[26px] font-semibold leading-tight sm:text-[38px]">
              {tx('Every scheme your family can get, in one place.', 'మీ కుటుంబానికి వచ్చే ప్రతి పథకం, ఒకే చోట.')}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[17px] text-white/75">
              {tx(
                'Answer a few questions once. See every AP welfare scheme you qualify for, the documents you need, and apply for all of them together — in Telugu or English.',
                'కొన్ని ప్రశ్నలకు ఒక్కసారి జవాబివ్వండి. మీకు అర్హత ఉన్న అన్ని AP సంక్షేమ పథకాలు, కావలసిన పత్రాలు చూసి, అన్నింటికీ ఒకేసారి దరఖాస్తు చేయండి — తెలుగు లేదా ఇంగ్లీష్‌లో.',
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/eligible" size="lg" className="sm:w-auto">
                <Sparkles className="size-5" /> {tx('See schemes I’m eligible for', 'నాకు అర్హత ఉన్న పథకాలు చూడండి')}
              </ButtonLink>
              <ButtonLink to="/schemes" size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:border-white/60 hover:bg-white/10">
                {tx('Browse all schemes', 'అన్ని పథకాలు చూడండి')}
              </ButtonLink>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (token.trim()) navigate(`/track?token=${encodeURIComponent(token.trim())}`);
              }}
              className="mt-10 flex max-w-md items-center gap-2 rounded-[16px] bg-white/10 p-1.5 ring-1 ring-white/15"
            >
              <input
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder={tx('Have a number? APP-2026-000123', 'నంబర్ ఉందా? APP-2026-000123')}
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-white placeholder:text-white/50 focus:outline-none"
                aria-label={tx('Application number', 'దరఖాస్తు నంబర్')}
              />
              <button className="h-11 shrink-0 rounded-[12px] bg-white px-4 text-sm font-semibold text-ink">{tx('Track', 'ట్రాక్')}</button>
            </form>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-[1080px] px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="display max-w-[20ch] text-[28px] sm:text-[36px]">{tx('All schemes, all services, both languages', 'అన్ని పథకాలు, అన్ని సేవలు, రెండు భాషల్లో')}</h2>
        <ul className="mt-8 grid gap-x-10 sm:grid-cols-2">
          {services.map(({ Icon, to, en, te, den, dte }) => (
            <li key={en} className="border-t border-line">
              <Link to={to} className="group flex gap-4 py-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-turmeric-50 text-turmeric-deep transition-colors group-hover:bg-turmeric group-hover:text-ink">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-[17px] font-semibold text-ink group-hover:underline group-hover:decoration-turmeric group-hover:decoration-2 group-hover:underline-offset-4">{tx(en, te)}</span>
                  <span className="mt-0.5 block text-[15px] text-muted">{tx(den, dte)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works — a real sequence */}
      <section className="bg-mist">
        <div className="mx-auto max-w-[1080px] px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="display text-[28px] sm:text-[36px]">{tx('From question to approval', 'ప్రశ్న నుండి ఆమోదం వరకు')}</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-4">
            {[
              [tx('Answer once', 'ఒక్కసారి జవాబివ్వండి'), tx('Age, family income, land, rice card — about two minutes.', 'వయసు, కుటుంబ ఆదాయం, భూమి, రేషన్ కార్డు — సుమారు రెండు నిమిషాలు.')],
              [tx('See your schemes', 'మీ పథకాలు చూడండి'), tx('Every scheme you qualify for, with your benefit and one document list.', 'అర్హత ఉన్న ప్రతి పథకం, మీ ప్రయోజనం, ఒకే పత్రాల జాబితాతో.')],
              [tx('Apply for all', 'అన్నింటికీ దరఖాస్తు'), tx('Upload each document once; every scheme gets its own application.', 'ప్రతి పత్రం ఒక్కసారే; ప్రతి పథకానికి వేరు దరఖాస్తు.')],
              [tx('Staff decide', 'సిబ్బంది నిర్ణయం'), tx('Your Sachivalayam reviews, messages you if needed, and approves.', 'మీ సచివాలయం పరిశీలించి, అవసరమైతే సందేశం పంపి, ఆమోదిస్తుంది.')],
            ].map(([h, b], i) => (
              <li key={h} className="relative pl-12 sm:pl-0 sm:pt-14">
                <span className="absolute left-0 top-0 grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-turmeric">{i + 1}</span>
                {i < 3 && <span className="absolute left-[18px] top-10 h-[calc(100%-16px)] w-px bg-ink/15 sm:left-11 sm:top-[18px] sm:h-px sm:w-[calc(100%-20px)]" aria-hidden />}
                <p className="font-semibold">{h}</p>
                <p className="mt-1 text-[15px] text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="bg-ink text-white/70">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            <span className="font-semibold text-white">SachiSeva</span> —{' '}
            {tx('a community service project for the people of Andhra Pradesh. Not an official government website.', 'ఆంధ్రప్రదేశ్ ప్రజల కోసం ఒక సమాజ సేవా ప్రాజెక్ట్. ఇది అధికారిక ప్రభుత్వ వెబ్‌సైట్ కాదు.')}
          </p>
          <div className="flex gap-4">
            <Link to="/help" className="hover:text-white">{tx('Help', 'సహాయం')}</Link>
            <Link to="/login?as=staff" className="hover:text-white">{tx('Staff login', 'సిబ్బంది లాగిన్')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
