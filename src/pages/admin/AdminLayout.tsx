import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, AlertOctagon, Award, Building2, FileCog, FolderOpen, Gauge, Languages, LogOut, Menu, MessagesSquare, ShieldCheck, Users, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/Logo';
import { FullPageLoader } from '@/components/ui';

const NAV = [
  { to: '/admin', en: 'Overview', te: 'అవలోకనం', Icon: Gauge, end: true },
  { to: '/admin/applications', en: 'Applications', te: 'దరఖాస్తులు', Icon: FolderOpen, badge: 'new' as const },
  { to: '/admin/inbox', en: 'Messages', te: 'సందేశాలు', Icon: MessagesSquare, badge: 'msgs' as const },
  { to: '/admin/grievances', en: 'Grievances', te: 'ఫిర్యాదులు', Icon: AlertOctagon, badge: 'griev' as const },
  { to: '/admin/certificates', en: 'Certificates', te: 'ధృవపత్రాలు', Icon: Award },
  { to: '/admin/centers', en: 'Centres & crowd', te: 'కేంద్రాలు & రద్దీ', Icon: Building2 },
  { to: '/admin/schemes', en: 'Schemes', te: 'పథకాలు', Icon: FileCog },
  { to: '/admin/staff', en: 'Staff accounts', te: 'సిబ్బంది ఖాతాలు', Icon: Users },
  { to: '/admin/health', en: 'System check', te: 'సిస్టమ్ తనిఖీ', Icon: Activity },
];

/** Live counts for the nav badges. */
function useBadges() {
  const [b, setB] = useState({ new: 0, griev: 0, msgs: 0 });
  useEffect(() => {
    const load = async () => {
      const [a, g] = await Promise.all([
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('grievances').select('id', { count: 'exact', head: true }).eq('status', 'raised'),
      ]);
      setB((x) => ({ ...x, new: a.count ?? 0, griev: g.count ?? 0 }));
    };
    void load();
    const ch = supabase
      .channel('admin-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grievances' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_messages' }, (p) => {
        if ((p.new as { sender_type: string }).sender_type === 'user' && !window.location.pathname.startsWith('/admin/inbox')) setB((x) => ({ ...x, msgs: x.msgs + 1 }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  return [b, () => setB((x) => ({ ...x, msgs: 0 }))] as const;
}

export default function AdminLayout() {
  const { lang, toggle, tx } = useLang();
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [badges, clearMsgs] = useBadges();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    if (pathname.startsWith('/admin/inbox')) clearMsgs();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Staff';

  const nav = (
    <div className="flex h-full w-[264px] flex-col bg-ink text-white">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <LogoMark className="size-9 rounded-[10px] ring-1 ring-white/15" />
        <div className="leading-tight">
          <p className="display text-[17px]">SachiSeva</p>
          <p className="flex items-center gap-1 text-[13px] font-medium text-turmeric">
            <ShieldCheck className="size-3.5" /> {tx('Staff panel', 'సిబ్బంది ప్యానెల్')}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map(({ to, en, te, Icon, end, badge }) => {
          const n = badge ? badges[badge] : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium transition-colors', isActive ? 'bg-white text-ink' : 'text-white/75 hover:bg-white/10 hover:text-white')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-[18px]', isActive ? 'text-turmeric-deep' : '')} />
                  <span className="flex-1">{tx(en, te)}</span>
                  {n > 0 && <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', badge === 'griev' ? 'bg-kumkum text-white' : 'bg-turmeric text-ink')}>{n > 99 ? '99+' : n}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-3">
        <button onClick={toggle} className="flex h-10 w-full items-center gap-3 rounded-[12px] px-3 text-sm font-medium text-white/80 hover:bg-white/10">
          <Languages className="size-[18px]" /> {lang === 'en' ? 'తెలుగులో చూడండి' : 'View in English'}
        </button>
        <div className="flex items-center gap-3 rounded-[14px] bg-white/10 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-turmeric font-bold text-ink">{name[0]?.toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-white/60">{user?.email}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate('/', { replace: true });
            }}
            className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
            aria-label={tx('Log out', 'లాగ్అవుట్')}
            title={tx('Log out', 'లాగ్అవుట్')}
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-mist">
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">{nav}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-ink px-3 text-white lg:hidden">
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Menu">
          <Menu className="size-6" />
        </button>
        <p className="flex-1 font-semibold">{tx('Staff panel', 'సిబ్బంది ప్యానెల్')}</p>
        <button onClick={toggle} className="h-9 rounded-full border border-white/25 px-3 text-sm font-semibold">
          {lang === 'en' ? 'తె' : 'EN'}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-fit animate-rise">
            {nav}
            <button onClick={() => setOpen(false)} className="absolute right-3 top-6 grid size-9 place-items-center rounded-full bg-white/10 text-white" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      <main className="min-w-0 lg:pl-[264px]">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Suspense fallback={<FullPageLoader />}>
            <div key={pathname} className="animate-fade">
              <Outlet />
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
