import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listMaestrosAdmin,
  upsertProveedor,
  upsertCliente,
  setProveedorActivo,
  setClienteActivo,
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

function PartnerRowActions({
  row,
  entityLabel,
  onEdit,
  onToggleActivo,
  toggling,
}: {
  row: MaProveedor | MaCliente;
  entityLabel: string;
  onEdit: () => void;
  onToggleActivo: (activo: boolean) => void;
  toggling: boolean;
}) {
  const isActive = row.activo !== false;
  const isDefault = Boolean(row.es_default);

  return (
    <td className="cell-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
        Editar
      </button>
      {isActive ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={isDefault || toggling}
          title={isDefault ? `El ${entityLabel} predeterminado no se puede desactivar` : undefined}
          onClick={() => onToggleActivo(false)}
        >
          Desactivar
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={toggling}
          onClick={() => onToggleActivo(true)}
        >
          Reactivar
        </button>
      )}
    </td>
  );
}

const ProveedoresClientesPage: React.FC = () => {
  const { refreshCatalog } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: PartnerTab = searchParams.get('tab') === 'clientes' ? 'clientes' : 'proveedores';
  const entityLabel = tab === 'proveedores' ? 'proveedor' : 'cliente';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
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
    setError(null);
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
    setError(null);
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
    setError(null);
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
      const activo = editId ? form.activo === '1' : true;
      if (tab === 'proveedores') {
        await upsertProveedor({
          id: editId || undefined,
          nombre: form.nombre,
          codigo: editId ? (form.codigo || null) : null,
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
          activo,
        });
      } else {
        await upsertCliente({
          id: editId || undefined,
          nombre: form.nombre,
          codigo: editId ? (form.codigo || null) : null,
          tipo: form.tipo || null,
          tipo_documento: form.tipo_documento || null,
          numero_documento: form.numero_documento || null,
          condicion_pago: form.condicion_pago,
          direccion: form.direccion || null,
          distrito: form.distrito || null,
          telefono: form.telefono || null,
          email: form.email || null,
          es_default: form.es_default === '1',
          activo,
        });
      }
      setSuccess(editId ? `${entityLabel} actualizado.` : `${entityLabel} creado y activo.`);
      setModalOpen(false);
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (row: MaProveedor | MaCliente, activo: boolean) => {
    if (row.es_default && !activo) {
      setError(`No puede desactivar el ${entityLabel} predeterminado del sistema.`);
      return;
    }
    if (!activo) {
      const ok = window.confirm(
        `¿Desactivar "${row.nombre}"?\n\nDejará de aparecer en compras, egresos y ventas, pero el historial en base de datos se conserva.`,
      );
      if (!ok) return;
    }
    setTogglingId(row.id);
    setError(null);
    setSuccess(null);
    try {
      if (tab === 'proveedores') {
        await setProveedorActivo(row.id, activo);
      } else {
        await setClienteActivo(row.id, activo);
      }
      setSuccess(activo
        ? `"${row.nombre}" reactivado — visible en operaciones.`
        : `"${row.nombre}" desactivado — ya no aparece en listas operativas.`);
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, `No se pudo ${activo ? 'reactivar' : 'desactivar'}`));
    } finally {
      setTogglingId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filterRow = (nombre: string, codigo?: string | null, doc?: string) => {
    if (!q) return true;
    const hay = `${nombre} ${codigo ?? ''} ${doc ?? ''}`.toLowerCase();
    return hay.includes(q);
  };

  const list = tab === 'proveedores' ? proveedores : clientes;
  const activeCount = list.filter((r) => r.activo !== false).length;
  const inactiveCount = list.length - activeCount;

  const provFiltered = useMemo(() => proveedores.filter((p) => {
    if (!showInactive && p.activo === false) return false;
    return filterRow(p.nombre, p.codigo, docLabel(p.tipo_documento, p.numero_documento, p.ruc));
  }), [proveedores, showInactive, q]);

  const cliFiltered = useMemo(() => clientes.filter((c) => {
    if (!showInactive && c.activo === false) return false;
    return filterRow(c.nombre, c.codigo, docLabel(c.tipo_documento, c.numero_documento, c.ruc_dni));
  }), [clientes, showInactive, q]);

  const modalTitle = editId
    ? `Editar ${entityLabel}`
    : `Nuevo ${entityLabel}`;

  const editingDefault = editId && form.es_default === '1';

  return (
    <div className="animate-in">
      <PageHeader
        title="Proveedores y clientes"
        subtitle="Alta y edición de catálogo — la baja es lógica (activo/inactivo), sin borrado en BD"
        moduleId="proveedores_clientes"
        action={(
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <span className="material-icons-round">add</span>
            Nuevo {entityLabel}
          </button>
        )}
      />

      {error && !modalOpen && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <Alert type="info">
        Los registros <strong>inactivos</strong> no aparecen en compras, egresos ni ventas, pero se conservan
        en Supabase para historial y auditoría. Use <em>Desactivar</em> en lugar de eliminar.
      </Alert>

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'proveedores', label: 'Proveedores', icon: 'local_shipping' },
          { id: 'clientes', label: 'Clientes', icon: 'people' },
        ]}
      />

      <div className="kpi-sub" style={{ marginBottom: '0.75rem' }}>
        {activeCount} activo{activeCount !== 1 ? 's' : ''}
        {inactiveCount > 0 && ` · ${inactiveCount} inactivo${inactiveCount !== 1 ? 's' : ''}`}
        {!showInactive && inactiveCount > 0 && ' (active «Ver inactivos» para gestionarlos)'}
      </div>

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
                title={showInactive ? 'Sin proveedores en esta vista' : 'Sin proveedores activos'}
                hint={proveedores.length === 0
                  ? 'Cree el primer proveedor con el botón Nuevo proveedor.'
                  : showInactive
                    ? 'Ningún proveedor coincide con la búsqueda.'
                    : 'No hay proveedores activos. Active «Ver inactivos» o cree uno nuevo.'}
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
                    <th>Estado</th>
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
                      <td>
                        <StatusBadge
                          ok={p.activo !== false}
                          okLabel="Activo"
                          failLabel="Inactivo"
                        />
                      </td>
                      <PartnerRowActions
                        row={p}
                        entityLabel="proveedor"
                        onEdit={() => openEditProveedor(p)}
                        onToggleActivo={(activo) => handleToggleActivo(p, activo)}
                        toggling={togglingId === p.id}
                      />
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
                title={showInactive ? 'Sin clientes en esta vista' : 'Sin clientes activos'}
                hint={clientes.length === 0
                  ? 'Cree el primer cliente con el botón Nuevo cliente.'
                  : showInactive
                    ? 'Ningún cliente coincide con la búsqueda.'
                    : 'No hay clientes activos. Active «Ver inactivos» o cree uno nuevo.'}
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
                    <th>Estado</th>
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
                      <td>
                        <StatusBadge
                          ok={c.activo !== false}
                          okLabel="Activo"
                          failLabel="Inactivo"
                        />
                      </td>
                      <PartnerRowActions
                        row={c}
                        entityLabel="cliente"
                        onEdit={() => openEditCliente(c)}
                        onToggleActivo={(activo) => handleToggleActivo(c, activo)}
                        toggling={togglingId === c.id}
                      />
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
            {editId ? (
              <p className="kpi-sub">
                Código: <code className="code-tag">{form.codigo || '—'}</code>
                {form.codigo ? '' : ' (se asigna automáticamente al crear)'}
              </p>
            ) : (
              <p className="kpi-sub">
                El código interno (PROV-0001 / CLI-0001) se genera automáticamente al guardar.
              </p>
            )}
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
          {editId && (
            <FormSection title="Estado en catálogo">
              {editingDefault && (
                <Alert type="info" message="Registro predeterminado: no puede desactivarse ni dejar de ser predeterminado desde aquí sin otro activo." />
              )}
              <FormSelect
                label="Activo en listas operativas"
                value={form.activo}
                onChange={(v) => setField('activo', v)}
                options={editingDefault ? [{ value: '1', label: 'Activo' }] : BOOL_OPTS}
                required
              />
              <p className="kpi-sub">
                Inactivo = no aparece en dropdowns de compras/egresos/ventas; el registro sigue en base de datos.
              </p>
              {!editingDefault && (
                <FormSelect label="Predeterminado" value={form.es_default} onChange={(v) => setField('es_default', v)}
                  options={BOOL_OPTS} />
              )}
            </FormSection>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => !saving && setModalOpen(false)}>Cancelar</button>
            <SubmitButton loading={saving} label={editId ? 'Guardar cambios' : `Crear ${entityLabel}`} />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProveedoresClientesPage;
