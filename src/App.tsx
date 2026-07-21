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

          {/*
            Importante: hijos de <Routes>/<Route> deben ser <Route> o Fragment.
            Un wrapper custom (p.ej. ModuleRoute) rompe en production build
            (invariant sin mensaje → ErrorBoundary genérico).
          */}
          {modules.map((m) => {
            const Page = MODULE_PAGES[m.id];
            const gate = Boolean(m.adminOnly) || VENTAS_MODULE_IDS.has(m.id);
            const path = moduleRoutePath(m.path);
            const pageEl = (
              <Lazy>
                <Page />
              </Lazy>
            );

            if (gate) {
              return (
                <Route key={m.id} element={<ProtectedModuleRoute path={m.path} />}>
                  <Route path={path} element={pageEl} />
                </Route>
              );
            }

            return <Route key={m.id} path={path} element={pageEl} />;
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
