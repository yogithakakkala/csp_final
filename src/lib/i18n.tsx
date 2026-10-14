import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '@/types';

const STRINGS = {
  appName: { en: 'SachiSeva', te: 'సచిసేవ' },
  home: { en: 'Home', te: 'హోమ్' },
  schemes: { en: 'Schemes', te: 'పథకాలు' },
  eligibility: { en: 'Eligibility check', te: 'అర్హత తనిఖీ' },
  recommender: { en: 'Find my schemes', te: 'నా పథకాలు' },
  documents: { en: 'My documents', te: 'నా పత్రాలు' },
  track: { en: 'Track', te: 'ట్రాక్' },
  nearestCenter: { en: 'Centres', te: 'కేంద్రాలు' },
  myApplications: { en: 'Applications', te: 'దరఖాస్తులు' },
  help: { en: 'Help', te: 'సహాయం' },
  listen: { en: 'Listen', te: 'వినండి' },
  login: { en: 'Log in', te: 'లాగిన్' },
  logout: { en: 'Log out', te: 'లాగ్అవుట్' },
  apply: { en: 'Apply', te: 'దరఖాస్తు చేయండి' },
  checkStatus: { en: 'Check status', te: 'స్థితి చూడండి' },
  loading: { en: 'Loading…', te: 'లోడ్ అవుతోంది…' },
  back: { en: 'Back', te: 'వెనుకకు' },
  cancel: { en: 'Cancel', te: 'రద్దు' },
  more: { en: 'More', te: 'మరిన్ని' },
} satisfies Record<string, { en: string; te: string }>;

export type StringKey = keyof typeof STRINGS;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: StringKey) => string;
  /** Pick the string for the current language. */
  tx: (en: string, te: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function readLang(): Lang {
  try {
    const v = localStorage.getItem('sachiseva-lang');
    return v === 'te' ? 'te' : 'en';
  } catch {
    return 'en';
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readLang);

  useEffect(() => {
    try {
      localStorage.setItem('sachiseva-lang', lang);
    } catch {
      /* private mode */
    }
    document.documentElement.lang = lang === 'te' ? 'te' : 'en';
  }, [lang]);

  const toggle = useCallback(() => setLang((p) => (p === 'en' ? 'te' : 'en')), []);
  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      toggle,
      t: (key) => STRINGS[key][lang],
      tx: (en, te) => (lang === 'te' ? te : en),
    }),
    [lang, toggle],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
