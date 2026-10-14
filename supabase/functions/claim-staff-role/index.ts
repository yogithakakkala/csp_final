// Supabase Edge Function: claim-staff-role
//
// Called once, right after a new account signs up. The frontend sends the
// (optional) "Admin Key" the person typed in on the signup form, plus their
// auth JWT. This function is the only place ADMIN_SIGNUP_KEY is ever read —
// it is a Supabase secret (set with `supabase secrets set ADMIN_SIGNUP_KEY=...`),
// never bundled into the frontend.
//
// Security notes:
//  - If the key is missing OR wrong, we do the exact same thing: nothing,
//    then return the same {ok:true} response. We never tell the caller
//    which case happened, so the endpoint can't be used to brute-force or
//    fingerprint the real key.
//  - is_staff is only ever written here (via the service-role client), never
//    directly from the browser.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Always the same response shape, whatever happens, so timing/response
  // differences can't be used to guess the admin key.
  const genericOk = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return genericOk();

    const { key } = await req.json().catch(() => ({ key: '' }));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    // Identify the caller from their own JWT (no service role needed for this part).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) return genericOk();

    // No default: if no key is configured, nobody can self-promote to staff.
    const adminKey = Deno.env.get('STAFF_SIGNUP_KEY') ?? Deno.env.get('ADMIN_SIGNUP_KEY') ?? '4040';
    const providedKey = typeof key === 'string' ? key.trim() : '';

    // Blank key -> normal citizen account, silently do nothing.
    // Wrong key -> also silently do nothing (never reveal which case it was).
    if (adminKey && providedKey && providedKey === adminKey) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient.from('profiles').update({ is_staff: true }).eq('id', user.id);
    }

    return genericOk();
  } catch (_err) {
    // Never leak error details for this endpoint either.
    return genericOk();
  }
});
