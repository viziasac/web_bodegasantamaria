import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listMaestrosAdmin,
  upsertProveedor,
  upsertCliente,
  eliminarProveedor,
  eliminarCliente,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, TabBar, DataTable, EmptyState, FormInput, FormSelect,
  SearchInput, SubmitButton, FormSection, StatusBadge, toUserMessage,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useCatalog } from '../../context/CatalogContext';
import type { MaCliente, MaProveedor } from '../../types';

type PartnerTab = 'proveedores' | 'clientes';

const PROVEEDOR_TIPOS = [
  { value: '', label: '— Sin tipo —' },
  { value: 'INSUMOS', label: 'Insumos' },
  { value: 'ENVASES', label: 'Envases' },
  { value: 'SERVICIOS', label: 'Servicios' },
  { value: 'LOGISTICA', label: 'Logística' },
  { value: 'OTRO', label: 'Otro' },
];

const CLIENTE_TIPOS = [
  { value: '', label: '— Sin tipo —' },
  { value: 'MAYORISTA', label: 'Mayorista' },
  { value: 'DISTRIBUIDOR', label: 'Distribuidor' },
  { value: 'TIENDA_PROPIA', label: 'Tienda propia' },
  { value: 'MINIMARKET', label: 'Minimarket' },
  { value: 'NATURAL', label: 'Persona natural' },
  { value: 'JURIDICA', label: 'Persona jurídica' },
  { value: 'MINORISTA', label: 'Minorista' },
  { value: 'OTRO', label: 'Otro' },
];

const CONDICION_PAGO = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
];

const TIPO_DOC = [
  { value: '', label: '— Sin documento —' },
  { value: 'RUC', label: 'RUC' },
  { value: 'DNI', label: 'DNI' },
];

const BOOL_OPTS = [
  { value: '1', label: 'Sí' },
  { value: '0', label: 'No' },
];

const EMPTY_PROV = {
  nombre: '', codigo: '', tipo: '', tipo_documento: '', numero_documento: '',
  condicion_pago: 'CONTADO', contacto_nombre: '', direccion: '', distrito: '',
  telefono: '', email: '', observaciones: '', es_default: '0', activo: '1',
};

const EMPTY_CLI = {
  nombre: '', codigo: '', tipo: '', tipo_documento: '', numero_documento: '',
  condicion_pago: 'CONTADO', direccion: '', distrito: '',
  telefono: '', email: '', es_default: '0', activo: '1',
};

function docLabel(tipo?: string | null, numero?: string | null, legacy?: string | null): string {
  const n = numero?.trim() || legacy?.trim();
  if (!n) return '—';
  return tipo?.trim() ? `${tipo} ${n}` : n;
}

const ProveedoresClientesPage: React.FC = () => {
  const { refreshCatalog } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: PartnerTab = searchParams.get('tab') === 'clientes' ? 'clientes' : 'proveedores';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [proveedores, setProveedores] = useState<MaProveedor[]>([]);
  const [clientes, setClientes] = useState<MaCliente[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(EMPTY_PROV);

  const setTab = (id: string) => {
    setSearchParams(id === 'clientes' ? { tab: 'clientes' } : {});
    setQuery('');
    setError(null);
    setSuccess(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMaestrosAdmin();
      setProveedores(data.proveedores);
      setClientes(data.clientes);
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando catálogo'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId('');
    setForm(tab === 'proveedores' ? { ...EMPTY_PROV } : { ...EMPTY_CLI } as typeof EMPTY_PROV);
    setModalOpen(true);
  };

  const openEditProveedor = (p: MaProveedor) => {
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      codigo: p.codigo ?? '',
      tipo: p.tipo ?? '',
      tipo_documento: p.tipo_documento ?? '',
      numero_documento: p.numero_documento ?? p.ruc ?? '',
      condicion_pago: p.condicion_pago ?? 'CONTADO',
      contacto_nombre: p.contacto_nombre ?? '',
      direccion: p.direccion ?? '',
      distrito: p.distrito ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      observaciones: p.observaciones ?? '',
      es_default: p.es_default ? '1' : '0',
      activo: p.activo === false ? '0' : '1',
    });
    setModalOpen(true);
  };

  const openEditCliente = (c: MaCliente) => {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      codigo: c.codigo ?? '',
      tipo: c.tipo ?? '',
      tipo_documento: c.tipo_documento ?? '',
      numero_documento: c.numero_documento ?? c.ruc_dni ?? '',
      condicion_pago: c.condicion_pago ?? 'CONTADO',
      contacto_nombre: '',
      direccion: c.direccion ?? '',
      distrito: c.distrito ?? '',
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      observaciones: '',
      es_default: c.es_default ? '1' : '0',
      activo: c.activo === false ? '0' : '1',
    });
    setModalOpen(true);
  };

  const setField = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (tab === 'proveedores') {
        await upsertProveedor({
          id: editId || undefined,
          nombre: form.nombre,
          codigo: form.codigo || null,
          tipo: form.tipo || null,
          tipo_documento: form.tipo_documento || null,
          numero_documento: form.numero_documento || null,
          condicion_pago: form.condicion_pago,
          contacto_nombre: form.contacto_nombre || null,
          direccion: form.direccion || null,
          distrito: form.distrito || null,
          telefono: form.telefono || null,
          email: form.email || null,
          observaciones: form.observaciones || null,
          es_default: form.es_default === '1',
          activo: form.activo === '1',
        });
      } else {
        await upsertCliente({
          id: editId || undefined,
          nombre: form.nombre,
          codigo: form.codigo || null,
          tipo: form.tipo || null,
          tipo_documento: form.tipo_documento || null,
          numero_documento: form.numero_documento || null,
          condicion_pago: form.condicion_pago,
          direccion: form.direccion || null,
          distrito: form.distrito || null,
          telefono: form.telefono || null,
          email: form.email || null,
          es_default: form.es_default === '1',
          activo: form.activo === '1',
        });
      }
      setSuccess(editId ? 'Registro actualizado.' : 'Registro creado.');
      setModalOpen(false);
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MaProveedor | MaCliente) => {
    const label = row.nombre;
    if (row.es_default) {
      setError('No puede eliminar el registro predeterminado del sistema.');
      return;
    }
    if (!window.confirm(`¿Eliminar "${label}"?\n\nSi tiene compras/ventas/gastos vinculados se desactivará en lugar de borrarse.`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const result = tab === 'proveedores'
        ? await eliminarProveedor(row.id)
        : await eliminarCliente(row.id);
      setSuccess(result === 'deleted'
        ? `"${label}" eliminado.`
        : `"${label}" tiene movimientos vinculados — se desactivó.`);
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo eliminar'));
    }
  };

  const q = query.trim().toLowerCase();
  const filterRow = (nombre: string, codigo?: string | null, doc?: string) => {
    if (!q) return true;
    const hay = `${nombre} ${codigo ?? ''} ${doc ?? ''}`.toLowerCase();
    return hay.includes(q);
  };

  const provFiltered = useMemo(() => proveedores.filter((p) => {
    if (!showInactive && p.activo === false) return false;
    return filterRow(p.nombre, p.codigo, docLabel(p.tipo_documento, p.numero_documento, p.ruc));
  }), [proveedores, showInactive, q]);

  const cliFiltered = useMemo(() => clientes.filter((c) => {
    if (!showInactive && c.activo === false) return false;
    return filterRow(c.nombre, c.codigo, docLabel(c.tipo_documento, c.numero_documento, c.ruc_dni));
  }), [clientes, showInactive, q]);

  const modalTitle = editId
    ? `Editar ${tab === 'proveedores' ? 'proveedor' : 'cliente'}`
    : `Nuevo ${tab === 'proveedores' ? 'proveedor' : 'cliente'}`;

  return (
    <div className="animate-in">
      <PageHeader
        title="Proveedores y clientes"
        subtitle="Catálogo para compras, egresos y ventas (proveedor/cliente opcionales en operaciones)"
        moduleId="proveedores_clientes"
        action={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <span className="material-icons-round">add</span>
            Nuevo
          </button>
        )}
      />

      {error && !modalOpen && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'proveedores', label: 'Proveedores', icon: 'local_shipping' },
          { id: 'clientes', label: 'Clientes', icon: 'people' },
        ]}
      />

      <div className="form-actions form-actions--flat" style={{ marginBottom: '1rem', alignItems: 'center' }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={tab === 'proveedores' ? 'Buscar proveedor…' : 'Buscar cliente…'}
        />
        <label className="form-check" style={{ margin: 0, whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          <span>Ver inactivos</span>
        </label>
        <button type="button" className="btn btn-ghost" onClick={() => load()}>Actualizar</button>
      </div>

      {loading ? <PageLoader /> : (
        <div className="card">
          {tab === 'proveedores' && (
            provFiltered.length === 0 ? (
              <EmptyState
                icon="local_shipping"
                title="Sin proveedores"
                hint={proveedores.length === 0
                  ? 'Cree el primer proveedor con el botón Nuevo.'
                  : 'Ningún proveedor coincide con el filtro.'}
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Documento</th>
                    <th>Pago</th>
                    <th>Activo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {provFiltered.map((p) => (
                    <tr key={p.id} className={p.activo === false ? 'row-muted' : undefined}>
                      <td>
                        {p.nombre}
                        {p.es_default && <small style={{ display: 'block', opacity: 0.7 }}>Predeterminado</small>}
                      </td>
                      <td>{p.codigo ? <code className="code-tag">{p.codigo}</code> : '—'}</td>
                      <td>{p.tipo || '—'}</td>
                      <td>{docLabel(p.tipo_documento, p.numero_documento, p.ruc)}</td>
                      <td>{p.condicion_pago || '—'}</td>
                      <td><StatusBadge ok={p.activo !== false} okLabel="Sí" failLabel="No" /></td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditProveedor(p)}>Editar</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={p.es_default} onClick={() => handleDelete(p)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}

          {tab === 'clientes' && (
            cliFiltered.length === 0 ? (
              <EmptyState
                icon="people"
                title="Sin clientes"
                hint={clientes.length === 0
                  ? 'Cree el primer cliente con el botón Nuevo.'
                  : 'Ningún cliente coincide con el filtro.'}
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Segmento</th>
                    <th>Documento</th>
                    <th>Pago</th>
                    <th>Activo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cliFiltered.map((c) => (
                    <tr key={c.id} className={c.activo === false ? 'row-muted' : undefined}>
                      <td>
                        {c.nombre}
                        {c.es_default && <small style={{ display: 'block', opacity: 0.7 }}>Predeterminado</small>}
                      </td>
                      <td>{c.codigo ? <code className="code-tag">{c.codigo}</code> : '—'}</td>
                      <td>{c.tipo || '—'}</td>
                      <td>{docLabel(c.tipo_documento, c.numero_documento, c.ruc_dni)}</td>
                      <td>{c.condicion_pago || '—'}</td>
                      <td><StatusBadge ok={c.activo !== false} okLabel="Sí" failLabel="No" /></td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditCliente(c)}>Editar</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={c.es_default} onClick={() => handleDelete(c)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}
        </div>
      )}

      <Modal title={modalTitle} isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)}>
        {error && modalOpen && <Alert type="error" message={error} />}
        <form onSubmit={save}>
          <FormSection title="Identificación">
            <FormInput label="Nombre" value={form.nombre} onChange={(v) => setField('nombre', v)} required />
            <FormInput label="Código interno (opcional)" value={form.codigo} onChange={(v) => setField('codigo', v)} placeholder="Se genera PROV-0001 / CLI-0001 si se deja vacío" />
            <FormSelect label="Tipo / segmento" value={form.tipo} onChange={(v) => setField('tipo', v)}
              options={tab === 'proveedores' ? PROVEEDOR_TIPOS : CLIENTE_TIPOS} />
          </FormSection>
          <FormSection title="Documento y pago">
            <FormSelect label="Tipo documento" value={form.tipo_documento} onChange={(v) => setField('tipo_documento', v)} options={TIPO_DOC} />
            <FormInput label="N° documento (opcional)" value={form.numero_documento} onChange={(v) => setField('numero_documento', v)} />
            <FormSelect label="Condición de pago" value={form.condicion_pago} onChange={(v) => setField('condicion_pago', v)} options={CONDICION_PAGO} required />
          </FormSection>
          <FormSection title="Contacto">
            {tab === 'proveedores' && (
              <FormInput label="Contacto" value={form.contacto_nombre} onChange={(v) => setField('contacto_nombre', v)} />
            )}
            <FormInput label="Teléfono" value={form.telefono} onChange={(v) => setField('telefono', v)} />
            <FormInput label="Email" value={form.email} onChange={(v) => setField('email', v)} />
            <FormInput label="Dirección" value={form.direccion} onChange={(v) => setField('direccion', v)} />
            <FormInput label="Distrito" value={form.distrito} onChange={(v) => setField('distrito', v)} />
            {tab === 'proveedores' && (
              <FormInput label="Observaciones" value={form.observaciones} onChange={(v) => setField('observaciones', v)} />
            )}
          </FormSection>
          <FormSection title="Estado">
            <FormSelect label="Predeterminado" value={form.es_default} onChange={(v) => setField('es_default', v)}
              options={BOOL_OPTS} />
            <FormSelect label="Activo" value={form.activo} onChange={(v) => setField('activo', v)}
              options={BOOL_OPTS} required />
          </FormSection>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => !saving && setModalOpen(false)}>Cancelar</button>
            <SubmitButton loading={saving} label="Guardar" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProveedoresClientesPage;
