import React, { useCallback, useEffect, useState } from 'react';
import { listarUsuariosAdmin, actualizarPermisosUsuario } from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState, FormInput, FormSelect,
  SearchInput, SubmitButton, StatusBadge, toUserMessage,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import type { AppUserRoleRow, UserRole } from '../../types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'operario', label: 'Operario' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
  { value: 'administrador', label: 'Administrador' },
];

const BOOL_OPTS = [
  { value: '1', label: 'Sí' },
  { value: '0', label: 'No' },
];

function flagLabel(v: boolean | null | undefined): string {
  return v === false ? 'No' : 'Sí';
}

const UsuariosPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rows, setRows] = useState<AppUserRoleRow[]>([]);
  const [query, setQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<AppUserRoleRow | null>(null);
  const [nombre, setNombre] = useState('');
  const [role, setRole] = useState<string>('operario');
  const [activo, setActivo] = useState('1');
  const [accesoWeb, setAccesoWeb] = useState('1');
  const [accesoApp, setAccesoApp] = useState('1');
  const [accesoVentas, setAccesoVentas] = useState('1');

  const isSelf = Boolean(edit && user?.id === edit.user_id);

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

  useEffect(() => { load(); }, [load]);

  const openEdit = (u: AppUserRoleRow) => {
    setEdit(u);
    setNombre(u.nombre ?? '');
    setRole(String(u.role || 'operario').toLowerCase());
    setActivo(u.activo === false ? '0' : '1');
    setAccesoWeb(u.acceso_web === false ? '0' : '1');
    setAccesoApp(u.acceso_app === false ? '0' : '1');
    setAccesoVentas(u.acceso_ventas === false ? '0' : '1');
    setSuccess(null);
    setError(null);
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit || saving) return;
    if (isSelf && (activo === '0' || accesoWeb === '0')) {
      setError('No puede desactivar su cuenta ni quitarse el acceso web.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await actualizarPermisosUsuario({
        userId: edit.user_id,
        role,
        activo: activo === '1',
        accesoWeb: accesoWeb === '1',
        accesoApp: accesoApp === '1',
        accesoVentas: accesoVentas === '1',
        nombre: nombre.trim() || null,
      });
      setModalOpen(false);
      setSuccess('Permisos actualizados. El usuario verá el cambio al refrescar o volver a iniciar sesión.');
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudieron guardar los permisos'));
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => {
      const hay = `${r.email ?? ''} ${r.nombre ?? ''} ${r.role ?? ''}`.toLowerCase();
      return hay.includes(q);
    })
    : rows;

  if (loading) return <PageLoader />;

  return (
    <div className="page-module">
      <PageHeader
        title="Usuarios"
        subtitle="Roles y permisos de acceso (solo administradores)"
        moduleId="usuarios"
      />

      {error && !modalOpen && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}
      {success && (
        <Alert type="success" message={success} onClose={() => setSuccess(null)} />
      )}

      <Alert type="info">
        Las cuentas se crean en Supabase Auth (invitar usuario). Aquí solo se gestionan rol y flags
        de quienes ya aparecen en app_user_role.
      </Alert>

      <div className="form-actions form-actions--flat" style={{ marginBottom: '1rem', alignItems: 'center' }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Email, nombre o rol…" />
        <button type="button" className="btn btn-ghost" onClick={() => load()}>
          Actualizar
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="manage_accounts"
          title="Sin usuarios"
          hint={rows.length === 0
            ? 'No hay filas en app_user_role. Invite usuarios desde el panel de Auth de Supabase.'
            : 'Ningún usuario coincide con la búsqueda.'}
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Web</th>
              <th>App</th>
              <th>Ventas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const selfRow = user?.id === u.user_id;
              return (
                <tr key={u.user_id}>
                  <td>
                    {u.email || '—'}
                    {selfRow && <small style={{ display: 'block', opacity: 0.7 }}>Usted</small>}
                  </td>
                  <td>{u.nombre || '—'}</td>
                  <td><code className="code-tag">{u.role}</code></td>
                  <td><StatusBadge ok={u.activo !== false} okLabel="Sí" failLabel="No" /></td>
                  <td>{flagLabel(u.acceso_web)}</td>
                  <td>{flagLabel(u.acceso_app)}</td>
                  <td>{flagLabel(u.acceso_ventas)}</td>
                  <td className="cell-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={edit ? `Permisos — ${edit.email || edit.user_id}` : 'Permisos'}
      >
        {error && modalOpen && <Alert type="error" message={error} />}
        {isSelf && (
          <Alert
            type="info"
            message="No puede desactivar su propia cuenta ni quitarse el acceso web."
          />
        )}
        <form onSubmit={save}>
          <FormInput label="Nombre" value={nombre} onChange={setNombre} placeholder="Nombre visible" />
          <FormSelect label="Rol" value={role} onChange={setRole} options={ROLE_OPTIONS} required />
          <FormSelect
            label="Activo"
            value={activo}
            onChange={setActivo}
            options={isSelf ? [{ value: '1', label: 'Sí' }] : BOOL_OPTS}
            required
          />
          <FormSelect
            label="Acceso web"
            value={accesoWeb}
            onChange={setAccesoWeb}
            options={isSelf ? [{ value: '1', label: 'Sí' }] : BOOL_OPTS}
            required
          />
          <FormSelect label="Acceso app" value={accesoApp} onChange={setAccesoApp} options={BOOL_OPTS} required />
          <FormSelect label="Acceso ventas" value={accesoVentas} onChange={setAccesoVentas} options={BOOL_OPTS} required />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => !saving && setModalOpen(false)}>
              Cancelar
            </button>
            <SubmitButton loading={saving} label="Guardar" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UsuariosPage;
