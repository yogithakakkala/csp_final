import { supabase } from '@/lib/supabase';

const PENDING_KEY = 'sachiseva:pendingStaffKey';

export type StaffClaim = { ok: true } | { ok: false; reason: 'wrong' | 'locked' | 'setup' | 'network' };

export function rememberStaffKey(key: string) {
  try {
    if (key) localStorage.setItem(PENDING_KEY, key);
  } catch {
    /* ignore */
  }
}

function takeStaffKey(): string | null {
  try {
    const v = localStorage.getItem(PENDING_KEY);
    if (v) localStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

const STAFF_KEY = (import.meta.env.VITE_STAFF_KEY as string | undefined)?.trim() || '4040';

async function isStaffNow(): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return false;
  const { data } = await supabase.from('profiles').select('is_staff').eq('id', uid).maybeSingle();
  return !!data?.is_staff;
}

/**
 * Checks the staff key for the signed-in account and, if right, makes it staff.
 * 1) database function claim_staff() — key kept in the database, wrong tries limited
 *    (supabase/UPGRADE.sql). Used whenever it exists.
 * 2) Databases without it (an existing database before the upgrade):
 *    - key checked against 4040 (VITE_STAFF_KEY)
 *    - accounts that are already staff go straight in
 *    - otherwise promoted by /api/claim-staff (needs SUPABASE_SERVICE_ROLE_KEY on Vercel)
 *      or by the Supabase Edge Function `claim-staff-role`
 */
export async function claimStaff(key: string): Promise<StaffClaim> {
  const typed = key.trim();
  if (!typed) return { ok: false, reason: 'wrong' };
  const { data, error } = await supabase.rpc('claim_staff', { _key: typed });
  if (!error) return data === true ? { ok: true } : { ok: false, reason: 'wrong' };
  if (/too many/i.test(error.message)) return { ok: false, reason: 'locked' };
  if (/fetch|network/i.test(error.message)) return { ok: false, reason: 'network' };
  console.warn('[staff] claim_staff() unavailable, using fallback:', error.code, error.message);

  if (typed !== STAFF_KEY) return { ok: false, reason: 'wrong' };
  if (await isStaffNow()) return { ok: true };

  try {
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch('/api/claim-staff', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session?.access_token ?? ''}` },
      body: JSON.stringify({ key: typed }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (body.ok && (await isStaffNow())) return { ok: true };
  } catch {
    /* not available */
  }

  // The Supabase Edge Function from the first version of the project. It accepts its
  // ADMIN_SIGNUP_KEY secret (set it to 4040 in the Supabase secrets), or its
  // built-in default 1234 when that secret was never set.
  for (const k of [typed, '1234']) {
    try {
      await supabase.functions.invoke('claim-staff-role', { body: { key: k } });
      if (await isStaffNow()) return { ok: true };
    } catch {
      break; // not deployed
    }
  }
  return { ok: false, reason: 'setup' };
}

/** Finishes a staff sign-up that needed email confirmation first (key typed at sign-up). */
export async function claimPendingStaffKey(): Promise<boolean> {
  const key = takeStaffKey();
  if (!key) return false;
  return (await claimStaff(key)).ok;
}

export function forgetStaffKey() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export const STAFF_ERRORS: Record<Exclude<StaffClaim, { ok: true }>['reason'], [string, string]> = {
  wrong: ['That staff key is not correct.', 'సిబ్బంది కీ సరైనది కాదు.'],
  locked: ['Too many wrong staff keys. Try again in 15 minutes.', 'చాలాసార్లు తప్పు కీ ఇచ్చారు. 15 నిమిషాల తర్వాత ప్రయత్నించండి.'],
  setup: ['Key accepted, but the database could not make this account staff. Run supabase/UPGRADE.sql once (see README → Staff accounts), or ask an existing staff member to add you under Staff accounts.', 'కీ సరైనదే, కానీ డేటాబేస్ ఈ ఖాతాను సిబ్బందిగా మార్చలేకపోయింది. supabase/UPGRADE.sql ఒకసారి రన్ చేయండి, లేదా ఉన్న సిబ్బందిని “సిబ్బంది ఖాతాలు”లో జోడించమని అడగండి.'],
  network: ['No internet connection. Try again.', 'ఇంటర్నెట్ లేదు. మళ్లీ ప్రయత్నించండి.'],
};
