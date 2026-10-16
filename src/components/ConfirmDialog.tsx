import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/i18n';
import { Button } from './ui';

type Tone = 'primary' | 'success' | 'danger';
type Ask = { title: string; body?: string; confirmLabel?: string; tone?: Tone };
type Pending = Ask & { resolve: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

/**
 * Ask the user to confirm, inside the app (the browser's own confirm box shows the website address).
 * Resolves true when they confirm, false when they cancel.
 */
export function askConfirm(ask: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(window.confirm(ask.title)); // host not mounted (should not happen)
    show({ ...ask, resolve });
  });
}

/** Mount once near the root of the app. */
export function ConfirmHost() {
  const { tx } = useLang();
  const [p, setP] = useState<Pending | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = setP;
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    p?.resolve(ok);
    setP(null);
  };

  useEffect(() => {
    if (!p) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" role="alertdialog" aria-modal aria-labelledby="confirm-title">
      <div className="absolute inset-0 animate-fade bg-ink/50 backdrop-blur-[2px]" onClick={() => close(false)} />
      <div className="pb-safe relative w-full max-w-md animate-sheet rounded-t-[24px] bg-paper p-6 shadow-[var(--shadow-pop)] sm:animate-rise sm:rounded-[24px]">
        <h2 id="confirm-title" className="text-lg font-semibold text-ink">
          {p.title}
        </h2>
        {p.body && <p className="mt-2 text-[15px] text-muted">{p.body}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => close(false)}>
            {tx('Cancel', 'రద్దు')}
          </Button>
          <Button ref={okRef} variant={p.tone ?? 'primary'} onClick={() => close(true)}>
            {p.confirmLabel ?? tx('Yes, continue', 'అవును, కొనసాగించు')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
