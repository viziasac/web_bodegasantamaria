import React, { useCallback, useEffect, useState } from 'react';
import { listarUsuariosAdmin } from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState,
  SearchInput, StatusBadge, toUserMessage,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AppUserRoleRow } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  operario: 'Operario',
  supervisor: 'Supervisor',
  admin: 'Admin',
  administrador: 'Administrador',
};

function flagLabel(v: boolean | null | undefined): string {
  return v === false ? 'No' : 'Sí';
}

function roleLabel(role?: string | null): string {
  if (!role) return '—';
  const key = role.toLowerCase();
  return ROLE_LABELS[key] ?? role;
}

/**
 * Consulta de usuarios (app_user_role). Solo lectura — sin editar permisos en la web.
 */
const UsuariosPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AppUserRoleRow[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listarUsuariosAdmin());
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando usuarios'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => {
      const hay = `${r.email ?? ''} ${r.nombre ?? ''} ${r.role ?? ''}`.toLowerCase();
      return hay.includes(q);
    })
    : rows;

  if (loading) return <PageLoader />;

  return (
    <div className="animate-in usuarios-page">
      <PageHeader
        title="Usuarios"
        subtitle="Consulta de cuentas y accesos — solo lectura"
        moduleId="usuarios"
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <Alert type="info">
        Aquí solo se <strong>consultan</strong> usuarios ya registrados (correo, nombre, rol y accesos).
        Para invitar o cambiar permisos use el panel de administración de cuentas; los cambios se reflejan al actualizar.
      </Alert>

      <div className="partners-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por correo, nombre o rol…" />
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          <span className="material-icons-round">refresh</span>
          Actualizar
        </button>
        <span className="kpi-sub partners-toolbar-stats">
          {rows.length} usuario{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="manage_accounts"
          title="Sin usuarios"
          hint={rows.length === 0
            ? 'Aún no hay usuarios en el sistema. Invite cuentas desde el panel de Auth; aparecerán aquí al existir en el catálogo de roles.'
            : 'Ningún usuario coincide con la búsqueda.'}
        />
      ) : (
        <div className="card">
          <DataTable>
            <thead>
              <tr>
                <th>Correo</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Activo</th>
                <th>Web</th>
                <th>App</th>
                <th>Ventas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const selfRow = user?.id === u.user_id;
                return (
                  <tr key={u.user_id} className={u.activo === false ? 'row-muted' : undefined}>
                    <td>
                      <span className="usuarios-email">{u.email || '—'}</span>
                      {selfRow && <small className="partners-default-tag">Usted</small>}
                    </td>
                    <td>{u.nombre || '—'}</td>
                    <td>
                      <span className="status-tag status-neutral">{roleLabel(u.role)}</span>
                    </td>
                    <td>
                      <StatusBadge ok={u.activo !== false} okLabel="Activo" failLabel="Inactivo" />
                    </td>
                    <td>{flagLabel(u.acceso_web)}</td>
                    <td>{flagLabel(u.acceso_app)}</td>
                    <td>{flagLabel(u.acceso_ventas)}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
