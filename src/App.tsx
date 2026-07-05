// src/App.tsx
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import { PageLoader } from './components/ui';
import { ProtectedModuleRoute } from './components/ProtectedModuleRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const InventoryPage = lazy(() => import('./pages/modules/InventoryPage'));
const InventoryAdjustPage = lazy(() => import('./pages/modules/InventoryAdjustPage'));
const PurchasesPage = lazy(() => import('./pages/modules/PurchasesPage'));
const RecipesPage = lazy(() => import('./pages/modules/RecipesPage'));
const ProductionPage = lazy(() => import('./pages/modules/ProductionPage'));
const BulkProductionPage = lazy(() => import('./pages/modules/BulkProductionPage'));
const RepackPage = lazy(() => import('./pages/modules/RepackPage'));
const DispatchPage = lazy(() => import('./pages/modules/DispatchPage'));
const IncomePage = lazy(() => import('./pages/modules/IncomePage'));
const TransfersPage = lazy(() => import('./pages/modules/TransfersPage'));
const ExpensesPage = lazy(() => import('./pages/modules/ExpensesPage'));
const AuditPage = lazy(() => import('./pages/modules/AuditPage'));
const DownloadsPage = lazy(() => import('./pages/modules/DownloadsPage'));
const ReportingPage = lazy(() => import('./pages/modules/ReportingPage'));
const SettingsPage = lazy(() => import('./pages/modules/SettingsPage'));

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<Lazy><Dashboard /></Lazy>} />
        <Route path="inventory" element={<Lazy><InventoryPage /></Lazy>} />
        <Route path="inventory/adjust" element={<Lazy><InventoryAdjustPage /></Lazy>} />
        <Route path="purchases" element={<Lazy><PurchasesPage /></Lazy>} />
        <Route path="recipes" element={<Lazy><RecipesPage /></Lazy>} />
        <Route path="production" element={<Lazy><ProductionPage /></Lazy>} />
        <Route path="production/bulk" element={<Lazy><BulkProductionPage /></Lazy>} />
        <Route path="repack" element={<Lazy><RepackPage /></Lazy>} />
        <Route path="sales/dispatch" element={<Lazy><DispatchPage /></Lazy>} />
        <Route path="sales/income" element={<Lazy><IncomePage /></Lazy>} />
        <Route path="transfers" element={<Lazy><TransfersPage /></Lazy>} />
        <Route path="expenses" element={<Lazy><ExpensesPage /></Lazy>} />
        <Route path="audit" element={<Lazy><AuditPage /></Lazy>} />
        <Route path="downloads" element={<Lazy><DownloadsPage /></Lazy>} />
        <Route element={<ProtectedModuleRoute path="/reporting" />}>
          <Route path="reporting" element={<Lazy><ReportingPage /></Lazy>} />
        </Route>
        <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
        {/* Legacy redirects */}
        <Route path="production-hub" element={<Navigate to="/production" replace />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <HashRouter>
    <AuthProvider>
      <CatalogProvider>
        <AppRoutes />
      </CatalogProvider>
    </AuthProvider>
  </HashRouter>
);

export default App;
