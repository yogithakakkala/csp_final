import { useEffect, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { speak, stopSpeaking, isSpeechSynthesisSupported } from '@/lib/speech';
import { useLang } from '@/lib/i18n';

/** Reads text aloud — for citizens who find reading hard. */
export default function ListenButton({ text, className = '' }: { text: string; className?: string }) {
  const { lang, t } = useLang();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!isSpeechSynthesisSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
        } else {
          setSpeaking(true);
          speak(text, lang, () => setSpeaking(false));
        }
      }}
      aria-label={t('listen')}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-sm font-medium text-ink hover:border-ink/30 ${className}`}
    >
      {speaking ? <Square className="size-3.5" /> : <Volume2 className="size-4" />}
      {t('listen')}
    </button>
  );
}
