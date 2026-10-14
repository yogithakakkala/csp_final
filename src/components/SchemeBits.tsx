import { Link } from 'react-router-dom';
import { CheckCircle2, CircleHelp, Clock3, XCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { STATUS_LABEL, pick } from '@/data/catalog';
import type { Verdict } from '@/lib/rules';
import { detailPath, type Entry, type Match } from '@/lib/schemes';
import { cn } from '@/lib/utils';

export const VERDICT = {
  eligible: { en: 'You qualify', te: 'మీకు అర్హత ఉంది', cls: 'bg-leaf-50 text-leaf', Icon: CheckCircle2 },
  likely: { en: 'Likely — confirm', te: 'అర్హత ఉండవచ్చు', cls: 'bg-amber-50 text-amber', Icon: CircleHelp },
  no: { en: 'Not eligible', te: 'అర్హత లేదు', cls: 'bg-kumkum-50 text-kumkum', Icon: XCircle },
} as const;

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { lang } = useLang();
  const v = VERDICT[verdict];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', v.cls, className)}>
      <v.Icon className="size-3.5" /> {lang === 'te' ? v.te : v.en}
    </span>
  );
}

export function StatusTag({ entry, className }: { entry: Entry; className?: string }) {
  const { lang } = useLang();
  if (entry.status === 'active') return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink/80', className)}>
      <Clock3 className="size-3.5" /> {pick(STATUS_LABEL[entry.status], lang)}
    </span>
  );
}

/** A scheme row in "My schemes": name in both languages, personal benefit, verdict. */
export function MatchRow({ m, showReasons }: { m: Match; showReasons?: boolean }) {
  const { lang } = useLang();
  const e = m.entry;
  const other = lang === 'te' ? 'en' : 'te';
  const reasons = m.judgement.verdict === 'no' ? m.judgement.failed : m.judgement.confirm;
  return (
    <Link to={detailPath(e)} className="flex items-start gap-3.5 p-4 transition-colors hover:bg-mist sm:p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-mist text-[26px] leading-none">{e.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-snug">{pick(e.name, lang)}</span>
        <span className="block text-[13px] text-muted">{pick(e.name, other)}</span>
        {m.benefit && m.judgement.verdict !== 'no' && <span className="mt-1.5 block text-[15px] font-semibold text-ink">{pick(m.benefit, lang)}</span>}
        {showReasons && reasons.length > 0 && (
          <span className="mt-1.5 block text-[13px] leading-snug text-muted">
            {m.judgement.verdict === 'no' ? '' : lang === 'te' ? 'నిర్ధారించాలి: ' : 'To confirm: '}
            {reasons.slice(0, 3).map((r) => pick(r, lang)).join(lang === 'te' ? '; ' : '; ')}
            {reasons.length > 3 && ` +${reasons.length - 3}`}
          </span>
        )}
        <span className="mt-2 flex flex-wrap gap-1.5">
          <StatusTag entry={e} />
        </span>
      </span>
    </Link>
  );
}
