import { useEffect, useState } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '@/lib/i18n';
import { disablePush, enablePush, needsInstallForPush, pushState, syncPushLang, type PushState } from '@/lib/push';
import { cn } from '@/lib/utils';

/** Turn phone notifications on or off. `row` fits menus; `card` explains it on a page. */
export default function NotificationToggle({ variant = 'row', className }: { variant?: 'row' | 'card'; className?: string }) {
  const { lang, tx } = useLang();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
  }, []);
  useEffect(() => {
    if (state === 'on') void syncPushLang(lang);
  }, [lang, state]);

  if (state === null || (state === 'unsupported' && !needsInstallForPush())) return null;

  const toggle = async () => {
    if (state === 'unsupported') {
      toast.message(tx('On iPhone, first tap Share → Add to Home Screen, then open SachiSeva from the home screen.', 'ఐఫోన్‌లో ముందుగా Share → Add to Home Screen నొక్కి, హోమ్ స్క్రీన్ నుండి సచిసేవ తెరవండి.'));
      return;
    }
    if (state === 'blocked') {
      toast.message(tx('Notifications are blocked. Allow them for this site in your browser settings.', 'నోటిఫికేషన్లు బ్లాక్ చేయబడ్డాయి. బ్రౌజర్ సెట్టింగ్స్‌లో ఈ సైట్‌కు అనుమతించండి.'));
      return;
    }
    setBusy(true);
    try {
      const next = state === 'on' ? await disablePush() : await enablePush(lang);
      setState(next);
      if (next === 'on') toast.success(tx('Notifications on. We will tell you when your application changes.', 'నోటిఫికేషన్లు ఆన్. మీ దరఖాస్తులో మార్పు వస్తే తెలియజేస్తాం.'));
      else if (next === 'blocked') toast.error(tx('Notifications were blocked.', 'నోటిఫికేషన్లు బ్లాక్ అయ్యాయి.'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const on = state === 'on';
  const label = on ? tx('Notifications on', 'నోటిఫికేషన్లు ఆన్') : tx('Turn on notifications', 'నోటిఫికేషన్లు ఆన్ చేయండి');

  if (variant === 'card') {
    if (on) return null;
    return (
      <div className={cn('flex flex-wrap items-center gap-3 rounded-[18px] border border-line bg-paper p-4', className)}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-turmeric/20 text-ink">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{tx('Get notified on your phone', 'మీ ఫోన్‌లో నోటిఫికేషన్ పొందండి')}</p>
          <p className="text-sm text-muted">{tx('When your application is approved, staff need a document, or a document is still missing after 2 days.', 'దరఖాస్తు ఆమోదమైనప్పుడు, సిబ్బందికి పత్రం కావాల్సినప్పుడు, లేదా 2 రోజులైనా పత్రం రాకపోతే.')}</p>
        </div>
        <button onClick={toggle} disabled={busy} className="h-10 rounded-full bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">
          {state === 'blocked' ? tx('How to allow', 'ఎలా అనుమతించాలి') : tx('Turn on', 'ఆన్ చేయండి')}
        </button>
      </div>
    );
  }

  return (
    <button onClick={toggle} disabled={busy} className={cn('flex h-10 w-full items-center justify-between rounded-[10px] px-3 text-sm font-medium text-ink/80 hover:bg-mist disabled:opacity-50', className)} aria-pressed={on}>
      <span>{label}</span>
      <span className={cn('grid size-7 place-items-center rounded-full', on ? 'bg-leaf text-white' : 'bg-ink-50 text-ink')}>{on ? <BellRing className="size-4" /> : <BellOff className="size-4" />}</span>
    </button>
  );
}
