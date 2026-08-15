import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './shared/context/AuthContext';
import { NotificationProvider } from './shared/context/NotificationContext';
import { SiteSettingsProvider, useSiteSettings } from './shared/context/SiteSettingsContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import Navbar from './shared/components/Navbar';
import Breadcrumbs from './shared/components/Breadcrumbs';
import Footer from './shared/components/Footer';
import BackButton from './shared/components/BackButton';
import ScrollToTop from './shared/components/ScrollToTop';
import ProfileCompletionGuard from './features/auth/components/ProfileCompletionGuard';
import ProtectedRoute from './shared/components/ProtectedRoute';


// ponytail: auto-retry chunk loads on new deployment hash mismatches — one reload per load attempt,
// then let it throw. The flag is cleared on success so a later deployment's mismatch can also recover.
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const reloaded = sessionStorage.getItem('chunk-reloaded');
    try {
      const mod = await componentImport();
      sessionStorage.removeItem('chunk-reloaded');
      return mod;
    } catch (error: any) {
      if (!reloaded) {
        sessionStorage.setItem('chunk-reloaded', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

// Lazy load views
const Home = lazyWithRetry(() => import('./features/home/views/Home'));
const Tournaments = lazyWithRetry(() => import('./features/tournaments/views/Tournaments'));
const TournamentDetails = lazyWithRetry(() => import('./features/tournaments/views/TournamentDetails'));
const Dashboard = lazyWithRetry(() => import('./features/dashboard/views/Dashboard'));
const Profile = lazyWithRetry(() => import('./features/profile/views/Profile'));
const Scrims = lazyWithRetry(() => import('./features/scrims/views/Scrims'));
const Wallet = lazyWithRetry(() => import('./features/wallet/views/Wallet'));
const Leaderboard = lazyWithRetry(() => import('./features/leaderboard/views/Leaderboard'));
const AdminPanel = lazyWithRetry(() => import('./features/admin/views/AdminPanel'));
const OrganizerPanel = lazyWithRetry(() => import('./features/organizer/views/OrganizerPanel'));
const TournamentAdminPanel = lazyWithRetry(() => import('./features/admin/views/TournamentAdminPanel'));
const ScrimDetailPage = lazyWithRetry(() => import('./features/organizer/views/ScrimDetailPage'));
const About = lazyWithRetry(() => import('./features/home/views/About'));
const Contact = lazyWithRetry(() => import('./features/home/views/Contact'));
const Privacy = lazyWithRetry(() => import('./features/home/views/Privacy'));
const Terms = lazyWithRetry(() => import('./features/home/views/Terms'));
const Teams = lazyWithRetry(() => import('./features/teams/views/Teams'));
const TeamDetails = lazyWithRetry(() => import('./features/teams/views/TeamDetails'));
const OrgBrowser = lazyWithRetry(() => import('./features/browser/views/OrgBrowser'));
const PublicProfile = lazyWithRetry(() => import('./features/profile/views/PublicProfile'));
const CompleteProfile = lazyWithRetry(() => import('./features/auth/views/CompleteProfile'));
const PostDetails = lazyWithRetry(() => import('./features/browser/views/PostDetails'));
const GameBrowser = lazyWithRetry(() => import('./features/browser/views/GameBrowser'));
const Results = lazyWithRetry(() => import('./features/results/views/Results'));
const GameModesBrowser = lazyWithRetry(() => import('./features/browser/views/GameModesBrowser'));
const Login = lazyWithRetry(() => import('./features/auth/views/Login'));
const Register = lazyWithRetry(() => import('./features/auth/views/Register'));
const NotFound = lazyWithRetry(() => import('./features/home/views/NotFound'));
const News = lazyWithRetry(() => import('./features/news/News'));

const LoadingFallback = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading...</p>
  </div>
);

import { AlertTriangle } from 'lucide-react';

const hasLocalMaintenanceBypass = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('maintenance') === 'off') {
    window.localStorage.setItem('nexplay-maintenance-bypass', 'true');
    return true;
  }

  return window.localStorage.getItem('nexplay-maintenance-bypass') === 'true';
};

const AppContent = () => {
  const { profile, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSiteSettings();
  const location = useLocation();
  const isHome = location.pathname === '/';
  
  if (authLoading || settingsLoading) {
    return <LoadingFallback />;
  }

  const isAdmin = profile?.role === 'admin';
  const isMaintenanceMode = settings?.maintenanceMode && !isAdmin && !hasLocalMaintenanceBypass();

  if (isMaintenanceMode && location.pathname !== '/login') {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-4">
        <div className="text-brand-500 mb-8 font-black text-4xl tracking-widest uppercase">
          NEXPLAY
        </div>
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-6" />
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-widest text-center mb-4">
          Site is under maintenance
        </h1>
        <p className="text-gray-400 text-center max-w-md font-medium">
          We are currently performing scheduled maintenance. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div id="app" className="min-h-screen flex flex-col relative overflow-x-hidden">
      <Navbar />
      
      {settings?.isNoticeActive && settings.notice && (
        <div className="bg-brand-900/40 border-b border-brand-500/30 p-2 sm:p-3 relative z-40 backdrop-blur-md">
          <div className="container mx-auto px-4 flex items-center justify-center gap-3">
            <AlertTriangle className="text-brand-400 w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <p className="text-xs sm:text-sm text-brand-200 font-bold tracking-wide text-center">
              {settings.notice}
            </p>
          </div>
        </div>
      )}
      
      <Breadcrumbs />
      <ScrollToTop />
      <main id="main-content" className="flex-grow container mx-auto px-4 pt-6 sm:pt-8 pb-20 sm:pb-24 relative min-h-[80vh]">
        {!isHome && (
          <div className="mb-6">
            <BackButton />
          </div>
        )}
        <ProfileCompletionGuard>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/scrims" element={<Scrims />} />
              <Route path="/games" element={<GameBrowser />} />
              <Route path="/results" element={<Results />} />
              <Route path="/games/:id" element={<GameModesBrowser />} />
              <Route path="/details/:id" element={<DetailsRedirect />} />
              <Route path="/tournament/:id" element={<DetailsRedirect />} />
              <Route path="/tournaments/:id" element={<TournamentDetails />} />
              <Route path="/post/:id" element={<PostDetails />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
              <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
              <Route path="/user/:id" element={<PublicProfile />} />
              <Route path="/profile/:id" element={<ProfileRedirect />} />
              <Route path="/organization/:id" element={<OrgRedirect />} />
              <Route path="/organizations" element={<OrgBrowser />} />
              <Route path="/news" element={<News />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/team/:id" element={<TeamDetails />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
              <Route path="/organizer" element={<ProtectedRoute allowedRoles={['organizer', 'admin']}><OrganizerPanel /></ProtectedRoute>} />
              <Route path="/tournament-admin/:id" element={<ProtectedRoute allowedRoles={['organizer', 'admin']}><TournamentAdminPanel /></ProtectedRoute>} />
              <Route path="/organizer/scrim/:id" element={<ProtectedRoute allowedRoles={["organizer", "admin"]}><ScrimDetailPage /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ProfileCompletionGuard>
      </main>
      <Footer />
    </div>
  );
};

// Redirect legacy /details/:id to /tournaments/:id for SEO canonical consistency
function DetailsRedirect() {
    const { id } = useParams<{ id: string }>();
    return <Navigate to={`/tournaments/${id}`} replace />;
}

// Redirect legacy /profile/:id to /user/:id for SEO canonical consistency
function ProfileRedirect() {
    const { id } = useParams<{ id: string }>();
    return <Navigate to={`/user/${id}`} replace />;
}

// Redirect /organization/:id to /user/:id for SEO canonical consistency
function OrgRedirect() {
    const { id } = useParams<{ id: string }>();
    return <Navigate to={`/user/${id}`} replace />;
}


export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <SiteSettingsProvider>
            <NotificationProvider>
              <Router>
                <AppContent />
              </Router>
            </NotificationProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
