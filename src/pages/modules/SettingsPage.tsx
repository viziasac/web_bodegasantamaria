import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog, clearCatalogCache } from '../../context/CatalogContext';
import { PageHeader, Alert } from '../../components/ui';

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { refreshCatalog, loaded, loading, error } = useCatalog();
  const [msg, setMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleClearCache = () => {
    if (!confirm('¿Eliminar la caché local de catálogos?')) return;
    clearCatalogCache();
    setMsg('Caché local eliminada. Los catálogos se recargarán en la próxima operación.');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
      setMsg('Catálogos actualizados.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Configuración" subtitle="Cuenta, sesión y caché local" />
      {msg && <Alert type="success" message={msg} onClose={() => setMsg(null)} />}
      {error && <Alert type="error" message={error} />}

      <div className="card card-section">
        <h3 className="card-section-title">Perfil de usuario</h3>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Rol:</strong> {user?.role}</p>
        <p><strong>ID:</strong> <code className="code-tag">{user?.id}</code></p>
      </div>

      <div className="card card-section">
        <h3 className="card-section-title">Sistema</h3>
        <p><strong>Backend:</strong> Supabase (Bodega Santa María ERP)</p>
        <p><strong>Catálogos:</strong> {loaded ? 'Cargados' : 'Pendientes'} {(loading || refreshing) && '(actualizando…)'}</p>
        <div className="form-actions form-actions--flat">
          <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={refreshing || loading}>
            <span className="material-icons-round">refresh</span>
            {refreshing ? 'Actualizando…' : 'Recargar catálogos'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleClearCache}>
            <span className="material-icons-round">delete_sweep</span> Limpiar caché
          </button>
        </div>
      </div>

      <div className="card card-section">
        <h3 className="card-section-title">Sesión</h3>
        <button type="button" className="btn btn-danger" onClick={() => logout()}>
          <span className="material-icons-round">logout</span> Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
