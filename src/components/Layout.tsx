// src/components/Layout.tsx
import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { Alert } from './ui';

const Layout: React.FC = () => {
  const { logout } = useAuth();
  const { error: catalogError, refreshCatalog, loading: catalogLoading } = useCatalog();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissCatalog, setDismissCatalog] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (catalogError) setDismissCatalog(false);
  }, [catalogError]);

  return (
    <>
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((o) => !o)}
      >
        <span className="material-icons-round">{sidebarOpen ? 'close' : 'menu'}</span>
      </button>
      <Sidebar
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-content">
        {catalogError && !dismissCatalog && (
          <Alert
            type="error"
            message={`Catálogos: ${catalogError}. Algunos formularios pueden verse vacíos.`}
            onClose={() => setDismissCatalog(true)}
          />
        )}
        {catalogError && !dismissCatalog && (
          <div className="form-actions form-actions--flat" style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={catalogLoading}
              onClick={() => { void refreshCatalog(); }}
            >
              <span className="material-icons-round">refresh</span>
              {catalogLoading ? 'Reintentando…' : 'Reintentar catálogos'}
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
