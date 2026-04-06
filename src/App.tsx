import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('@/pages/Login'));
const OnboardingPage = lazy(() => import('@/pages/Onboarding'));
const RemovePage = lazy(() => import('@/pages/Remove'));
const CompressPage = lazy(() => import('@/pages/Compress'));
const GeneratePage = lazy(() => import('@/pages/Generate'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const FolderWatchPage = lazy(() => import('@/pages/FolderWatch'));
const UsagePage = lazy(() => import('@/pages/Usage'));
const ConfigErrorPage = lazy(() => import('@/pages/ConfigError'));

const isConfigured =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY &&
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY !== 'your_clerk_publishable_key_here';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function App() {
  if (!isConfigured) {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="*" element={<ConfigErrorPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/onboarding"
              element={
                <PrivateRoute>
                  <OnboardingPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/"
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<RemovePage />} />
              <Route path="generate" element={<GeneratePage />} />
              <Route path="compress" element={<CompressPage />} />
              <Route path="folder-watch" element={<FolderWatchPage />} />
              <Route path="usage" element={<UsagePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
