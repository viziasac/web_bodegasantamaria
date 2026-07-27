import React, { useEffect, useMemo, useState } from 'react';
import {
  createItem, getItems, getPresentaciones,
  updateItem, updatePresentacion,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState, FormSelect, FormInput,
  SubmitButton, TabBar, FormSection, toUserMessage, fmtNum,
  PageFeedback,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useCatalog } from '../../context/CatalogContext';
import type { MaItem, MaPresentacion } from '../../types';
import { normalizarTipoItem } from '../../utils/ubicacionItemPolicy';
import { MSG_ACTUALIZADO, MSG_GUARDADO } from '../../utils/uiFeedback';

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
  const [envaseMl, setEnvaseMl] = useState('750');

  const [skuCodigo, setSkuCodigo] = useState('');
  const [skuNombre, setSkuNombre] = useState('');
  const [skuActivo, setSkuActivo] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);

  const graneles = useMemo(() => items.filter((i) => normalizarTipoItem(i.tipo) === 'GRANEL' && i.activo !== false), [items]);

  const itemsFiltrados = useMemo(() => {
    let list = items;
    if (tipoFilter) list = list.filter((i) => normalizarTipoItem(i.tipo) === tipoFilter);
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
      const [its, pres] = await Promise.all([
        getItems({ includeInactive: true }),
        getPresentaciones(undefined, { includeInactive: true }),
      ]);
      setItems(its);
      setSkus(pres);
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
    setEnvaseMl('750');
    setEditItem(null);
  };

  const resetSkuForm = () => {
    setSkuCodigo('');
    setSkuNombre('');
    setSkuActivo(true);
    setEditSku(null);
  };

  const openCreateItem = () => {
    resetItemForm();
    setModalError(null);
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
    setGranelBaseId(item.granel_base_id ?? '');
    setEnvaseMl(item.envase_ml != null ? String(item.envase_ml) : '');
    setModalError(null);
    setItemModal(true);
  };

  const openEditSku = (sku: MaPresentacion) => {
    setEditSku(sku);
    setSkuCodigo(sku.codigo ?? '');
    setSkuNombre(sku.nombre);
    setSkuActivo(sku.activo !== false);
    setModalError(null);
    setSkuModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setModalError(null);
    setSuccess(null);
    try {
      const min = parseFloat(stockMin);
      const envaseNum = envaseMl.trim() ? parseInt(envaseMl, 10) : NaN;
      if (editItem) {
        await updateItem({
          id: editItem.id,
          nombre,
          unidad_medida: unidad,
          categoria: categoria || null,
          stock_minimo: Number.isFinite(min) ? min : 0,
          activo,
          granel_base_id: editItem.tipo === 'PT' ? (granelBaseId || null) : undefined,
          envase_ml: editItem.tipo === 'PT'
            ? (Number.isFinite(envaseNum) && envaseNum > 0 ? envaseNum : null)
            : undefined,
        });
        setSuccess(MSG_ACTUALIZADO);
      } else {
        await createItem({
          codigo,
          nombre,
          tipo,
          unidad_medida: unidad,
          categoria: categoria || undefined,
          stock_minimo: Number.isFinite(min) ? min : 0,
          granel_base_id: tipo === 'PT' && granelBaseId ? granelBaseId : undefined,
          envase_ml: tipo === 'PT'
            ? (Number.isFinite(envaseNum) && envaseNum > 0 ? envaseNum : undefined)
            : undefined,
        });
        setSuccess(MSG_GUARDADO);
      }
      setItemModal(false);
      resetItemForm();
      await load();
      await refreshCatalog();
    } catch (err) {
      const msg = toUserMessage(err, editItem ? 'No se pudo actualizar el ítem' : 'No se pudo crear el ítem');
      setModalError(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSku) return;
    setSaving(true);
    setError(null);
    setModalError(null);
    setSuccess(null);
    try {
      await updatePresentacion({
        id: editSku.id,
        nombre: skuNombre,
        activo: skuActivo,
      });
      setSuccess(MSG_ACTUALIZADO);
      setSkuModal(false);
      resetSkuForm();
      await load();
      await refreshCatalog();
    } catch (err) {
      const msg = toUserMessage(err, 'No se pudo actualizar el SKU');
      setModalError(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Materiales y SKUs"
        subtitle="Catálogo maestro — ver, crear y editar (sin eliminar)"
        moduleId="materiales_skus"
      />
      <PageFeedback
        success={success}
        error={error}
        onClearSuccess={() => setSuccess(null)}
        onClearError={() => setError(null)}
      />

      <TabBar
        active={tab}
        onChange={(id) => {
          setTab(id as 'items' | 'skus');
          setItemModal(false);
          setSkuModal(false);
          resetItemForm();
          resetSkuForm();
          setModalError(null);
        }}
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
          {tab === 'items' ? (
            <button type="button" className="btn btn-primary" onClick={openCreateItem}>
              <span className="material-icons-round">add</span>
              Nuevo ítem
            </button>
          ) : (
            <p className="kpi-sub" style={{ margin: 0, maxWidth: 280 }}>
              Las presentaciones se generan al crear el PT (matriz × empaque). Aquí solo edita nombre/activo.
            </p>
          )}
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
                  <th>Envase ml</th>
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
                    <td className="cell-num">{i.envase_ml ?? '—'}</td>
                    <td className="cell-num">{fmtNum(i.stock_minimo ?? 0, 2)}</td>
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
        <EmptyState
          icon="qr_code_2"
          title="Sin SKUs"
          hint="Cree un ítem tipo PT: la matriz genera botella y packs automáticamente"
        />
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
        onClose={() => { if (!saving) { setItemModal(false); resetItemForm(); setModalError(null); } }}
      >
        {modalError && <Alert type="error" message={modalError} onClose={() => setModalError(null)} />}
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
            {(tipo === 'PT' || editItem?.tipo === 'PT') && (
              <>
                <FormSelect
                  label="Granel base (opcional)"
                  value={granelBaseId}
                  onChange={setGranelBaseId}
                  options={[
                    { value: '', label: 'Sin vincular' },
                    ...graneles.map((g) => ({ value: g.id, label: `${g.codigo} — ${g.nombre}` })),
                  ]}
                />
                {!editItem && (
                  <FormInput
                    label="Envase (ml)"
                    type="number"
                    value={envaseMl}
                    onChange={setEnvaseMl}
                    min={1}
                    step="1"
                  />
                )}
                {!editItem && (
                  <p className="kpi-sub">
                    El alta de PT usa el catálogo (matriz botella + packs). Vincular granel permite
                    recetas y consumo en producción.
                  </p>
                )}
                {editItem && (
                  <FormInput
                    label="Envase (ml)"
                    type="number"
                    value={envaseMl}
                    onChange={setEnvaseMl}
                    min={1}
                    step="1"
                  />
                )}
              </>
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
        title={`Editar SKU ${editSku?.codigo ?? ''}`}
        isOpen={skuModal && !!editSku}
        onClose={() => { if (!saving) { setSkuModal(false); resetSkuForm(); setModalError(null); } }}
      >
        {modalError && <Alert type="error" message={modalError} onClose={() => setModalError(null)} />}
        <form onSubmit={handleSaveSku}>
          <p className="kpi-sub">
            Código <code className="code-tag">{skuCodigo}</code>
            {' · '}
            {editSku?.ma_item ? `${editSku.ma_item.codigo} — ${editSku.ma_item.nombre}` : 'PT'}
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
        </form>
      </Modal>
    </div>
  );
};

export default MaterialsPage;
