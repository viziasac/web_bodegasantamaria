import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCatalog, clearCatalogCache } from '../../context/CatalogContext';
import { PageHeader, Alert, FormSelect } from '../../components/ui';
import { loadWebPrefs, saveWebPrefs } from '../../utils/webPrefs';
import { canalVentaLabel } from '../../utils/canalVentaLabels';
import { isAdminRole } from '../../config/moduleRegistry';
import { supabase } from '../../services/supabaseClient';

const WEB_VERSION = '1.0.0';

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { ubicaciones, canalesVenta, proveedores, clientes, refreshCatalog, loaded, loading, error } = useCatalog();
  const prefs0 = loadWebPrefs();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [refreshing, setRefreshing] = useState(false);
  const [defaultPvId, setDefaultPvId] = useState(prefs0.defaultPvId ?? '');
  const [defaultCanal, setDefaultCanal] = useState(prefs0.defaultCanal ?? '');
  const [resetSending, setResetSending] = useState(false);

  const pvUbicaciones = ubicaciones.filter((u) => u.es_punto_venta);

  const isAdmin = isAdminRole(user?.role);

  const handleClearCache = () => {
    if (!confirm('¿Eliminar la caché local de catálogos?')) return;
    clearCatalogCache();
    setMsgType('success');
    setMsg('Caché local eliminada. Los catálogos se recargarán en la próxima operación.');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
      setMsgType('success');
      setMsg('Catálogos actualizados.');
    } catch (e) {
      setMsgType('error');
      setMsg(e instanceof Error ? e.message : 'No se pudieron actualizar los catálogos.');
    } finally {
      setRefreshing(false);
    }
  };

  const savePrefs = () => {
    saveWebPrefs({
      defaultPvId: defaultPvId || undefined,
      defaultCanal: defaultCanal || undefined,
    });
    setMsgType('success');
    setMsg('Preferencias locales guardadas (PV / canal por defecto).');
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (err) throw err;
      setMsgType('success');
      setMsg(`Se envió un enlace de restablecimiento a ${user.email}.`);
    } catch (e) {
      setMsgType('error');
      setMsg(e instanceof Error ? e.message : 'No se pudo enviar el correo de restablecimiento.');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Configuración" subtitle="Cuenta, preferencias y caché local" moduleId="configuracion" />
      {msg && <Alert type={msgType} message={msg} onClose={() => setMsg(null)} />}
      {error && <Alert type="error" message={error} />}

      <div className="card card-section">
        <h3 className="card-section-title">Perfil de usuario</h3>
        <p><strong>Email:</strong> {user?.email}</p>
        {user?.nombre && <p><strong>Nombre:</strong> {user.nombre}</p>}
        <p><strong>Rol:</strong> {user?.role}</p>
        <p><strong>Acceso web:</strong> {user?.accesoWeb === false ? 'No' : 'Sí'}</p>
        <p><strong>Acceso ventas:</strong> {user?.accesoVentas === false ? 'No' : 'Sí'}</p>
        <p><strong>ID:</strong> <code className="code-tag">{user?.id}</code></p>
        <div className="form-actions form-actions--flat">
          <button type="button" className="btn btn-ghost" disabled={resetSending} onClick={sendPasswordReset}>
            <span className="material-icons-round">lock_reset</span>
            {resetSending ? 'Enviando…' : 'Enviar restablecer contraseña'}
          </button>
        </div>
      </div>

      <div className="card card-section">
        <h3 className="card-section-title">Preferencias locales</h3>
        <p className="kpi-sub">Se guardan solo en este navegador (útil para abrir módulos de venta más rápido).</p>
        <FormSelect
          label="PV por defecto"
          value={defaultPvId}
          onChange={setDefaultPvId}
          options={[
            { value: '', label: '— Sin preferencia —' },
            ...pvUbicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
          ]}
        />
        <FormSelect
          label="Canal por defecto"
          value={defaultCanal}
          onChange={setDefaultCanal}
          options={[
            { value: '', label: '— Sin preferencia —' },
            ...canalesVenta.map((c) => ({ value: c.codigo, label: canalVentaLabel(c) })),
          ]}
        />
        <div className="form-actions form-actions--flat">
          <button type="button" className="btn btn-primary" onClick={savePrefs}>
            <span className="material-icons-round">save</span>
            Guardar preferencias
          </button>
        </div>
      </div>

      <div className="card card-section">
        <h3 className="card-section-title">Sistema</h3>
        <p><strong>Backend:</strong> Supabase (Bodega Santa María ERP)</p>
        <p><strong>Versión web:</strong> {WEB_VERSION}</p>
        <p>
          <strong>Catálogos:</strong>{' '}
          {loaded ? 'Cargados' : 'Pendientes'}
          {(loading || refreshing) && ' (actualizando…)'}
          {loaded && (
            <span className="kpi-sub">
              {' '}— {proveedores.length} proveedor(es), {clientes.length} cliente(s), {canalesVenta.length} canal(es)
            </span>
          )}
        </p>
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

      {isAdmin && (
        <div className="card card-section">
          <h3 className="card-section-title">Administración</h3>
          <p className="kpi-sub">Accesos rápidos a catálogos y permisos.</p>
          <div className="form-actions form-actions--flat">
            <Link to="/proveedores-clientes" className="btn btn-ghost">
              <span className="material-icons-round">contacts</span>
              Proveedores y clientes
            </Link>
            <Link to="/maestros" className="btn btn-ghost">
              <span className="material-icons-round">folder_shared</span>
              Maestros
            </Link>
            <Link to="/usuarios" className="btn btn-ghost">
              <span className="material-icons-round">manage_accounts</span>
              Usuarios
            </Link>
          </div>
        </div>
      )}

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
