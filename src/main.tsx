import { StrictMode, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './tokens/tokens.css';
import './index.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppShell } from './components/shell/AppShell';
import { FleetOverview } from './components/overview/FleetOverview';
import { LoginPage } from './components/auth/LoginPage';
import { BrandMark } from './components/shared/BrandMark';

const BikeDetail = lazy(() => import('./components/detail/BikeDetail').then(m => ({ default: m.BikeDetail })));
const AlertsPage = lazy(() => import('./components/alerts/AlertsPage').then(m => ({ default: m.AlertsPage })));
const UsersPage = lazy(() => import('./components/admin/UsersPage').then(m => ({ default: m.UsersPage })));

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 2000, retry: 1, refetchOnWindowFocus: false } },
});

const Centered = ({ children }: { children: ReactNode }) => (
  <div style={{ flex: 1, minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>{children}</div>
);

const Fallback = () => (
  <Centered>
    <div style={{ display: 'grid', placeItems: 'center', gap: 10, animation: 'dot-pulse 1.4s ease-in-out infinite' }}>
      <BrandMark size={40} />
      <span style={{ color: '#6B7F9A', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Loading…</span>
    </div>
  </Centered>
);

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Fallback />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

const lazyRoute = (el: ReactNode) => <Suspense fallback={<Fallback />}>{el}</Suspense>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<FleetOverview />} />
              <Route path="bike/:id" element={lazyRoute(<BikeDetail />)} />
              <Route path="alerts" element={lazyRoute(<AlertsPage />)} />
              <Route path="admin/users" element={<RequireAdmin>{lazyRoute(<UsersPage />)}</RequireAdmin>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
