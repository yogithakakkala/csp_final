import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';
const ChatPanel = lazy(() => import('./ChatPanel'));

/** Floating SachiBot. Hidden on the full-page /sachibot screen. Open from anywhere with `window.dispatchEvent(new Event('sachibot:open'))`. */
export default function AIChatbot() {
  const { tx } = useLang();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('sachibot:open', onOpen);
    return () => window.removeEventListener('sachibot:open', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (pathname === '/sachibot') return null;

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-[55] animate-fade bg-ink/40 md:hidden" onClick={() => setOpen(false)} />
          <section
            aria-label="SachiBot"
            className="fixed inset-x-0 bottom-0 z-[60] flex h-[78dvh] animate-sheet flex-col overflow-hidden rounded-t-[24px] bg-paper shadow-[var(--shadow-pop)] md:inset-x-auto md:bottom-24 md:right-6 md:h-[560px] md:w-[400px] md:animate-rise md:rounded-[24px]"
          >
            <header className="relative flex items-center justify-between gap-3 overflow-hidden bg-ink px-4 py-3 text-white">
              <div className="muggu absolute inset-y-0 right-0 w-1/2 opacity-50 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
              <div className="relative flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-turmeric text-ink">
                  <Bot className="size-5" />
                </span>
                <div className="leading-tight">
                  <p className="font-semibold">SachiBot</p>
                  <p className="text-[13px] text-white/70">{tx('Answers in Telugu & English', 'తెలుగు & ఇంగ్లీష్‌లో సమాధానాలు')}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="relative grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={tx('Close', 'మూసివేయి')}>
                <X className="size-5" />
              </button>
            </header>
            <Suspense fallback={<div className="flex-1" />}>
              <ChatPanel className="min-h-0 flex-1" onNavigate={() => setOpen(false)} />
            </Suspense>
          </section>
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={tx('Ask SachiBot', 'సచిబాట్‌ను అడగండి')}
        className={`fixed bottom-[84px] right-4 z-50 h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-ink px-4 text-white sm:pr-5 shadow-[var(--shadow-pop)] transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6 ${open ? 'hidden' : 'hidden lg:flex'}`}
      >
        {open ? <X className="size-5" /> : <Bot className="size-5 text-turmeric" />}
        <span className="hidden text-[15px] font-semibold sm:inline">{open ? tx('Close', 'మూసివేయి') : tx('Ask', 'అడగండి')}</span>
      </button>
    </>
  );
}
