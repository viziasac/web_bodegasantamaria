// src/App.tsx — Rutas derivadas del registry modular (sidebar + permisos + pages).
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PrivacyPage from './pages/PrivacyPage';
import { PageLoader } from './components/ui';
import { ProtectedModuleRoute } from './components/ProtectedModuleRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VENTAS_MODULE_IDS } from './config/moduleRegistry';
import { getRoutableModules, MODULE_PAGES, moduleRoutePath } from './config/moduleRoutes';

const Dashboard = lazy(() => import('./pages/Dashboard'));

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

function ModuleRoute({
  path,
  Page,
  gate,
}: {
  path: string;
  Page: React.LazyExoticComponent<React.ComponentType<unknown>>;
  gate: boolean;
}) {
  const el = (
    <Route path={moduleRoutePath(path)} element={<Lazy><Page /></Lazy>} />
  );
  if (!gate) return el;
  return (
    <Route element={<ProtectedModuleRoute path={path} />}>
      {el}
    </Route>
  );
}

const AppRoutes = () => {
  const modules = getRoutableModules();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Lazy><Dashboard /></Lazy>} />
          <Route path="inventory/adjust" element={<Navigate to="/inventory?tab=ajuste" replace />} />

          {modules.map((m) => {
            const Page = MODULE_PAGES[m.id];
            const gate = Boolean(m.adminOnly) || VENTAS_MODULE_IDS.has(m.id);
            return (
              <ModuleRoute key={m.id} path={m.path} Page={Page} gate={gate} />
            );
          })}

          <Route path="production-hub" element={<Navigate to="/production" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <ErrorBoundary fallbackTitle="Error en el panel">
      <AuthProvider>
        <CatalogProvider>
          <AppRoutes />
        </CatalogProvider>
      </AuthProvider>
    </ErrorBoundary>
  </BrowserRouter>
);

export default App;
