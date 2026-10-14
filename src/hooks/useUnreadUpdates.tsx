import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/lib/i18n';
import { STATUS_META } from '@/components/ui';
import type { Application, ApplicationMessage, ApplicationStatus } from '@/types';

interface AppSummary {
  id: string;
  scheme_name: string;
  updated_at: string;
  last_staff_message_at: string | null;
}

interface UnreadCtx {
  unreadByApp: Record<string, number>;
  totalUnread: number;
  markSeen: (appId: string) => void;
}

const Ctx = createContext<UnreadCtx>({ unreadByApp: {}, totalUnread: 0, markSeen: () => {} });

const key = (uid: string, appId: string) => `sachiseva:lastSeen:${uid}:${appId}`;
function getLastSeen(uid: string, appId: string): number {
  try {
    return Number(localStorage.getItem(key(uid, appId)) ?? 0);
  } catch {
    return 0;
  }
}

/** Live toasts + unread counts for a citizen's applications. Staff accounts skip this. */
export function UnreadUpdatesProvider({ children }: { children: ReactNode }) {
  const { user, isStaff } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [tick, setTick] = useState(0);
  const appsRef = useRef<AppSummary[]>([]);
  appsRef.current = apps;
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    if (!user || isStaff) {
      setApps([]);
      return;
    }
    const uid = user.id;
    let cancelled = false;

    (async () => {
      const [{ data }, { data: msgs }] = await Promise.all([
        supabase.from('applications').select('id, updated_at, scheme:schemes(name, name_telugu)').eq('user_id', uid),
        supabase
          .from('application_messages')
          .select('application_id, created_at')
          .eq('sender_type', 'staff')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (cancelled || !data) return;
      const lastMsg = new Map<string, string>();
      for (const m of (msgs as { application_id: string; created_at: string }[]) ?? [])
        if (!lastMsg.has(m.application_id)) lastMsg.set(m.application_id, m.created_at);
      setApps(
        (data as unknown as Array<{ id: string; updated_at: string; scheme: { name: string; name_telugu: string } | null }>).map((a) => ({
          id: a.id,
          scheme_name: (langRef.current === 'te' ? a.scheme?.name_telugu : a.scheme?.name) ?? 'your application',
          updated_at: a.updated_at,
          last_staff_message_at: lastMsg.get(a.id) ?? null,
        })),
      );
    })();

    const channel = supabase
      .channel('unread-' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications', filter: `user_id=eq.${uid}` }, (payload) => {
        const row = payload.new as Application;
        const prev = payload.old as Partial<Application>;
        const app = appsRef.current.find((a) => a.id === row.id);
        setApps((list) => list.map((a) => (a.id === row.id ? { ...a, updated_at: row.updated_at } : a)));
        if (prev.status && prev.status === row.status) return;
        const meta = STATUS_META[row.status as ApplicationStatus];
        const te = langRef.current === 'te';
        toast(te ? `${app?.scheme_name ?? 'దరఖాస్తు'}: ${meta?.te}` : `${app?.scheme_name ?? 'Your application'}: ${meta?.en}`, {
          action: { label: te ? 'చూడండి' : 'View', onClick: () => navigate(`/my-applications/${row.id}`) },
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_messages' }, (payload) => {
        const msg = payload.new as ApplicationMessage;
        if (msg.sender_type !== 'staff') return;
        const match = appsRef.current.find((a) => a.id === msg.application_id);
        if (!match) return;
        setApps((list) => list.map((a) => (a.id === msg.application_id ? { ...a, last_staff_message_at: msg.created_at } : a)));
        if (window.location.pathname.endsWith(msg.application_id)) return;
        const te = langRef.current === 'te';
        toast(te ? `${match.scheme_name}: సిబ్బంది నుండి సందేశం` : `New message about ${match.scheme_name}`, {
          description: msg.is_document_request
            ? `${te ? 'కావలసిన పత్రం' : 'Document needed'}: ${msg.requested_document_type ?? ''}`
            : (msg.message ?? '').slice(0, 90),
          action: { label: te ? 'చూడండి' : 'View', onClick: () => navigate(`/my-applications/${msg.application_id}`) },
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, isStaff, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadByApp = useMemo(() => {
    if (!user) return {};
    const map: Record<string, number> = {};
    for (const a of apps) {
      const seen = getLastSeen(user.id, a.id);
      let n = 0;
      // First visit (seen=0) only counts staff messages, not the creation itself.
      if (seen && new Date(a.updated_at).getTime() > seen) n++;
      if (a.last_staff_message_at && new Date(a.last_staff_message_at).getTime() > seen) n++;
      if (n) map[a.id] = n;
    }
    return map;
  }, [apps, user, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalUnread = useMemo(() => Object.values(unreadByApp).reduce((s, n) => s + n, 0), [unreadByApp]);

  const markSeen = useCallback(
    (appId: string) => {
      if (!user) return;
      try {
        localStorage.setItem(key(user.id, appId), String(Date.now()));
      } catch {
        /* ignore */
      }
      setTick((t) => t + 1);
    },
    [user],
  );

  return <Ctx.Provider value={{ unreadByApp, totalUnread, markSeen }}>{children}</Ctx.Provider>;
}

export function useUnreadUpdates() {
  return useContext(Ctx);
}
