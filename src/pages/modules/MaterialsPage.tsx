import React, { useEffect, useMemo, useState } from 'react';
import {
  createItem, createPresentacion, getEmpaqueTipos, getItems, getPresentaciones,
  updateItem, updatePresentacion,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState, FormSelect, FormInput,
  SubmitButton, TabBar, ModuleHelp, FormSection, toUserMessage, fmtNum,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useCatalog } from '../../context/CatalogContext';
import type { MaEmpaqueTipo, MaItem, MaPresentacion } from '../../types';

const TIPOS_ITEM = [
  { value: 'INSUMO', label: 'INSUMO' },
  { value: 'EMPAQUE', label: 'EMPAQUE' },
  { value: 'GRANEL', label: 'GRANEL' },
  { value: 'MATERIAL', label: 'MATERIAL' },
  { value: 'PT', label: 'PT (producto terminado)' },
];

const UNIDADES_POR_TIPO: Record<string, string> = {
  INSUMO: 'Unidades',
  EMPAQUE: 'Unidades',
  MATERIAL: 'Unidades',
  PT: 'Unidades',
  GRANEL: 'Litros',
};

/**
 * Catálogo admin: ver + crear + editar materiales e ítems PT / SKUs comerciales.
 * No elimina registros (RLS sin DELETE en ma_item / ma_presentacion).
 */
const MaterialsPage: React.FC = () => {
  const { refreshCatalog } = useCatalog();
  const [tab, setTab] = useState<'items' | 'skus'>('items');
  const [items, setItems] = useState<MaItem[]>([]);
  const [skus, setSkus] = useState<MaPresentacion[]>([]);
  const [empaques, setEmpaques] = useState<MaEmpaqueTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState('');
  const [search, setSearch] = useState('');

  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem] = useState<MaItem | null>(null);
  const [skuModal, setSkuModal] = useState(false);
  const [editSku, setEditSku] = useState<MaPresentacion | null>(null);
  const [saving, setSaving] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('INSUMO');
  const [unidad, setUnidad] = useState('Unidades');
  const [categoria, setCategoria] = useState('');
  const [stockMin, setStockMin] = useState('0');
  const [activo, setActivo] = useState(true);
  const [granelBaseId, setGranelBaseId] = useState('');

  const [skuCodigo, setSkuCodigo] = useState('');
  const [skuNombre, setSkuNombre] = useState('');
  const [skuItemId, setSkuItemId] = useState('');
  const [skuEmpaqueId, setSkuEmpaqueId] = useState('');
  const [skuActivo, setSkuActivo] = useState(true);

  const graneles = useMemo(() => items.filter((i) => i.tipo === 'GRANEL'), [items]);
  const pts = useMemo(() => items.filter((i) => i.tipo === 'PT'), [items]);
  const empSel = empaques.find((e) => e.id === skuEmpaqueId);

  const itemsFiltrados = useMemo(() => {
    let list = items;
    if (tipoFilter) list = list.filter((i) => i.tipo === tipoFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        i.codigo.toLowerCase().includes(q) || i.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [items, tipoFilter, search]);

  const skusFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skus;
    return skus.filter((s) =>
      (s.codigo ?? '').toLowerCase().includes(q)
      || s.nombre.toLowerCase().includes(q)
      || (s.ma_item?.nombre ?? '').toLowerCase().includes(q));
  }, [skus, search]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [its, pres, emps] = await Promise.all([
        getItems({ includeInactive: true }),
        getPresentaciones(undefined, { includeInactive: true }),
        getEmpaqueTipos(),
      ]);
      setItems(its);
      setSkus(pres);
      setEmpaques(emps);
      if (!skuEmpaqueId && emps.length) {
        const botella = emps.find((e) => e.factor === 1) ?? emps[0];
        setSkuEmpaqueId(botella.id);
      }
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando catálogo'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editItem) return;
    setUnidad(UNIDADES_POR_TIPO[tipo] ?? 'Unidades');
    if (tipo !== 'PT') setGranelBaseId('');
  }, [tipo, editItem]);

  const resetItemForm = () => {
    setCodigo('');
    setNombre('');
    setTipo('INSUMO');
    setUnidad('Unidades');
    setCategoria('');
    setStockMin('0');
    setActivo(true);
    setGranelBaseId('');
    setEditItem(null);
  };

  const resetSkuForm = () => {
    setSkuCodigo('');
    setSkuNombre('');
    setSkuItemId('');
    setSkuActivo(true);
    setEditSku(null);
  };

  const openCreateItem = () => {
    resetItemForm();
    setItemModal(true);
  };

  const openEditItem = (item: MaItem) => {
    setEditItem(item);
    setCodigo(item.codigo);
    setNombre(item.nombre);
    setTipo(item.tipo);
    setUnidad(item.unidad_medida);
    setCategoria(item.categoria ?? '');
    setStockMin(String(item.stock_minimo ?? 0));
    setActivo(item.activo !== false);
    setGranelBaseId('');
    setItemModal(true);
  };

  const openCreateSku = () => {
    resetSkuForm();
    setSkuModal(true);
  };

  const openEditSku = (sku: MaPresentacion) => {
    setEditSku(sku);
    setSkuCodigo(sku.codigo ?? '');
    setSkuNombre(sku.nombre);
    setSkuItemId(sku.item_id);
    setSkuEmpaqueId(sku.empaque_id ?? skuEmpaqueId);
    setSkuActivo(sku.activo !== false);
    setSkuModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const min = parseFloat(stockMin);
      if (editItem) {
        await updateItem({
          id: editItem.id,
          nombre,
          unidad_medida: unidad,
          categoria: categoria || null,
          stock_minimo: Number.isFinite(min) ? min : 0,
          activo,
        });
        setSuccess(`Ítem ${editItem.codigo} actualizado.`);
      } else {
        await createItem({
          codigo,
          nombre,
          tipo,
          unidad_medida: unidad,
          categoria: categoria || undefined,
          stock_minimo: Number.isFinite(min) ? min : 0,
          granel_base_id: tipo === 'PT' && granelBaseId ? granelBaseId : undefined,
        });
        setSuccess(`Ítem ${codigo.trim().toUpperCase()} creado.`);
      }
      setItemModal(false);
      resetItemForm();
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, editItem ? 'No se pudo actualizar el ítem' : 'No se pudo crear el ítem'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSku = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editSku) {
        await updatePresentacion({
          id: editSku.id,
          nombre: skuNombre,
          activo: skuActivo,
        });
        setSuccess(`SKU ${editSku.codigo ?? ''} actualizado.`);
      } else {
        if (!empSel) throw new Error('Seleccione un empaque.');
        await createPresentacion({
          codigo: skuCodigo,
          nombre: skuNombre,
          itemId: skuItemId,
          empaqueId: skuEmpaqueId,
          cantUnidades: empSel.factor,
        });
        setSuccess(`SKU ${skuCodigo.trim().toUpperCase()} creado.`);
      }
      setSkuModal(false);
      resetSkuForm();
      await load();
      await refreshCatalog();
    } catch (err) {
      setError(toUserMessage(err, editSku ? 'No se pudo actualizar el SKU' : 'No se pudo crear el SKU'));
    } finally {
      setSaving(false);
    }
  };

  const onSkuPtChange = (id: string) => {
    setSkuItemId(id);
    const pt = pts.find((p) => p.id === id);
    if (pt && !skuNombre) {
      const factor = empSel?.factor ?? 1;
      setSkuNombre(factor > 1 ? `${pt.nombre} · Pack x${factor}` : `${pt.nombre} · Botella`);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Materiales y SKUs"
        subtitle="Catálogo maestro — ver, crear y editar (sin eliminar)"
      />
      <ModuleHelp message="Crear o editar un ítem/SKU no genera stock. El inventario entra por compras, granel o producción. Códigos: ítem máx. 6 chars; SKU máx. 5. Al editar, el código y tipo no se modifican." />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <TabBar
        active={tab}
        onChange={(id) => setTab(id as 'items' | 'skus')}
        tabs={[
          { id: 'items', label: 'Materiales / ítems', icon: 'category' },
          { id: 'skus', label: 'SKUs (presentaciones)', icon: 'qr_code_2' },
        ]}
      />

      <div className="card card-section">
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <FormInput label="Buscar" value={search} onChange={setSearch} placeholder="Código o nombre…" />
          {tab === 'items' && (
            <FormSelect
              label="Tipo"
              value={tipoFilter}
              onChange={setTipoFilter}
              options={[{ value: '', label: 'Todos' }, ...TIPOS_ITEM]}
            />
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (tab === 'items' ? openCreateItem() : openCreateSku())}
          >
            <span className="material-icons-round">add</span>
            {tab === 'items' ? 'Nuevo ítem' : 'Nuevo SKU'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={load}>
            <span className="material-icons-round">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : tab === 'items' ? (
        itemsFiltrados.length === 0 ? (
          <EmptyState icon="category" title="Sin ítems" hint="Cree insumos, granel, empaque o PT" />
        ) : (
          <div className="card">
            <DataTable>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>UM</th>
                  <th>Categoría</th>
                  <th>Stock mín.</th>
                  <th>Activo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map((i) => (
                  <tr key={i.id}>
                    <td><code className="code-tag">{i.codigo}</code></td>
                    <td>{i.nombre}</td>
                    <td>{i.tipo}</td>
                    <td>{i.unidad_medida}</td>
                    <td>{i.categoria || '—'}</td>
                    <td className="cell-num">{fmtNum(i.stock_minimo, 2)}</td>
                    <td>{i.activo === false ? 'No' : 'Sí'}</td>
                    <td>
                      <button type="button" className="btn-icon" title="Editar" onClick={() => openEditItem(i)}>
                        <span className="material-icons-round">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )
      ) : skusFiltrados.length === 0 ? (
        <EmptyState icon="qr_code_2" title="Sin SKUs" hint="Cree presentaciones para un PT (botella / pack)" />
      ) : (
        <div className="card">
          <DataTable>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Ítem PT</th>
                <th>Empaque</th>
                <th>Unid./pack</th>
                <th>Activo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {skusFiltrados.map((s) => (
                <tr key={s.id}>
                  <td><code className="code-tag">{s.codigo}</code></td>
                  <td>{s.nombre}</td>
                  <td>
                    {s.ma_item
                      ? `${s.ma_item.codigo} — ${s.ma_item.nombre}`
                      : s.item_id.slice(0, 8)}
                  </td>
                  <td>{s.ma_empaque_tipo?.nombre ?? '—'}</td>
                  <td className="cell-num">{s.cant_unidades ?? 1}</td>
                  <td>{s.activo === false ? 'No' : 'Sí'}</td>
                  <td>
                    <button type="button" className="btn-icon" title="Editar" onClick={() => openEditSku(s)}>
                      <span className="material-icons-round">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <Modal
        title={editItem ? `Editar ítem ${editItem.codigo}` : 'Nuevo ítem / material'}
        isOpen={itemModal}
        onClose={() => { setItemModal(false); resetItemForm(); }}
      >
        <form onSubmit={handleSaveItem}>
          <FormSection title="Datos del ítem">
            {editItem ? (
              <p className="kpi-sub">Código <code className="code-tag">{codigo}</code> · Tipo {tipo} (no editables)</p>
            ) : (
              <>
                <FormInput label="Código (máx. 6)" value={codigo} onChange={setCodigo} required maxLength={6} />
                <FormSelect label="Tipo" value={tipo} onChange={setTipo} required options={TIPOS_ITEM} />
              </>
            )}
            <FormInput label="Nombre" value={nombre} onChange={setNombre} required />
            <FormInput label="Unidad de medida" value={unidad} onChange={setUnidad} required />
            <FormInput label="Categoría (opcional)" value={categoria} onChange={setCategoria} />
            <FormInput label="Stock mínimo" type="number" value={stockMin} onChange={setStockMin} min={0} step="any" />
            {editItem && (
              <FormSelect
                label="Activo"
                value={activo ? '1' : '0'}
                onChange={(v) => setActivo(v === '1')}
                options={[
                  { value: '1', label: 'Sí' },
                  { value: '0', label: 'No' },
                ]}
              />
            )}
            {!editItem && tipo === 'PT' && (
              <FormSelect
                label="Granel base (opcional)"
                value={granelBaseId}
                onChange={setGranelBaseId}
                options={[
                  { value: '', label: 'Sin vincular' },
                  ...graneles.map((g) => ({ value: g.id, label: `${g.codigo} — ${g.nombre}` })),
                ]}
              />
            )}
          </FormSection>
          <div className="form-actions">
            <SubmitButton
              loading={saving}
              label={editItem ? 'Guardar cambios' : 'Crear ítem'}
              icon={editItem ? 'save' : 'add'}
            />
          </div>
        </form>
      </Modal>

      <Modal
        title={editSku ? `Editar SKU ${editSku.codigo ?? ''}` : 'Nuevo SKU (presentación)'}
        isOpen={skuModal}
        onClose={() => { setSkuModal(false); resetSkuForm(); }}
      >
        <form onSubmit={handleSaveSku}>
          {editSku ? (
            <>
              <p className="kpi-sub">
                Código <code className="code-tag">{skuCodigo}</code>
                {' · '}
                {editSku.ma_item ? `${editSku.ma_item.codigo} — ${editSku.ma_item.nombre}` : 'PT'}
              </p>
              <FormInput label="Nombre comercial" value={skuNombre} onChange={setSkuNombre} required />
              <FormSelect
                label="Activo"
                value={skuActivo ? '1' : '0'}
                onChange={(v) => setSkuActivo(v === '1')}
                options={[
                  { value: '1', label: 'Sí' },
                  { value: '0', label: 'No' },
                ]}
              />
              <div className="form-actions">
                <SubmitButton loading={saving} label="Guardar cambios" icon="save" />
              </div>
            </>
          ) : pts.length === 0 ? (
            <EmptyState icon="precision_manufacturing" title="Primero cree un ítem tipo PT" />
          ) : (
            <>
              <FormSelect
                label="Producto terminado"
                value={skuItemId}
                onChange={onSkuPtChange}
                required
                options={pts.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` }))}
              />
              <FormSelect
                label="Empaque"
                value={skuEmpaqueId}
                onChange={setSkuEmpaqueId}
                required
                options={empaques.map((e) => ({
                  value: e.id,
                  label: `${e.nombre} (×${e.factor})`,
                }))}
              />
              {empSel && (
                <p className="qty-base-summary">
                  cant_unidades = {empSel.factor} (botellas por presentación)
                </p>
              )}
              <FormInput label="Código SKU (máx. 5)" value={skuCodigo} onChange={setSkuCodigo} required maxLength={5} />
              <FormInput label="Nombre comercial" value={skuNombre} onChange={setSkuNombre} required />
              <div className="form-actions">
                <SubmitButton loading={saving} label="Crear SKU" icon="qr_code_2" />
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default MaterialsPage;
