import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { loadProfile, readLocalProfile, saveProfile, type FamilyProfile } from '@/lib/profile';

/** The family profile (answered once), kept in sync across pages and devices. */
export function useProfile() {
  const { user, ready: authReady } = useAuth();
  const [profile, setProfile] = useState<FamilyProfile | null>(readLocalProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    void loadProfile(user?.id ?? null).then((p) => {
      if (!alive) return;
      setProfile(p);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, authReady]);

  useEffect(() => {
    const on = () => setProfile(readLocalProfile());
    window.addEventListener('sachiseva:profile', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('sachiseva:profile', on);
      window.removeEventListener('storage', on);
    };
  }, []);

  const save = useCallback(async (p: FamilyProfile) => {
    const s = await saveProfile(p, user?.id ?? null);
    setProfile(s);
    return s;
  }, [user?.id]);

  return { profile, ready: ready || !!profile, save };
}
