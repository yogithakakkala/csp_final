import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Mic, Send, Square, Volume2, VolumeX } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { askSachiBot, type ChatMsg } from '@/lib/chat';

type Shown = ChatMsg & { offline?: boolean };
import { createRecognizer, isSpeechRecognitionSupported, isSpeechSynthesisSupported, speak, stopSpeaking, type SpeechRecognizer } from '@/lib/speech';
import { cn } from '@/lib/utils';

const STORE = 'sachiseva:chat';

function loadHistory(): ChatMsg[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as ChatMsg[];
  } catch {
    return [];
  }
}

export default function ChatPanel({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { lang, tx } = useLang();
  const [messages, setMessages] = useState<Shown[]>(loadHistory);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => () => {
    abort.current?.abort();
    stopSpeaking();
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Shown[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setStreaming('');
    abort.current = new AbortController();
    try {
      const { text: reply, offline } = await askSachiBot(next.map(({ role, content }) => ({ role, content })), lang, (t) => setStreaming(t), abort.current.signal);
      setMessages((m) => [...m, { role: 'assistant', content: reply, offline }]);
      if (voice && isSpeechSynthesisSupported()) speak(reply.replace(/[*#[\]()_]/g, '').replace(/\/[a-z-/?=]+/g, ''), lang);
    } catch {
      /* aborted */
    } finally {
      setStreaming(null);
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recognizer.current?.stop();
      setListening(false);
      return;
    }
    stopSpeaking();
    const rec = createRecognizer(lang);
    if (!rec) return;
    recognizer.current = rec;
    rec.onresult = (e) => {
      setListening(false);
      void send(e.results[0][0].transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const suggestions = [
    tx('Which schemes am I eligible for?', 'నేను ఏ పథకాలకు అర్హుడిని?'),
    tx('How do I apply for a scheme?', 'పథకానికి ఎలా దరఖాస్తు చేయాలి?'),
    tx('Find the nearest Sachivalayam', 'సమీప సచివాలయం కనుగొనండి'),
    tx('My application has no update', 'నా దరఖాస్తుకు అప్‌డేట్ లేదు'),
  ];

  const md = (content: string) => (
    <ReactMarkdown
      components={{
        a: ({ href, children }) =>
          href?.startsWith('/') ? (
            <Link to={href} onClick={onNavigate} className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
              {children}
            </Link>
          ) : (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="max-w-[88%] rounded-[18px] rounded-tl-md bg-ink-50 px-4 py-3 text-[15px] leading-relaxed">
          {tx(
            'Namaste! I am SachiBot. Ask me about schemes, documents, your application or the nearest centre — in Telugu or English.',
            'నమస్తే! నేను సచిబాట్. పథకాలు, పత్రాలు, మీ దరఖాస్తు లేదా సమీప కేంద్రం గురించి తెలుగు లేదా ఇంగ్లీష్‌లో అడగండి.',
          )}
        </div>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-[18px] rounded-tr-md bg-ink px-4 py-2.5 text-[15px] text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="max-w-[88%]">
              <div className="prose-chat rounded-[18px] rounded-tl-md bg-ink-50 px-4 py-3 text-[15px] leading-relaxed">{md(m.content)}</div>
              {m.offline && <p className="mt-1 px-1 text-xs text-muted">{tx('Quick answer from saved help — the AI assistant is not connected right now.', 'సేవ్ చేసిన సహాయం నుండి త్వరిత సమాధానం — AI సహాయకుడు ప్రస్తుతం అందుబాటులో లేదు.')}</p>}
            </div>
          ),
        )}
        {streaming !== null && (
          <div className="prose-chat max-w-[88%] rounded-[18px] rounded-tl-md bg-ink-50 px-4 py-3 text-[15px] leading-relaxed">
            {streaming ? (
              md(streaming)
            ) : (
              <span className="flex gap-1 py-1" aria-label="SachiBot is typing">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-2 animate-bounce rounded-full bg-ink/40" style={{ animationDelay: `${d * 0.12}s` }} />
                ))}
              </span>
            )}
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button key={s} onClick={() => void send(s)} className="rounded-full border border-ink/15 bg-paper px-3.5 py-2 text-sm font-medium text-ink hover:border-ink/40">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex items-center gap-2 border-t border-line bg-paper p-3"
      >
        {isSpeechRecognitionSupported() && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={tx('Speak your question', 'మాట్లాడి అడగండి')}
            className={cn('grid size-11 shrink-0 place-items-center rounded-full transition-colors', listening ? 'pulse-ring bg-kumkum text-white' : 'bg-turmeric text-ink')}
          >
            {listening ? <Square className="size-4" /> : <Mic className="size-5" />}
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? tx('Listening…', 'వింటోంది…') : tx('Type your question…', 'మీ ప్రశ్న టైప్ చేయండి…')}
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-mist px-4 text-[15px] focus:border-ink focus:bg-paper focus:outline-none"
        />
        {isSpeechSynthesisSupported() && (
          <button
            type="button"
            onClick={() => {
              if (voice) stopSpeaking();
              setVoice((v) => !v);
            }}
            aria-pressed={voice}
            aria-label={tx('Read answers aloud', 'సమాధానాలు చదివి వినిపించు')}
            title={tx('Read answers aloud', 'సమాధానాలు చదివి వినిపించు')}
            className={cn('hidden size-11 shrink-0 place-items-center rounded-full sm:grid', voice ? 'bg-ink-50 text-ink' : 'text-muted hover:bg-ink-50')}
          >
            {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        )}
        <button type="submit" disabled={busy || !draft.trim()} aria-label={tx('Send', 'పంపు')} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
          <Send className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}
