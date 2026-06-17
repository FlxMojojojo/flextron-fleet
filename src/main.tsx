import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './tokens/tokens.css';
import './index.css';
import { AppShell } from './components/shell/AppShell';
import { FleetOverview } from './components/overview/FleetOverview';

// Code-split heavier routes (Recharts loads only when a detail/alerts view opens).
const BikeDetail = lazy(() => import('./components/detail/BikeDetail').then(m => ({ default: m.BikeDetail })));
const AlertsPage = lazy(() => import('./components/alerts/AlertsPage').then(m => ({ default: m.AlertsPage })));

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2000, retry: 1, refetchOnWindowFocus: false },
  },
});

const Fallback = () => (
  <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#6B7F9A', fontFamily: 'Inter, sans-serif' }}>
    Loading…
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<FleetOverview />} />
            <Route path="bike/:id" element={<Suspense fallback={<Fallback />}><BikeDetail /></Suspense>} />
            <Route path="alerts" element={<Suspense fallback={<Fallback />}><AlertsPage /></Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
