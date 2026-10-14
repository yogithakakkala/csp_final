/**
 * POST /api/claim-staff — fallback for databases that don't have the
 * claim_staff() function yet (supabase/migrations/20261015010000_staff_key.sql).
 * The app calls the database function first; this only runs if it's missing.
 *
 * Checks the staff key and, if it is right, makes the signed-in account staff.
 *   200 {ok:true}                    key right (account is staff)
 *   403 {ok:false, reason:'wrong'}   key wrong
 *   503 {ok:false, reason:'setup'}   key right, but SUPABASE_SERVICE_ROLE_KEY is missing so the
 *                                    account can't be promoted (already-staff accounts still pass)
 *
 * Env: STAFF_SIGNUP_KEY (default 4040), SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL,
 *      VITE_SUPABASE_PUBLISHABLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const staffKey = () => (process.env.STAFF_SIGNUP_KEY || '4040').trim();

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !(serviceKey || anonKey)) return reply({ ok: false, reason: 'setup' }, 503);

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { key } = (await request.json().catch(() => ({}))) as { key?: string };
  if (!token) return reply({ ok: false, reason: 'auth' }, 401);
  if (typeof key !== 'string' || !same(key.trim(), staffKey())) return reply({ ok: false, reason: 'wrong' }, 403);

  try {
    // Who is asking (works with either key).
    const asUser = createClient(url, anonKey ?? serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error } = await asUser.auth.getUser(token);
    if (error || !u.user) return reply({ ok: false, reason: 'auth' }, 401);

    const { data: me } = await asUser.from('profiles').select('is_staff').eq('id', u.user.id).maybeSingle();
    if (me?.is_staff) return reply({ ok: true });
    if (!serviceKey) return reply({ ok: false, reason: 'setup' }, 503);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: upErr } = await admin.from('profiles').upsert({ id: u.user.id, email: u.user.email, is_staff: true }, { onConflict: 'id' });
    if (upErr) throw upErr;
    return reply({ ok: true });
  } catch (err) {
    console.error('[claim-staff]', (err as Error).message);
    return reply({ ok: false, reason: 'setup' }, 500);
  }
}

/** For the staff System check page (no secrets returned). */
export function GET(): Response {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  return reply({ ok: true, configured: Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY), customKey: Boolean(process.env.STAFF_SIGNUP_KEY) });
}
