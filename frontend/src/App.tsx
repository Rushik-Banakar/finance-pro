import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/useAuthStore';

// Components & Shell
import { Layout } from './components/Layout';
import { PinLock } from './components/PinLock';
import { CoachWidget } from './components/CoachWidget';

// Routed Pages
import { Home } from './pages/Home';
import { Accounts } from './pages/Accounts';
import { Transactions } from './pages/Transactions';
import { Analytics } from './pages/Analytics';
import { Categories } from './pages/Categories';
import { Settings } from './pages/Settings';
import { Support } from './pages/Support';
import { Login } from './pages/Login';

// Create React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

// Guarded Route component to restrict access to authenticated sessions
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    // Cache target url path for session restoration after successful login
    if (window.location.pathname !== '/login') {
      sessionStorage.setItem('redirect_to', window.location.pathname);
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      {children}
      <CoachWidget />
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Global Security PIN block cover */}
        <PinLock />

        <Routes>
          {/* Public Authentication page */}
          <Route path="/login" element={<Login />} />

          {/* Secure Aggregator Dashboard routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          
          <Route path="/accounts" element={
            <ProtectedRoute>
              <Accounts />
            </ProtectedRoute>
          } />

          <Route path="/transactions" element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } />

          <Route path="/categories" element={
            <ProtectedRoute>
              <Categories />
            </ProtectedRoute>
          } />

          <Route path="/support" element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />


          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
