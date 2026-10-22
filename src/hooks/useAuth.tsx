import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { claimPendingStaffKey } from '@/lib/staff';
import type { Profile } from '@/types';
import { forgetDevice } from '@/lib/push';

type AuthContextValue = {
  session: Session | null;
  user: Session['user'] | null;
  profile: Profile | null;
  isStaff: boolean;
  /** true until we know whether someone is logged in AND (if so) whether they are staff */
  ready: boolean;
  /** true after the user clicked a password-reset email link */
  recovering: boolean;
  clearRecovering: () => void;
  refreshProfile: (uid?: string) => Promise<Profile | null>;
  /** while true, guest pages (login/sign-up) don't redirect — used while the staff key is checked */
  holdRedirect: boolean;
  setHoldRedirect: (v: boolean) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_staff, created_at')
    .eq('id', uid)
    .maybeSingle();
  if (error) console.warn('[auth] profile', error.message);
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const lastUid = useRef<string | null>(null);
  const seq = useRef(0);
  const [holdRedirect, setHoldRedirect] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
      setSessionReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id ?? null;

  useEffect(() => {
    if (!uid) {
      lastUid.current = null;
      setProfile(null);
      setProfileFor(null);
      return;
    }
    if (lastUid.current === uid) return;
    lastUid.current = uid;
    let active = true;
    const mine = ++seq.current;
    (async () => {
      const claimed = await claimPendingStaffKey();
      let p = await fetchProfile(uid);
      if (claimed && p && !p.is_staff) p = await fetchProfile(uid);
      if (!active || mine !== seq.current) return;
      setProfile(p);
      setProfileFor(uid);
    })();
    return () => {
      active = false;
    };
  }, [uid]);

  const refreshProfile = useCallback(async (id?: string) => {
    const target = id ?? uid;
    if (!target) return null;
    const mine = ++seq.current;
    const p = await fetchProfile(target);
    if (mine === seq.current) {
      lastUid.current = target;
      setProfile(p);
      setProfileFor(target);
    }
    return p;
  }, [uid]);

  const signOut = useCallback(async () => {
    await forgetDevice();
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const ready = sessionReady && (!uid || profileFor === uid);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isStaff: profile?.is_staff ?? false,
      ready,
      recovering,
      clearRecovering: () => setRecovering(false),
      refreshProfile,
      signOut,
      holdRedirect,
      setHoldRedirect,
    }),
    [session, profile, ready, recovering, refreshProfile, signOut, holdRedirect],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
