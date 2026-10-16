import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, FileCheck2, MapPin, Send, Sparkles, type LucideIcon } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { LogoMark } from '@/components/Logo';
import PageReader from '@/components/PageReader';
import { cn } from '@/lib/utils';
import Login from './auth/Login';
import Signup from './auth/Signup';

type Tab = 'login' | 'register';
type Role = 'citizen' | 'staff';

/** What a citizen gets after logging in — shown one at a time on the welcome screen. */
const STEPS: { Icon: LucideIcon; en: string; te: string }[] = [
  { Icon: Sparkles, en: 'Answer a few family questions once', te: 'కొన్ని కుటుంబ ప్రశ్నలకు ఒక్కసారి జవాబివ్వండి' },
  { Icon: FileCheck2, en: 'See every scheme you qualify for, with the documents', te: 'అర్హత ఉన్న ప్రతి పథకం, పత్రాలతో సహా చూడండి' },
  { Icon: Send, en: 'Apply for all of them together', te: 'అన్నింటికీ ఒకేసారి దరఖాస్తు చేయండి' },
  { Icon: BellRing, en: 'Follow every application until it is decided', te: 'ప్రతి దరఖాస్తు నిర్ణయం వరకు ఫాలో అవ్వండి' },
  { Icon: MapPin, en: 'Find your nearest Sachivalayam', te: 'మీ సమీప సచివాలయం కనుగొనండి' },
];

export default function Landing() {
  const { lang, toggle, tx } = useLang();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'register' ? 'register' : 'login');
  const [role, setRole] = useState<Role>(params.get('as') === 'staff' ? 'staff' : 'citizen');
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  // Walk through the steps; stop while the person is hovering or has reduced motion on.
  useEffect(() => {
    if (paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    return () => window.clearInterval(id);
  }, [paused]);

  const choose = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(params);
    if (t === 'register') next.set('tab', 'register');
    else next.delete('tab');
    setParams(next, { replace: true });
  };

  const switchTab = () => {
    choose(tab === 'login' ? 'register' : 'login');
    card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-dvh bg-ink text-white lg:grid lg:grid-cols-[1fr_minmax(460px,520px)]" data-read-root>
      {/* Left / top: brand and what you get */}
      <section className="relative overflow-hidden px-5 pb-8 pt-4 sm:px-8 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <div className="muggu absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" aria-hidden />

        <nav className="relative flex h-14 items-center justify-between">
          <span className="flex items-center gap-2.5">
            <LogoMark className="size-9 rounded-[10px] ring-1 ring-white/20" />
            <span className="display text-lg">SachiSeva</span>
          </span>
          <div className="flex items-center gap-2">
            <PageReader className="border-white/25 text-white hover:border-white/50" />
            <button onClick={toggle} className="h-9 rounded-full border border-white/25 px-3.5 text-sm font-semibold hover:bg-white/10">
              {lang === 'en' ? 'తెలుగు' : 'English'}
            </button>
          </div>
        </nav>

        <div className="relative pt-5 lg:pt-0">
          <p className="display-wide text-[52px] leading-[0.95] text-turmeric sm:text-[96px]" lang="te">సచిసేవ</p>
          <h1 className="mt-4 max-w-[22ch] text-[24px] font-semibold leading-tight sm:text-[34px]">
            {tx('Every scheme your family can get, in one place.', 'మీ కుటుంబానికి వచ్చే ప్రతి పథకం, ఒకే చోట.')}
          </h1>
          <p className="mt-2 text-[16px] text-white/70">{tx('Log in or register to get started.', 'ప్రారంభించడానికి లాగిన్ అవ్వండి లేదా నమోదు చేసుకోండి.')}</p>

          {/* Phones: one step at a time with progress dots, so the form stays near the top */}
          <div className="mt-5 lg:hidden" aria-live="polite">
            {(() => {
              const { Icon, en, te } = STEPS[step];
              return (
                <div key={step} className="flex animate-rise items-center gap-3 rounded-[14px] bg-white/10 px-3 py-2.5 ring-1 ring-turmeric/50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-turmeric text-ink">
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="text-[15px] font-semibold">{tx(en, te)}</span>
                </div>
              );
            })()}
            <div className="mt-3 flex gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.en}
                  type="button"
                  onClick={() => {
                    setStep(i);
                    setPaused(true);
                  }}
                  aria-label={tx(s.en, s.te)}
                  className={cn('h-1.5 rounded-full transition-all duration-500', i === step ? 'w-6 bg-turmeric' : 'w-1.5 bg-white/30')}
                />
              ))}
            </div>
          </div>

          {/* Larger screens: the steps light up one by one; tap any to see it */}
          <ol className="mt-7 hidden space-y-1.5 lg:block" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label={tx('After you log in', 'లాగిన్ తర్వాత')}>
            {STEPS.map(({ Icon, en, te }, i) => {
              const on = i === step;
              const done = i < step;
              return (
                <li key={en}>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(i);
                      setPaused(true);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-all duration-500',
                      on ? 'bg-white/12 ring-1 ring-turmeric/60' : 'hover:bg-white/5',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-500',
                        on ? 'bg-turmeric text-ink' : done ? 'bg-white/15 text-turmeric' : 'bg-white/8 text-white/50',
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <span className={cn('text-[15px] transition-colors duration-500', on ? 'font-semibold text-white' : 'text-white/60')}>{tx(en, te)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="relative mt-8 hidden text-sm text-white/45 lg:block">{tx('Community service project · Andhra Pradesh', 'సమాజ సేవా ప్రాజెక్ట్ · ఆంధ్రప్రదేశ్')}</p>
      </section>

      {/* Right / bottom: log in or register */}
      <section ref={card} className="scroll-mt-4 rounded-t-[28px] bg-paper px-5 pb-10 pt-6 text-ink sm:px-10 lg:flex lg:flex-col lg:justify-center lg:rounded-none lg:py-12">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="relative grid grid-cols-2 rounded-full bg-mist p-1" role="tablist" aria-label={tx('Log in or register', 'లాగిన్ లేదా నమోదు')}>
            <span
              className={cn(
                'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink shadow-sm transition-transform duration-300 ease-out',
                tab === 'register' && 'translate-x-full',
              )}
              aria-hidden
            />
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => choose(t)}
                className={cn('relative z-10 h-11 rounded-full text-[15px] font-semibold transition-colors duration-300', tab === t ? 'text-white' : 'text-ink/60')}
              >
                {t === 'login' ? tx('Log in', 'లాగిన్') : tx('Register', 'నమోదు')}
              </button>
            ))}
          </div>

          <div className="mt-6" key={tab}>
            {tab === 'login' ? (
              <Login embedded role={role} onRole={setRole} onSwitch={switchTab} />
            ) : (
              <Signup embedded role={role} onRole={setRole} onSwitch={switchTab} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
