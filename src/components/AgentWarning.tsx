import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Reminder that applying is free, with a link to report anyone asking for money. */
export default function AgentWarning({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { tx } = useLang();
  return (
    <div className={cn('flex items-start gap-3 rounded-[14px] border border-kumkum/20 bg-kumkum-50 px-4 py-3 text-sm text-ink', className)} role="note">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-kumkum" aria-hidden />
      <p className="leading-relaxed">
        <span className="font-semibold text-kumkum">{tx('Applying is free. ', 'దరఖాస్తు ఉచితం. ')}</span>
        {compact
          ? tx('Never pay anyone to apply for a scheme. ', 'పథకానికి దరఖాస్తు కోసం ఎవరికీ డబ్బు ఇవ్వకండి. ')
          : tx(
              'Never pay any agent, volunteer or official to apply, to “speed up” an application or to add your name to a list. ',
              'దరఖాస్తు చేయడానికి, “త్వరగా” చేయించడానికి లేదా జాబితాలో పేరు చేర్చడానికి ఏ ఏజెంట్‌కి, వాలంటీర్‌కి లేదా అధికారికి డబ్బు ఇవ్వకండి. ',
            )}
        <Link to="/report-agent" className="font-semibold text-kumkum underline underline-offset-2">
          {tx('Report someone asking for money', 'డబ్బు అడిగిన వారిని రిపోర్ట్ చేయండి')}
        </Link>
      </p>
    </div>
  );
}
