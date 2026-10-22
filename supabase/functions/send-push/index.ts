// send-push — sends a Web Push notification to every saved phone/browser of one user.
// Called only by the database (public.queue_push) with the shared secret header.
// Keys are read from public.app_secrets (only the service role can read it):
//   push_hook_secret, vapid_public_key, vapid_private_key, vapid_subject (mailto:…)
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

type Text = { title: string; body: string };
type Payload = { user_id: string; url?: string; tag?: string; en: Text; te: Text };

const env = (k: string) => Deno.env.get(k) ?? '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

let keys: Promise<Record<string, string>> | null = null;
function loadKeys() {
  keys ??= db
    .from('app_secrets')
    .select('name, value')
    .in('name', ['push_hook_secret', 'vapid_public_key', 'vapid_private_key', 'vapid_subject'])
    .then(({ data, error }) => {
      if (error) {
        keys = null;
        throw new Error(error.message);
      }
      const k = Object.fromEntries((data ?? []).map((r) => [r.name, r.value]));
      webpush.setVapidDetails(k.vapid_subject || 'mailto:sachiseva@example.com', k.vapid_public_key, k.vapid_private_key);
      return k;
    });
  return keys;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true });
  let k: Record<string, string>;
  try {
    k = await loadKeys();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
  if (!k.push_hook_secret || req.headers.get('x-hook-secret') !== k.push_hook_secret) return json({ error: 'forbidden' }, 403);

  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!p.user_id || !p.en?.title) return json({ error: 'missing fields' }, 400);

  const { data: subs, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, lang').eq('user_id', p.user_id);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const t = s.lang === 'te' && p.te?.title ? p.te : p.en;
      const body = JSON.stringify({ title: t.title, body: t.body, url: p.url ?? '/my-applications', tag: p.tag });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: 'high' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The browser has unsubscribed or the subscription expired → forget it.
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error('push failed', code, (e as Error).message);
      }
    }),
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return json({ sent, removed: gone.length });
});
