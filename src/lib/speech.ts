import type { Lang } from '@/types';

// Browser Web Speech API types are not in the DOM lib. Use loose types.
type Recognizer = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognizer = Recognizer;

export const isSpeechSynthesisSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export const isSpeechRecognitionSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

/** Voices load asynchronously on most browsers; this resolves once they are available. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang) {
  const want = lang === 'te' ? 'te' : 'en';
  const match = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(want));
  return match.find((v) => /-IN$/i.test(v.lang.replace('_', '-'))) ?? match[0];
}

/** True when the device has a voice for this language (Telugu voices are missing on some phones). */
export async function hasVoiceFor(lang: Lang) {
  if (!isSpeechSynthesisSupported()) return false;
  const voices = await loadVoices();
  return !voices.length || !!pickVoice(voices, lang);
}

/** Splits long text into short sentences: browsers cut off long utterances. */
function chunks(text: string, max = 180): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?।|:;])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= max) { if (part) out.push(part); continue; }
    let rest = part;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(' ', max);
      const at = cut > 40 ? cut : max;
      out.push(rest.slice(0, at));
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

let session = 0;
let current: (() => void) | undefined;
const finish = () => { const cb = current; current = undefined; cb?.(); };

export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (!isSpeechSynthesisSupported() || !text?.trim()) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  finish();
  current = onEnd;
  const id = ++session;
  const queue = chunks(text);
  void loadVoices().then((voices) => {
    if (id !== session) return;
    const voice = pickVoice(voices, lang);
    const next = () => {
      if (id !== session) return;
      const piece = queue.shift();
      if (!piece) { finish(); return; }
      const u = new SpeechSynthesisUtterance(piece);
      u.lang = voice?.lang ?? (lang === 'te' ? 'te-IN' : 'en-IN');
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = next;
      u.onerror = () => { if (id === session) finish(); };
      synth.speak(u);
    };
    next();
  });
}

export function stopSpeaking() {
  session++;
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  finish();
}

export function createRecognizer(lang: Lang): Recognizer | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognizer;
    webkitSpeechRecognition?: new () => Recognizer;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognizer = new Ctor();
  recognizer.lang = lang === 'te' ? 'te-IN' : 'en-IN';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  return recognizer;
}
