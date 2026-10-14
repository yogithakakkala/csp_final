import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bot, ClipboardCheck, FileSearch, FolderOpen, HelpCircle, Home, LayoutGrid, ListChecks, LogIn, LogOut, MapPin, Sparkles, Stamp } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadUpdates } from '@/hooks/useUnreadUpdates';
import { cn } from '@/lib/utils';
import { Wordmark } from './Logo';
import { FullPageLoader, Sheet } from './ui';
import AIChatbot from './AIChatbot';

type NavItem = { to: string; en: string; te: string; Icon: ComponentType<{ className?: string }>; end?: boolean; badge?: boolean; auth?: boolean };

const NAV: { group: { en: string; te: string }; items: NavItem[] }[] = [
  {
    group: { en: 'Schemes & services', te: 'పథకాలు & సేవలు' },
    items: [
      { to: '/home', en: 'Home', te: 'హోమ్', Icon: Home, end: true, auth: true },
      { to: '/eligible', en: 'My schemes', te: 'నా పథకాలు', Icon: Sparkles },
      { to: '/schemes', en: 'All schemes', te: 'అన్ని పథకాలు', Icon: ListChecks },
      { to: '/services', en: 'Services & certificates', te: 'సేవలు & ధృవపత్రాలు', Icon: Stamp },
      { to: '/nearest-center', en: 'Nearest centre', te: 'సమీప కేంద్రం', Icon: MapPin },
    ],
  },
  {
    group: { en: 'My applications', te: 'నా దరఖాస్తులు' },
    items: [
      { to: '/my-applications', en: 'Applications', te: 'దరఖాస్తులు', Icon: FolderOpen, badge: true, auth: true },
      { to: '/track', en: 'Track by number', te: 'నంబర్‌తో ట్రాక్', Icon: FileSearch },
      { to: '/documents', en: 'My documents', te: 'నా పత్రాలు', Icon: ClipboardCheck, auth: true },
    ],
  },
  {
    group: { en: 'Support', te: 'సహాయం' },
    items: [
      { to: '/sachibot', en: 'Ask SachiBot', te: 'సచిబాట్', Icon: Bot },
      { to: '/help', en: 'Help', te: 'సహాయం', Icon: HelpCircle },
    ],
  },
];

const TABS: NavItem[] = [
  { to: '/home', en: 'Home', te: 'హోమ్', Icon: Home, end: true },
  { to: '/schemes', en: 'Schemes', te: 'పథకాలు', Icon: ListChecks },
  { to: '/services', en: 'Services', te: 'సేవలు', Icon: Stamp },
  { to: '/my-applications', en: 'Applied', te: 'దరఖాస్తులు', Icon: FolderOpen, badge: true },
];
const GUEST_TABS: NavItem[] = [
  { to: '/eligible', en: 'For me', te: 'నాకు', Icon: Sparkles },
  { to: '/schemes', en: 'Schemes', te: 'పథకాలు', Icon: ListChecks },
  { to: '/services', en: 'Services', te: 'సేవలు', Icon: Stamp },
  { to: '/track', en: 'Track', te: 'ట్రాక్', Icon: FileSearch },
];

export default function AppShell() {
  const { lang, toggle, tx } = useLang();
  const { user, profile, signOut } = useAuth();
  const { totalUnread } = useUnreadUpdates();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const name = profile?.full_name || user?.email?.split('@')[0] || '';
  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };
  const visible = (i: NavItem) => !i.auth || !!user;
  const tabs = user ? TABS : GUEST_TABS;

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar — fixed so it always spans the full height */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-paper lg:flex">
        <div className="px-5 pb-3 pt-6">
          <NavLink to={user ? '/home' : '/'}>
            <Wordmark />
          </NavLink>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => {
            const items = g.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={g.group.en} className="mt-5 first:mt-2">
                <p className="px-3 pb-1 text-xs font-semibold text-muted">{tx(g.group.en, g.group.te)}</p>
                {items.map(({ to, en, te, Icon, end, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn('flex h-10 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium transition-colors', isActive ? 'bg-ink-50 text-ink' : 'text-ink/70 hover:bg-mist hover:text-ink')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-turmeric-deep' : 'text-ink/45')} />
                        <span className={cn('flex-1 truncate', isActive && 'font-semibold')}>{tx(en, te)}</span>
                        {badge && totalUnread > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-kumkum px-1 text-[11px] font-bold text-white">{totalUnread}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-line p-3">
          <button onClick={toggle} className="flex h-10 w-full items-center justify-between rounded-[10px] px-3 text-sm font-medium text-ink/80 hover:bg-mist">
            <span>{tx('Language', 'భాష')}</span>
            <span className="rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold">{lang === 'en' ? 'English → తెలుగు' : 'తెలుగు → English'}</span>
          </button>
          {user ? (
            <div className="flex items-center gap-3 rounded-[12px] bg-mist p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{(name[0] || '?').toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <button onClick={handleSignOut} className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper hover:text-kumkum" aria-label={tx('Log out', 'లాగ్అవుట్')} title={tx('Log out', 'లాగ్అవుట్')}>
                <LogOut className="size-[18px]" />
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="flex h-11 items-center justify-center gap-2 rounded-[12px] bg-ink font-semibold text-white">
              <LogIn className="size-[18px]" /> {tx('Log in', 'లాగిన్')}
            </NavLink>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
        <NavLink to={user ? '/home' : '/'} className="min-w-0">
          <Wordmark className="[&_svg]:size-8" />
        </NavLink>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={toggle} className="h-9 rounded-full border border-line px-3 text-sm font-semibold" aria-label="Change language">
            {lang === 'en' ? 'తెలుగు' : 'EN'}
          </button>
          {user ? (
            <button
              onClick={() => window.dispatchEvent(new Event('sachibot:open'))}
              className="grid size-9 place-items-center rounded-full bg-ink text-turmeric"
              aria-label={tx('Ask SachiBot', 'సచిబాట్‌ను అడగండి')}
            >
              <Bot className="size-[18px]" />
            </button>
          ) : (
            <NavLink to="/login" className="h-9 rounded-full bg-ink px-3.5 text-sm font-semibold leading-9 text-white">
              {tx('Log in', 'లాగిన్')}
            </NavLink>
          )}
        </div>
      </header>

      <main className="min-w-0 pb-24 lg:pb-12 lg:pl-[264px]">
        <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10">
          <Suspense fallback={<FullPageLoader label={tx('Loading…', 'లోడ్ అవుతోంది…')} />}>
            <div key={pathname} className="animate-fade">
              <Outlet />
            </div>
          </Suspense>
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map(({ to, en, te, Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className="relative flex h-16 flex-col items-center justify-center gap-1">
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-[22px]', isActive ? 'text-ink' : 'text-ink/45')} />
                  <span className={cn('text-[11px] leading-none', isActive ? 'font-bold text-ink' : 'font-medium text-ink/55')}>{tx(en, te)}</span>
                  {isActive && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-turmeric" />}
                  {badge && totalUnread > 0 && <span className="absolute right-[calc(50%-16px)] top-3 size-2.5 rounded-full bg-kumkum ring-2 ring-paper" />}
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-ink/55">
            <LayoutGrid className="size-[22px]" />
            <span className="text-[11px] font-medium leading-none">{tx('More', 'మరిన్ని')}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={tx('All services', 'అన్ని సేవలు')}>
        <div className="space-y-5">
          {NAV.map((g) => {
            const items = g.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={g.group.en}>
                <p className="mb-1 text-xs font-semibold text-muted">{tx(g.group.en, g.group.te)}</p>
                <div className="divide-y divide-line">
                  {items.map(({ to, en, te, Icon }) => (
                    <NavLink key={to} to={to} className={({ isActive }) => cn('flex h-12 items-center gap-3 text-[15px] font-medium', isActive ? 'text-ink' : 'text-ink/80')}>
                      <Icon className="size-5 text-ink/50" />
                      {tx(en, te)}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
          {user && (
            <button onClick={handleSignOut} className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-line font-semibold text-kumkum">
              <LogOut className="size-4" /> {tx('Log out', 'లాగ్అవుట్')}
            </button>
          )}
        </div>
      </Sheet>

      <AIChatbot />
    </div>
  );
}
