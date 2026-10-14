import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { Wordmark } from '@/components/Logo';

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { lang, toggle, tx } = useLang();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="muggu absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_bottom_left,black,transparent_70%)]" aria-hidden />
        <Link to="/" className="relative">
          <Wordmark invert />
        </Link>
        <div className="relative">
          <p className="display-wide text-[88px] leading-none text-turmeric" lang="te">సచిసేవ</p>
          <p className="mt-4 max-w-[34ch] text-xl text-white/80">
            {tx('Every scheme your family qualifies for — with the documents you need — in Telugu and English.', 'మీ కుటుంబానికి అర్హత ఉన్న ప్రతి పథకం — కావలసిన పత్రాలతో — తెలుగు, ఇంగ్లీష్‌లో.')}
          </p>
        </div>
        <p className="relative text-sm text-white/50">{tx('Community service project · Andhra Pradesh', 'సమాజ సేవా ప్రాజెక్ట్ · ఆంధ్రప్రదేశ్')}</p>
      </aside>

      <main className="flex min-h-dvh flex-col bg-paper px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:invisible">
            <Wordmark />
          </Link>
          <button onClick={toggle} className="h-9 rounded-full border border-line px-3.5 text-sm font-semibold">
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 animate-rise">
          <h1 className="display text-[30px] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
