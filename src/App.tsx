import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import { loadCatalog } from '@/lib/schemes';
import { UnreadUpdatesProvider } from '@/hooks/useUnreadUpdates';
import AppShell from '@/components/AppShell';
import { FullPageLoader } from '@/components/ui';
import { ConfirmHost } from '@/components/ConfirmDialog';

// Every page is its own chunk, so the first load only downloads what it shows.
const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Signup = lazy(() => import('@/pages/auth/Signup'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const Home = lazy(() => import('@/pages/Home'));
const Schemes = lazy(() => import('@/pages/Schemes'));
const SchemeApply = lazy(() => import('@/pages/SchemeApply'));
const Services = lazy(() => import('@/pages/Schemes').then((m) => ({ default: m.Services })));
const CatalogDetail = lazy(() => import('@/pages/CatalogDetail'));
const MySchemes = lazy(() => import('@/pages/MySchemes'));
const ApplyAll = lazy(() => import('@/pages/ApplyAll'));
const DocumentChecklist = lazy(() => import('@/pages/DocumentChecklist'));
const Tracker = lazy(() => import('@/pages/Tracker'));
const NearestCenter = lazy(() => import('@/pages/NearestCenter'));
const MyApplications = lazy(() => import('@/pages/MyApplications'));
const ApplicationDetail = lazy(() => import('@/pages/ApplicationDetail'));
const SachiBot = lazy(() => import('@/pages/SachiBot'));
const Help = lazy(() => import('@/pages/Help'));
const ReportAgent = lazy(() => import('@/pages/ReportAgent'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminApplications = lazy(() => import('@/pages/admin/AdminApplications'));
const AdminApplicationDetail = lazy(() => import('@/pages/admin/AdminApplicationDetail'));
const AdminGrievances = lazy(() => import('@/pages/admin/AdminGrievances'));
const AdminInbox = lazy(() => import('@/pages/admin/AdminInbox'));
const AdminSchemes = lazy(() => import('@/pages/admin/AdminSchemes'));
const AdminCenters = lazy(() => import('@/pages/admin/AdminCenters'));
const AdminCertificates = lazy(() => import('@/pages/admin/AdminCertificates'));
const AdminStaff = lazy(() => import('@/pages/admin/AdminStaff'));
const AdminHealth = lazy(() => import('@/pages/admin/AdminHealth'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));

function Gate({ need }: { need: 'citizen' | 'staff' | 'guest' }) {
  const { user, isStaff, ready, holdRedirect } = useAuth();
  const location = useLocation();
  const { t } = useLang();
  if (need === 'guest' && holdRedirect) return <Outlet />;
  if (!ready) return <FullPageLoader label={t('loading')} />;
  if (need === 'guest') {
    if (!user) return <Outlet />;
    const back = (location.state as { redirectTo?: string } | null)?.redirectTo;
    return <Navigate to={isStaff ? '/admin' : back && !back.startsWith('/admin') ? back : '/home'} replace />;
  }
  if (!user) return <Navigate to="/login" replace state={{ redirectTo: location.pathname + location.search }} />;
  if (need === 'staff' && !isStaff) return <Navigate to="/home" replace />;
  if (need === 'citizen' && isStaff) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

/** Welcome page = log in / register. Signed-in users go straight to their home. */
function Root() {
  const { user, isStaff, ready, holdRedirect } = useAuth();
  if (holdRedirect) return <Landing />; // stay here while a staff key is being checked
  if (!ready) return <FullPageLoader />;
  if (user) return <Navigate to={isStaff ? '/admin' : '/home'} replace />;
  return <Landing />;
}

/** After clicking a password-reset e-mail link, Supabase signs the user in; send them to set a new password. */
function RecoveryRedirect() {
  const { recovering } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (recovering && pathname !== '/reset-password') navigate('/reset-password', { replace: true });
  }, [recovering, pathname, navigate]);
  return null;
}

function ConfigMissing() {
  return (
    <div className="grid min-h-dvh place-items-center bg-mist p-6">
      <div className="max-w-lg rounded-[18px] border border-line bg-paper p-6">
        <h1 className="text-xl font-semibold">Supabase is not connected</h1>
        <p className="mt-2 text-sm text-muted">
          Add <code className="rounded bg-mist px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-mist px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel → Project → Settings → Environment
          Variables (or in <code className="rounded bg-mist px-1">.env</code> locally), then redeploy.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    void loadCatalog();
  }, []);

  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <UnreadUpdatesProvider>
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
      <RecoveryRedirect />
      <ConfirmHost />
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/" element={<Root />} />

          <Route element={<Gate need="guest" />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Everything inside the app needs a citizen login. */}
          <Route element={<Gate need="citizen" />}>
            <Route element={<AppShell />}>
              <Route path="/home" element={<Home />} />
              <Route path="/schemes" element={<Schemes />} />
              <Route path="/schemes/:id" element={<CatalogDetail kind="scheme" />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:id" element={<CatalogDetail kind="service" />} />
              <Route path="/eligible" element={<MySchemes />} />
              <Route path="/eligibility" element={<Navigate to="/eligible" replace />} />
              <Route path="/recommender" element={<Navigate to="/eligible" replace />} />
              <Route path="/nearest-center" element={<NearestCenter />} />
              <Route path="/track" element={<Tracker />} />
              <Route path="/certificate" element={<Navigate to="/track" replace />} />
              <Route path="/sachibot" element={<SachiBot />} />
              <Route path="/help" element={<Help />} />
              <Route path="/report-agent" element={<ReportAgent />} />
              <Route path="/schemes/:schemeId/apply" element={<SchemeApply />} />
              <Route path="/apply-all" element={<ApplyAll />} />
              <Route path="/documents" element={<DocumentChecklist />} />
              <Route path="/my-applications" element={<MyApplications />} />
              <Route path="/my-applications/:applicationId" element={<ApplicationDetail />} />
            </Route>
          </Route>

          <Route element={<Gate need="staff" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="applications/:applicationId" element={<AdminApplicationDetail />} />
              <Route path="grievances" element={<AdminGrievances />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="inbox" element={<AdminInbox />} />
              <Route path="contact" element={<Navigate to="/admin/inbox" replace />} />
              <Route path="status" element={<Navigate to="/admin/applications?status=submitted" replace />} />
              <Route path="schemes" element={<AdminSchemes />} />
              <Route path="centers" element={<AdminCenters />} />
              <Route path="certificates" element={<AdminCertificates />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="health" element={<AdminHealth />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </UnreadUpdatesProvider>
  );
}
