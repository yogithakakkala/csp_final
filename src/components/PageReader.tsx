import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Square, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { hasVoiceFor, isSpeechSynthesisSupported, speak, stopSpeaking } from '@/lib/speech';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const READABLE = 'h1, h2, h3, h4, p, li, label, dt, dd, th, td, figcaption, [data-read]';

/** Collects the visible text of the current page, top to bottom, without repeating nested items. */
function pageText(): string {
  const main = document.querySelector('main') ?? document.querySelector('[data-read-root]');
  if (!main) return '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const el of Array.from(main.querySelectorAll<HTMLElement>(READABLE))) {
    if (el.closest('[aria-hidden="true"], [data-no-read], nav, button, svg')) continue;
    if (el.parentElement?.closest(READABLE)) continue; // the parent already includes this text
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; // hidden
    const text = (el.innerText || '')
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '') // emoji icons would be read out by name
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((line, i, all) => (i < all.length - 1 && !/[.!?।:]$/.test(line) ? `${line}.` : line))
      .join(' ');
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(/[.!?।:]$/.test(text) ? text : `${text}.`);
  }
  return out.join(' ');
}

/** A speaker button that reads the current page aloud in the chosen language. */
export default function PageReader({ variant = 'icon', className = '' }: { variant?: 'icon' | 'row'; className?: string }) {
  const { lang, tx } = useLang();
  const { pathname } = useLocation();
  const [speaking, setSpeaking] = useState(false);

  // Stop when the page or the language changes.
  useEffect(() => {
    stopSpeaking();
    setSpeaking(false);
  }, [pathname, lang]);
  useEffect(() => () => stopSpeaking(), []);

  if (!isSpeechSynthesisSupported()) return null;

  const label = speaking ? tx('Stop reading', 'చదవడం ఆపండి') : tx('Read this page aloud', 'ఈ పేజీని చదివి వినిపించండి');

  const onClick = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = pageText();
    if (!text) return;
    if (!(await hasVoiceFor(lang))) {
      toast.message(
        lang === 'te'
          ? 'ఈ ఫోన్‌లో తెలుగు గొంతు లేదు. సెట్టింగ్స్ → టెక్స్ట్-టు-స్పీచ్‌లో Google తెలుగు గొంతును ఇన్‌స్టాల్ చేయండి.'
          : 'This phone has no English voice installed. Add one in Settings → Text-to-speech.',
      );
    }
    setSpeaking(true);
    speak(text, lang, () => setSpeaking(false));
  };

  if (variant === 'row') {
    return (
      <button onClick={onClick} className={cn('flex h-10 w-full items-center justify-between rounded-[10px] px-3 text-sm font-medium text-ink/80 hover:bg-mist', className)} aria-pressed={speaking}>
        <span>{speaking ? tx('Stop reading', 'చదవడం ఆపండి') : tx('Listen to this page', 'ఈ పేజీ వినండి')}</span>
        <span className={cn('grid size-7 place-items-center rounded-full', speaking ? 'bg-kumkum text-white' : 'bg-ink-50 text-ink')}>
          {speaking ? <Square className="size-3" /> : <Volume2 className="size-4" />}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={speaking}
      title={label}
      className={cn(
        'grid size-9 place-items-center rounded-full border transition-colors',
        speaking ? 'animate-pulse border-kumkum bg-kumkum text-white' : 'border-line text-ink hover:border-ink/30',
        className,
      )}
    >
      {speaking ? <Square className="size-3.5" /> : <Volume2 className="size-[18px]" />}
    </button>
  );
}
