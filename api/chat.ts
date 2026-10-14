import { KNOWLEDGE } from './_knowledge.js';
/**
 * POST /api/chat — SachiBot. Runs as a Vercel Function (and inside `npm run dev`).
 *
 * Works with any OpenAI-compatible provider. Set ONE key in Vercel env vars:
 *   GEMINI_API_KEY     (free tier at https://aistudio.google.com/apikey) — recommended
 *   OPENAI_API_KEY | GROQ_API_KEY | OPENROUTER_API_KEY
 * Optional: AI_MODEL to override the default model, AI_BASE_URL for any other compatible gateway (with AI_API_KEY).
 *
 * Streams Server-Sent Events back to the browser. With no key configured it returns
 * 503 and the app answers from its built-in FAQ instead.
 */

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface Provider {
  name: string;
  url: string;
  key: string;
  /** Tried in order; the next is used if the provider says a model doesn't exist. */
  models: string[];
  headers?: Record<string, string>;
}

function pickProvider(): Provider | null {
  const env = process.env;
  const custom = env.AI_MODEL ? [env.AI_MODEL] : [];
  if (env.AI_BASE_URL && env.AI_API_KEY)
    return { name: 'custom', url: env.AI_BASE_URL.replace(/\/$/, '') + '/chat/completions', key: env.AI_API_KEY, models: custom.length ? custom : ['gpt-4o-mini'] };
  if (env.GEMINI_API_KEY)
    return {
      name: 'gemini',
      url: (env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '') + '/chat/completions',
      key: env.GEMINI_API_KEY,
      // gemini-flash-latest always points at Google's current Flash model.
      models: [...custom, 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'],
    };
  if (env.OPENAI_API_KEY) return { name: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: env.OPENAI_API_KEY, models: [...custom, 'gpt-4o-mini', 'gpt-4.1-mini'] };
  if (env.GROQ_API_KEY)
    return { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: env.GROQ_API_KEY, models: [...custom, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] };
  if (env.OPENROUTER_API_KEY)
    return {
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: env.OPENROUTER_API_KEY,
      models: [...custom, 'google/gemini-flash-latest', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini'],
      headers: { 'X-Title': 'SachiSeva' },
    };
  return null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function systemPrompt(lang: 'en' | 'te') {
  return `You are SachiBot (సచిబాట్), the assistant inside SachiSeva — a free community-service web app that helps Andhra Pradesh citizens use Grama/Ward Sachivalayam services.

LANGUAGE: Reply in the language the user writes in. Telugu in → Telugu out. English in → English out. Mixed → reply in both. The app is currently set to ${lang === 'te' ? 'Telugu' : 'English'}; use that only when the message is ambiguous.

STYLE: Short and warm — 2–4 sentences, or numbered steps of one sentence each. Many users are elderly or new to smartphones. Use simple words. Never invent phone numbers, addresses, officer names or deadlines. If you don't know, say so and suggest visiting the nearest Sachivalayam.

LINKS: When pointing to a part of the app, use a markdown link with these exact paths so the user can tap it:
- [My schemes](/eligible) — the family answers a few questions once (the government's six-step check: income, land, electricity, car, govt job, income tax, town property) and sees EVERY scheme they qualify for, their personal benefit, one combined document list, and an "Apply for all" button. Always suggest this for "which schemes can I get?"
- [Apply for all](/apply-all) — one form, documents uploaded once, a separate application per scheme
- [All schemes](/schemes) and [Services & certificates](/services) — every scheme / service has its own page (links below) with who qualifies, documents, steps, fee and time limit
- [Find a centre](/nearest-center) — Sachivalayams and MeeSeva centres anywhere in AP, via GPS or by typing a village/town; shows live "busy" level set by staff; directions via Google Maps
- [Applications](/my-applications) — your applications, progress timeline, chat with staff, upload requested documents, drafts, escalate after 7 days without update
- [Track by number](/track) — check status with an application number like APP-2026-000123 or a certificate token like SC-2026-12345, no login needed
- [My documents](/documents) — checklist of common documents and where to get missing ones
- [Help](/help), [Sign up](/signup), [Reset password](/forgot-password)

FACTS YOU CAN USE:
- Application statuses: Submitted → Under review → (Documents needed) → Approved / Rejected. Typical processing 7–30 days depending on the scheme.
- Forms auto-save as drafts. Staff can request extra documents in the application chat; the citizen uploads from the same screen.
- Documents usually come from: Aadhaar → Aadhaar Seva Kendra/MeeSeva; Caste, Income, Residence → Sachivalayam/MeeSeva/Tahsildar; Birth/Death → municipality or gram panchayat; Ration card → Sachivalayam.
- Sachivalayams typically work 10 AM–5 PM, Monday–Saturday, closed on public holidays.
- Staff accounts are created by entering the staff key at sign-up; citizens leave it blank.
- Results from eligibility tools are guidance; Sachivalayam officials make the final decision.
- Schemes marked "Announced — not open yet" cannot be applied for; warn people not to pay anyone offering to register them.

CATALOGUE (current as of October 2026 — quote benefits, documents, fees and time limits from here; link the item page):
${KNOWLEDGE}`;
}

export async function POST(request: Request): Promise<Response> {
  let body: { messages?: ChatMessage[]; lang?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const provider = pickProvider();
  if (!provider) return json({ error: 'AI not configured', configured: false }, 503);

  const lang = body.lang === 'te' ? 'te' : 'en';
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length) return json({ error: 'No messages' }, 400);

  const payload = (model: string) =>
    JSON.stringify({
      model,
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
      messages: [{ role: 'system', content: systemPrompt(lang) }, ...messages],
    });

  let upstream: Response | null = null;
  let lastError = '';
  for (const model of provider.models) {
    try {
      upstream = await fetch(provider.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.key}`, ...provider.headers },
        body: payload(model),
      });
    } catch (err) {
      return json({ error: `AI service unreachable: ${(err as Error).message}` }, 502);
    }
    if (upstream.ok) break;
    lastError = await upstream.text().catch(() => '');
    console.error(`[chat] ${provider.name}/${model} → ${upstream.status} ${lastError.slice(0, 300)}`);
    // Unknown / retired model → try the next one. Anything else (bad key, quota) → stop.
    const modelProblem = upstream.status === 404 || (upstream.status === 400 && /model/i.test(lastError));
    if (!modelProblem) break;
  }

  if (!upstream || !upstream.ok || !upstream.body) {
    const status = upstream?.status ?? 502;
    const reason =
      status === 401 || status === 403 ? 'The AI key is invalid or not allowed. Check it in Vercel settings.'
      : status === 429 ? 'Too many questions right now — try again in a minute.'
      : 'AI service error';
    return json({ error: reason }, status === 429 ? 429 : 502);
  }

  // Some gateways ignore stream:true and send one JSON object — pass it on as a plain reply.
  if (!(upstream.headers.get('content-type') ?? '').includes('event-stream')) {
    const data = (await upstream.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
    return json({ reply: data.choices?.[0]?.message?.content ?? '' });
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

export function GET(): Response {
  const p = pickProvider();
  return json({ ok: true, configured: p !== null, provider: p?.name ?? null, model: p?.models[0] ?? null });
}
