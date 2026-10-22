import type { Lang } from '@/types';
import { getCatalog } from '@/lib/schemes';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

/**
 * Streams a reply from /api/chat. If the AI service isn't configured or
 * unreachable, answers from the built-in FAQ so SachiBot never goes silent.
 */
export async function askSachiBot(
  messages: ChatMsg[],
  lang: Lang,
  onDelta: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; offline: boolean }> {
  // Stop waiting if the AI hasn't started answering in 25 s, or stalls for 15 s mid-reply.
  const ctrl = new AbortController();
  let timedOut = false;
  let timer = setTimeout(() => ((timedOut = true), ctrl.abort()), 25_000);
  const poke = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ((timedOut = true), ctrl.abort()), 15_000);
  };
  const onOuterAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onOuterAbort);
  let partial = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(-10), lang }),
      signal: ctrl.signal,
    });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.includes('text/event-stream') && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        poke();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const data = l.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
            const piece = json.choices?.[0]?.delta?.content;
            if (piece) {
              text += piece;
              partial = text;
              onDelta(text);
            }
          } catch {
            /* partial line */
          }
        }
      }
      if (text.trim()) return { text, offline: false };
    } else if (res.ok) {
      const data = (await res.json()) as { reply?: string };
      if (data.reply?.trim()) {
        onDelta(data.reply);
        return { text: data.reply, offline: false };
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError' && !timedOut) throw e; // the person stopped it
    if (partial.trim()) return { text: partial, offline: false }; // keep what already arrived
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const text = localAnswer(last, lang);
  onDelta(text);
  return { text, offline: true };
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

/** Rule-based bilingual answers. Links use app routes and open in-app. */
export function localAnswer(input: string, lang: Lang): string {
  const q = input.toLowerCase();
  const te = lang === 'te' || /[ఀ-౿]/.test(input);
  const T = (en: string, tel: string) => (te ? tel : en);

  // A specific scheme or service mentioned?
  const words = (x: string) => x.toLowerCase().replace(/[^a-z\u0C00-\u0C7F ]+/g, ' ').split(' ').filter((w) => w.length > 3);
  const item = getCatalog().find((e) => {
    if (e.status === 'retired') return false;
    const key = words(e.name.en).filter((w) => !['scheme', 'certificate', 'card', 'free', 'with', 'from', 'pension', 'service'].includes(w));
    return (key[0] && q.includes(key[0])) || input.includes(e.name.te.split(' ')[0]) && e.name.te.split(' ')[0].length > 3;
  });
  if (item && !has(q, 'eligible for', 'which scheme', 'all scheme')) {
    const path = `/${item.kind === 'service' ? 'services' : 'schemes'}/${item.id}`;
    return [
      `**${T(item.name.en, item.name.te)}**`,
      T(item.summary.en, item.summary.te),
      item.benefit ? `${T('Benefit', 'ప్రయోజనం')}: ${T(item.benefit.en, item.benefit.te)}` : '',
      item.fee ? `${T('Fee', 'రుసుము')}: ${T(item.fee.en, item.fee.te)}${item.time ? ` · ${T('Time', 'గడువు')}: ${T(item.time.en, item.time.te)}` : ''}` : '',
      item.docs.length ? `${T('Documents', 'పత్రాలు')}:\n${item.docs.map((d) => `- ${T(d.en, d.te)}`).join('\n')}` : '',
      `[${T('Full details & apply', 'పూర్తి వివరాలు & దరఖాస్తు')}](${path}) · [${T('Am I eligible?', 'నాకు అర్హత ఉందా?')}](/eligible)`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (has(q, 'eligible', 'qualify', 'which scheme', 'suitable', 'అర్హ', 'సరిపోయే'))
    return T(
      'Open [My schemes](/eligible) and answer the family questions once. You will see every scheme you qualify for, your benefit, one combined document list — and an **Apply for all** button.',
      '[నా పథకాలు](/eligible) తెరిచి కుటుంబ ప్రశ్నలకు ఒక్కసారి జవాబివ్వండి. మీకు అర్హత ఉన్న ప్రతి పథకం, మీ ప్రయోజనం, ఒకే పత్రాల జాబితా — **అన్నింటికీ దరఖాస్తు** బటన్‌తో కనిపిస్తాయి.',
    );
  if (has(q, 'nearest', 'centre', 'center', 'office', 'sachivalayam', 'meeseva', 'mee seva', 'crowd', 'busy', 'సమీప', 'కేంద్ర', 'సచివాలయ', 'మీసేవ', 'రద్దీ'))
    return T(
      'Open [Find a centre](/nearest-center). It shows Sachivalayams and MeeSeva centres near you anywhere in Andhra Pradesh — allow location, or type your village or town. Tap a centre for directions.',
      '[కేంద్రం కనుగొనండి](/nearest-center) తెరవండి. ఆంధ్రప్రదేశ్‌లో ఎక్కడైనా మీ దగ్గరి సచివాలయాలు, మీసేవ కేంద్రాలు చూపిస్తుంది — లొకేషన్ అనుమతించండి లేదా మీ గ్రామం/పట్టణం పేరు టైప్ చేయండి.',
    );
  if (has(q, 'status', 'track', 'where is my', 'token', 'app-', 'స్థితి', 'ట్రాక్', 'ఎక్కడ ఉంది'))
    return T(
      'See every application with its progress timeline in [Applications](/my-applications). Have an application number like APP-2026-000123? Enter it in [Track by number](/track).',
      'మీ దరఖాస్తుల పురోగతి [దరఖాస్తులు](/my-applications)లో ఉంది. APP-2026-000123 వంటి నంబర్ ఉంటే [నంబర్‌తో ట్రాక్](/track)లో టైప్ చేయండి.',
    );
  if (has(q, 'document', 'certificate', 'papers', 'need', 'పత్ర', 'ధృవ', 'కావాలి'))
    return T(
      'Every scheme and service page lists its documents. [My schemes](/eligible) gives one combined list for everything you qualify for. Certificates (income, caste, residence, birth…) are in [Services](/services) with the fee and time limit.',
      'ప్రతి పథకం, సేవ పేజీలో పత్రాల జాబితా ఉంటుంది. [నా పథకాలు](/eligible)లో అర్హత ఉన్న అన్నింటికీ ఒకే జాబితా. ధృవపత్రాలు (ఆదాయం, కులం, నివాసం, జననం…) రుసుము, గడువుతో [సేవలు](/services)లో ఉన్నాయి.',
    );
  if (has(q, 'apply', 'application form', 'దరఖాస్తు'))
    return T(
      '1. Open [All schemes](/schemes) and pick one.\n2. Tap **Apply** and fill in your details.\n3. Upload photos of your documents.\n4. Submit — you get an application number to track it. Your progress saves automatically.',
      '1. [అన్ని పథకాలు](/schemes) తెరిచి ఒకటి ఎంచుకోండి.\n2. **దరఖాస్తు చేయండి** నొక్కి వివరాలు నింపండి.\n3. పత్రాల ఫోటోలు అప్‌లోడ్ చేయండి.\n4. సమర్పించండి — ట్రాక్ చేయడానికి నంబర్ వస్తుంది. మీ పురోగతి ఆటోమేటిక్‌గా సేవ్ అవుతుంది.',
    );
  if (has(q, 'money', 'bribe', 'agent', 'paid', 'pay', 'లంచం', 'డబ్బు', 'ఏజెంట్'))
    return T(
      'Applying for schemes and Sachivalayam services is **free**. Do not pay anyone. If someone asked you for money, tell us on [Report fake agent](/report-agent) — only Sachivalayam staff can see it.',
      'పథకాలు, సచివాలయ సేవలకు దరఖాస్తు **ఉచితం**. ఎవరికీ డబ్బు ఇవ్వకండి. ఎవరైనా డబ్బు అడిగితే [నకిలీ ఏజెంట్ రిపోర్ట్](/report-agent)లో చెప్పండి — సచివాలయ సిబ్బంది మాత్రమే చూడగలరు.',
    );
  if (has(q, 'no update', 'delay', 'escalat', 'grievance', 'complain', 'ఫిర్యాదు', 'అప్‌డేట్ లేదు'))
    return T(
      'If an application has no update for 7 days, an **Escalate** button appears on it in [Applications](/my-applications). Staff are alerted and you are notified when they respond.',
      '7 రోజులుగా అప్‌డేట్ లేకపోతే [దరఖాస్తులు](/my-applications)లో **ఫిర్యాదు చేయి** బటన్ కనిపిస్తుంది. సిబ్బందికి హెచ్చరిక వెళ్తుంది.',
    );
  if (has(q, 'draft', 'closed', 'saved', 'ముసాయిదా', 'మూసివేశా'))
    return T(
      'Your form is saved as a draft while you type. Find it at the top of [Applications](/my-applications) and tap **Continue**.',
      'మీరు టైప్ చేస్తుండగానే ఫారం ముసాయిదాగా సేవ్ అవుతుంది. [దరఖాస్తులు](/my-applications) పైభాగంలో **కొనసాగించు** నొక్కండి.',
    );
  if (has(q, 'password', 'login', 'sign', 'account', 'పాస్‌వర్డ్', 'లాగిన్', 'ఖాతా'))
    return T(
      'Create an account on [Sign up](/signup). Forgot your password? Use [Reset password](/forgot-password) and we will email you a link.',
      '[నమోదు](/signup)లో ఖాతా సృష్టించండి. పాస్‌వర్డ్ మర్చిపోతే [పాస్‌వర్డ్ రీసెట్](/forgot-password) వాడండి.',
    );
  if (has(q, 'time', 'hours', 'open', 'timing', 'సమయం'))
    return T(
      'Sachivalayams usually work 10 AM – 5 PM, Monday to Saturday, closed on public holidays. Check the busy indicator on [Find a centre](/nearest-center) before you go.',
      'సచివాలయాలు సాధారణంగా ఉదయం 10 – సాయంత్రం 5, సోమవారం నుండి శనివారం వరకు పని చేస్తాయి. వెళ్లే ముందు [కేంద్రం కనుగొనండి](/nearest-center)లో రద్దీ చూడండి.',
    );
  if (has(q, 'hi', 'hello', 'namaste', 'నమస్తే', 'హలో'))
    return T(
      'Namaste! Ask me about schemes, documents, your application or the nearest centre.',
      'నమస్తే! పథకాలు, పత్రాలు, మీ దరఖాస్తు లేదా సమీప కేంద్రం గురించి అడగండి.',
    );
  return T(
    "I can help with schemes, eligibility, documents, applications and finding a centre. Try: “Which schemes am I eligible for?” or see [Help](/help).",
    'పథకాలు, అర్హత, పత్రాలు, దరఖాస్తులు, కేంద్రాల గురించి సహాయం చేయగలను. ఉదా: “నేను ఏ పథకాలకు అర్హుడిని?” లేదా [సహాయం](/help) చూడండి.',
  );
}
