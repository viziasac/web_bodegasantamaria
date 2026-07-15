import React, { useCallback, useEffect, useState } from 'react';
import {
  listMaestrosAdmin,
  upsertProveedor, upsertCliente, upsertCanalVenta,
  upsertEmpaqueTipo, upsertCategoriaGasto,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, TabBar, DataTable, EmptyState, FormInput, FormSelect,
  SubmitButton, FormSection, toUserMessage,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useCatalog } from '../../context/CatalogContext';
import type { GasCategoria, MaCliente, MaEmpaqueTipo, MaProveedor } from '../../types';

type MaestroTab = 'proveedores' | 'clientes' | 'canales' | 'empaques' | 'categorias';

const MaestrosPage: React.FC = () => {
  const { refreshCatalog } = useCatalog();
  const [tab, setTab] = useState<MaestroTab>('proveedores');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [proveedores, setProveedores] = useState<MaProveedor[]>([]);
  const [clientes, setClientes] = useState<MaCliente[]>([]);
  const [canales, setCanales] = useState<{ codigo: string; nombre: string }[]>([]);
  const [empaques, setEmpaques] = useState<MaEmpaqueTipo[]>([]);
  const [categorias, setCategorias] = useState<GasCategoria[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string>('');
  const [campoA, setCampoA] = useState('');
  const [campoB, setCampoB] = useState('');
  const [activo, setActivo] = useState('1');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMaestrosAdmin();
      setProveedores(data.proveedores);
      setClientes(data.clientes);
      setCanales(data.canales);
      setEmpaques(data.empaques);
      setCategorias(data.categorias);
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando maestros'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId('');
    setCampoA('');
    setCampoB('');
    setActivo('1');
    setModalOpen(true);
  };

  const openEditProveedor = (p: MaProveedor) => {
    setEditId(p.id);
    setCampoA(p.nombre);
    setCampoB(p.ruc ?? '');
    setActivo(p.activo === false ? '0' : '1');
    setModalOpen(true);
  };

  const openEditCliente = (c: MaCliente) => {
    setEditId(c.id);
    setCampoA(c.nombre);
    setCampoB(c.tipo ?? '');
    setActivo(c.activo === false ? '0' : '1');
    setModalOpen(true);
  };

  const openEditCanal = (c: { codigo: string; nombre: string }) => {
    setEditId(c.codigo);
    setCampoA(c.nombre);
    setCampoB(c.codigo);
    setActivo('1');
    setModalOpen(true);
  };

  const openEditEmpaque = (e: MaEmpaqueTipo) => {
    setEditId(e.id);
    setCampoA(e.nombre);
    setCampoB(String(e.factor));
    setActivo(e.activo === false ? '0' : '1');
    setModalOpen(true);
  };

  const openEditCategoria = (c: GasCategoria) => {
    setEditId(c.id);
    setCampoA(c.nombre);
    setCampoB(c.centro_costo ?? '');
    setActivo(c.activo === false ? '0' : '1');
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (tab === 'proveedores') {
        await upsertProveedor({
          id: editId || undefined,
          nombre: campoA,
          ruc: campoB || undefined,
          activo: activo === '1',
        });
      } else if (tab === 'clientes') {
        await upsertCliente({
          id: editId || undefined,
          nombre: campoA,
          tipo: campoB || undefined,
          activo: activo === '1',
        });
      } else if (tab === 'canales') {
        if (editId) {
          await upsertCanalVenta({ codigoOriginal: editId, nombre: campoA });
        } else {
          await upsertCanalVenta({ codigo: campoB, nombre: campoA });
        }
      } else if (tab === 'empaques') {
        const factor = parseInt(campoB, 10);
        await upsertEmpaqueTipo({
          id: editId || undefined,
          nombre: campoA,
          factor,
          activo: activo === '1',
        });
      } else {
        await upsertCategoriaGasto({
          id: editId || undefined,
          nombre: campoA,
          centro_costo: campoB || undefined,
          activo: activo === '1',
        });
      }
      setSuccess('Registro guardado.');
      setModalOpen(false);
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = editId
    ? `Editar ${tab}`
    : `Nuevo ${tab.slice(0, -1)}`;

  return (
    <div className="animate-in">
      <PageHeader
        title="Maestros"
        subtitle="Proveedores, clientes, canales, empaques y categorías de gasto"
        moduleId="maestros"
        action={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <span className="material-icons-round">add</span>
            Nuevo
          </button>
        }
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <TabBar
        active={tab}
        onChange={(id) => setTab(id as MaestroTab)}
        tabs={[
          { id: 'proveedores', label: 'Proveedores', icon: 'local_shipping' },
          { id: 'clientes', label: 'Clientes', icon: 'people' },
          { id: 'canales', label: 'Canales', icon: 'storefront' },
          { id: 'empaques', label: 'Empaques', icon: 'inventory_2' },
          { id: 'categorias', label: 'Cat. gasto', icon: 'category' },
        ]}
      />

      {loading ? <PageLoader /> : (
        <div className="card">
          {tab === 'proveedores' && (
            proveedores.length === 0 ? <EmptyState icon="local_shipping" title="Sin proveedores" /> : (
              <DataTable>
                <thead><tr><th>Nombre</th><th>RUC</th><th>Activo</th><th /></tr></thead>
                <tbody>
                  {proveedores.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{p.ruc || '—'}</td>
                      <td>{p.activo === false ? 'No' : 'Sí'}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditProveedor(p)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}
          {tab === 'clientes' && (
            clientes.length === 0 ? <EmptyState icon="people" title="Sin clientes" /> : (
              <DataTable>
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Activo</th><th /></tr></thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nombre}</td>
                      <td>{c.tipo || '—'}</td>
                      <td>{c.activo === false ? 'No' : 'Sí'}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditCliente(c)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}
          {tab === 'canales' && (
            canales.length === 0 ? <EmptyState icon="storefront" title="Sin canales" /> : (
              <DataTable>
                <thead><tr><th>Código</th><th>Nombre</th><th /></tr></thead>
                <tbody>
                  {canales.map((c) => (
                    <tr key={c.codigo}>
                      <td><code className="code-tag">{c.codigo}</code></td>
                      <td>{c.nombre}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditCanal(c)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}
          {tab === 'empaques' && (
            empaques.length === 0 ? <EmptyState icon="inventory_2" title="Sin tipos de empaque" /> : (
              <DataTable>
                <thead><tr><th>Nombre</th><th>Factor (botellas)</th><th>Activo</th><th /></tr></thead>
                <tbody>
                  {empaques.map((e) => (
                    <tr key={e.id}>
                      <td>{e.nombre}</td>
                      <td>{e.factor}</td>
                      <td>{e.activo === false ? 'No' : 'Sí'}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditEmpaque(e)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}
          {tab === 'categorias' && (
            categorias.length === 0 ? <EmptyState icon="category" title="Sin categorías de gasto" /> : (
              <DataTable>
                <thead><tr><th>Nombre</th><th>Centro costo</th><th>Activo</th><th /></tr></thead>
                <tbody>
                  {categorias.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nombre}</td>
                      <td>{c.centro_costo || '—'}</td>
                      <td>{c.activo === false ? 'No' : 'Sí'}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditCategoria(c)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          )}
        </div>
      )}

      <Modal title={modalTitle} isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={save}>
          <FormSection title="Datos">
            {tab === 'proveedores' && (
              <>
                <FormInput label="Nombre" value={campoA} onChange={setCampoA} required />
                <FormInput label="RUC (opcional)" value={campoB} onChange={setCampoB} />
                <FormSelect label="Activo" value={activo} onChange={setActivo}
                  options={[{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]} required />
              </>
            )}
            {tab === 'clientes' && (
              <>
                <FormInput label="Nombre" value={campoA} onChange={setCampoA} required />
                <FormSelect label="Tipo (opcional)" value={campoB} onChange={setCampoB}
                  options={[
                    { value: '', label: '— Sin tipo —' },
                    { value: 'natural', label: 'Persona natural' },
                    { value: 'juridica', label: 'Empresa' },
                    { value: 'mayorista', label: 'Mayorista' },
                    { value: 'minorista', label: 'Minorista' },
                  ]} />
                <FormSelect label="Activo" value={activo} onChange={setActivo}
                  options={[{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]} required />
              </>
            )}
            {tab === 'canales' && (
              <>
                {!editId && (
                  <FormInput label="Código" value={campoB} onChange={setCampoB} required placeholder="Ej: DIRECTO" />
                )}
                {editId && <p className="kpi-sub">Código: <code className="code-tag">{editId}</code> (no se modifica)</p>}
                <FormInput label="Nombre" value={campoA} onChange={setCampoA} required />
              </>
            )}
            {tab === 'empaques' && (
              <>
                <FormInput label="Nombre" value={campoA} onChange={setCampoA} required />
                <FormInput label="Factor (botellas por empaque)" type="number" value={campoB} onChange={setCampoB} required min={1} />
                <FormSelect label="Activo" value={activo} onChange={setActivo}
                  options={[{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]} required />
              </>
            )}
            {tab === 'categorias' && (
              <>
                <FormInput label="Nombre" value={campoA} onChange={setCampoA} required />
                <FormSelect label="Centro de costo (opcional)" value={campoB} onChange={setCampoB}
                  options={[
                    { value: '', label: '— Ninguno —' },
                    { value: 'BODEGA', label: 'Bodega' },
                    { value: 'PRODUCCION', label: 'Producción' },
                    { value: 'VENTAS', label: 'Ventas' },
                    { value: 'ADMIN', label: 'Administración' },
                  ]} />
                <FormSelect label="Activo" value={activo} onChange={setActivo}
                  options={[{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]} required />
              </>
            )}
          </FormSection>
          <div className="form-actions">
            <SubmitButton loading={saving} label="Guardar" icon="save" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MaestrosPage;
