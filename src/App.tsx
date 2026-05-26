import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import { Spinner } from './components/Spinner';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const AddEvent = lazy(() => import('./pages/AddEvent'));
const ScanPaperwork = lazy(() => import('./pages/ScanPaperwork'));

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

function App() {
  const { user, loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="animate-spin text-4xl">🎧</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ErrorBoundary><PageSuspense><Dashboard /></PageSuspense></ErrorBoundary>} />
            <Route path="/events" element={<ErrorBoundary><PageSuspense><Events /></PageSuspense></ErrorBoundary>} />
            <Route path="/events/:id" element={<ErrorBoundary><PageSuspense><EventDetail /></PageSuspense></ErrorBoundary>} />
            <Route path="/add" element={<ErrorBoundary><PageSuspense><AddEvent /></PageSuspense></ErrorBoundary>} />
            <Route path="/scan" element={<ErrorBoundary><PageSuspense><ScanPaperwork /></PageSuspense></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
