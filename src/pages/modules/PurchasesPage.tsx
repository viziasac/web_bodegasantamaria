import React, { useState, useEffect, useMemo } from 'react';
import { bodegaService } from '../../services/bodegaService';
import { newTxnId } from '../../utils/txnId';
import { PrecioUnitarioTotalToggle, type ModoPrecio } from '../../components/PrecioUnitarioTotalToggle';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, TabBar, FormSection,
  DataTable, EmptyState, toUserMessage, fmtMoney,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { proveedorLabel } from '../../utils/partnerCatalog';
import type { CompraLinea, MaItem } from '../../types';
import {
  clearComprasDocDraft, loadComprasDocDraft, saveComprasDocDraft,
} from '../../utils/comprasDraft';
import {
  ubicacionesParaIngresoInsumos,
  tiposParaIngresoEnUbicacion,
  etiquetaFamiliaUbicacion,
  resumenTiposPermitidos,
  normalizarTipoItem,
  mensajeErrorTipoUbicacion,
} from '../../utils/ubicacionItemPolicy';

interface DocLine extends CompraLinea {
  key: string;
  itemLabel?: string;
}

const CENTROS_COSTO = [
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'PRODUCCION', label: 'Producción' },
  { value: 'ADMIN', label: 'Administración' },
  { value: 'VENTAS', label: 'Ventas' },
];

const PurchasesPage: React.FC = () => {
  const { ubicaciones, items, proveedores, categoriasGasto, ensureCatalogLoaded } = useCatalog();
  const draft0 = loadComprasDocDraft();
  const [mode, setMode] = useState<'simple' | 'doc'>(draft0?.docLineas?.length ? 'doc' : 'simple');
  const [ubicacionId, setUbicacionId] = useState(draft0?.ubicacionId ?? '');
  const [tipoFilter, setTipoFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [itemId, setItemId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>('unitario');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [referencia, setReferencia] = useState(draft0?.referencia ?? '');
  const [observaciones, setObservaciones] = useState(draft0?.observaciones ?? '');
  const [proveedorId, setProveedorId] = useState(draft0?.proveedorId ?? '');
  const [docLineas, setDocLineas] = useState<DocLine[]>(
    () => (draft0?.docLineas ?? []) as DocLine[],
  );
  const [registrarEgreso, setRegistrarEgreso] = useState(false);
  const [gastoCategoriaId, setGastoCategoriaId] = useState('');
  const [gastoCentroCosto, setGastoCentroCosto] = useState('BODEGA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'doc') return;
    saveComprasDocDraft({
      ubicacionId,
      proveedorId,
      referencia,
      observaciones,
      docLineas: docLineas.map((l) => ({
        key: l.key,
        item_id: l.item_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        itemLabel: l.itemLabel,
      })),
    });
  }, [mode, ubicacionId, proveedorId, referencia, observaciones, docLineas]);

  const almacenes = useMemo(() => ubicacionesParaIngresoInsumos(ubicaciones), [ubicaciones]);
  const ubiSel = almacenes.find((u) => u.id === ubicacionId);
  const tiposPermitidos = useMemo(() => tiposParaIngresoEnUbicacion(ubiSel), [ubiSel]);

  const insumos = useMemo(() => {
    const allow = new Set(tiposPermitidos.map((t) => t));
    if (!allow.size) return [] as MaItem[];
    return items.filter((i) => i.activo !== false && allow.has(normalizarTipoItem(i.tipo) as typeof tiposPermitidos[number]));
  }, [items, tiposPermitidos]);

  const tipos = useMemo(
    () => [...new Set(insumos.map((i) => normalizarTipoItem(i.tipo)))].sort(),
    [insumos],
  );
  const categorias = useMemo(() => {
    const src = tipoFilter ? insumos.filter((i) => normalizarTipoItem(i.tipo) === tipoFilter) : insumos;
    return [...new Set(src.map((i) => i.categoria?.trim() || 'Sin categoría'))].sort();
  }, [insumos, tipoFilter]);

  const insumosFiltrados = useMemo(() => {
    let list = insumos;
    if (tipoFilter) list = list.filter((i) => normalizarTipoItem(i.tipo) === tipoFilter);
    if (categoriaFilter) {
      list = list.filter((i) => (i.categoria?.trim() || 'Sin categoría') === categoriaFilter);
    }
    return list;
  }, [insumos, tipoFilter, categoriaFilter]);

  const selectedInsumo = insumos.find((i) => i.id === itemId);

  const descripcionEgresoAuto = useMemo(() => {
    const ref = referencia.trim();
    const nombre = selectedInsumo?.nombre.trim();
    if (nombre) return ref ? `Compra: ${nombre} (${ref})` : `Compra: ${nombre}`;
    return ref ? `Compra: ${ref}` : 'Compra de insumo';
  }, [referencia, selectedInsumo?.nombre]);

  useEffect(() => {
    if (!ubicacionId && almacenes.length > 0) {
      const almMp = almacenes.find((u) => u.codigo === 'ALM_MP');
      setUbicacionId(almMp?.id ?? almacenes[0].id);
    } else if (ubicacionId && almacenes.length && !almacenes.some((u) => u.id === ubicacionId)) {
      const almMp = almacenes.find((u) => u.codigo === 'ALM_MP');
      const next = almMp?.id ?? almacenes[0].id;
      setUbicacionId(next);
      setTipoFilter('');
      setCategoriaFilter('');
      setItemId('');
      if (mode === 'doc' && docLineas.length > 0) {
        setDocLineas([]);
        clearComprasDocDraft();
      }
    }
  }, [almacenes, ubicacionId, mode, docLineas.length]);

  useEffect(() => {
    if (tipoFilter && tiposPermitidos.length && !tiposPermitidos.includes(tipoFilter as typeof tiposPermitidos[number])) {
      setTipoFilter('');
    }
    if (itemId && (!selectedInsumo
      || !tiposPermitidos.includes(normalizarTipoItem(selectedInsumo.tipo) as typeof tiposPermitidos[number]))) {
      setItemId('');
    }
  }, [tiposPermitidos, tipoFilter, itemId, selectedInsumo]);

  const onUbicacionChange = (v: string) => {
    setUbicacionId(v);
    setTipoFilter('');
    setCategoriaFilter('');
    setItemId('');
    if (mode === 'doc' && docLineas.length > 0) {
      setDocLineas([]);
      clearComprasDocDraft();
    }
  };

  const syncPrecioFromQty = (qty: number, unit: string, total: string) => {
    const q = parseFloat(String(qty));
    if (!Number.isFinite(q) || q <= 0) return;
    const u = parseFloat(unit);
    const t = parseFloat(total);
    if (modoPrecio === 'unitario' && Number.isFinite(u)) {
      setPrecioTotal(String((u * q).toFixed(2)));
    } else if (modoPrecio === 'total' && Number.isFinite(t)) {
      setPrecioUnitario(String((t / q).toFixed(4)));
    }
  };

  const getPrecioUnitarioFinal = (): number | undefined => {
    const q = parseFloat(cantidad);
    if (modoPrecio === 'unitario') {
      const u = parseFloat(precioUnitario);
      return Number.isFinite(u) ? u : undefined;
    }
    const t = parseFloat(precioTotal);
    if (Number.isFinite(t) && Number.isFinite(q) && q > 0) return t / q;
    return undefined;
  };

  const itemLabel = (i: MaItem) => `${i.codigo} — ${i.nombre}`;

  const handleModeChange = (m: 'simple' | 'doc') => {
    setMode(m);
    if (m === 'simple') {
      setProveedorId('');
      setDocLineas([]);
    } else {
      setRegistrarEgreso(false);
    }
  };

  const addDocLine = () => {
    const qty = parseFloat(cantidad);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) {
      setError('Complete ítem y cantidad válida.');
      return;
    }
    if (!ubiSel || !selectedInsumo) {
      setError('Seleccione almacén e ítem válidos.');
      return;
    }
    if (!tiposPermitidos.includes(normalizarTipoItem(selectedInsumo.tipo) as typeof tiposPermitidos[number])) {
      setError(mensajeErrorTipoUbicacion(selectedInsumo.tipo, ubiSel));
      return;
    }
    if (!referencia.trim() && mode === 'doc') {
      setError('Ingrese referencia del documento.');
      return;
    }
    const pu = getPrecioUnitarioFinal();
    setError(null);
    setDocLineas([...docLineas, {
      key: `${itemId}-${Date.now()}`,
      item_id: itemId,
      cantidad: qty,
      precio_unitario: pu,
      fecha_vencimiento: fechaVenc || undefined,
      itemLabel: selectedInsumo ? itemLabel(selectedInsumo) : itemId,
    }]);
    setCantidad('');
    setPrecioUnitario('');
    setPrecioTotal('');
    setFechaVenc('');
    setItemId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!referencia.trim()) {
      setError('La referencia es obligatoria.');
      return;
    }
    if (!ubiSel) {
      setError('Seleccione ALM_MP (materiales) o ALM_GR (granel).');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      const txnId = newTxnId();
      if (mode === 'simple') {
        const qty = parseFloat(cantidad);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida.');
        if (!selectedInsumo) throw new Error('Seleccione un ítem.');
        if (!tiposPermitidos.includes(normalizarTipoItem(selectedInsumo.tipo) as typeof tiposPermitidos[number])) {
          throw new Error(mensajeErrorTipoUbicacion(selectedInsumo.tipo, ubiSel));
        }
        const pu = getPrecioUnitarioFinal();
        if (registrarEgreso) {
          if (pu == null || pu <= 0) throw new Error('Para registrar egreso indique un precio mayor a 0.');
          if (!gastoCategoriaId) throw new Error('Seleccione categoría de egreso.');
          if (!gastoCentroCosto) throw new Error('Seleccione centro de costo.');
        }
        await bodegaService.registrarEntradaInsumo({
          insumoId: itemId,
          cantidad: qty,
          referencia: referencia.trim(),
          almacenId: ubicacionId,
          observaciones: observaciones.trim() || undefined,
          precioUnitario: pu,
          fechaVencimiento: fechaVenc || undefined,
          clientTxnId: txnId,
          proveedorId: proveedorId || undefined,
          registrarGasto: registrarEgreso,
          gastoCategoriaId: registrarEgreso ? gastoCategoriaId : undefined,
          gastoCentroCosto: registrarEgreso ? gastoCentroCosto : undefined,
          gastoDescripcion: registrarEgreso ? descripcionEgresoAuto : undefined,
          gastoProveedorNombre: registrarEgreso
            ? proveedores.find((p) => p.id === proveedorId)?.nombre
            : undefined,
          gastoProveedorId: registrarEgreso ? proveedorId || undefined : undefined,
        });
        setSuccess(registrarEgreso
          ? 'Compra y egreso registrados correctamente.'
          : 'Compra registrada correctamente.');
      } else {
        if (docLineas.length === 0) throw new Error('Agregue al menos una línea al documento.');
        for (const l of docLineas) {
          const it = items.find((x) => x.id === l.item_id);
          if (!it || !tiposPermitidos.includes(normalizarTipoItem(it.tipo) as typeof tiposPermitidos[number])) {
            throw new Error(mensajeErrorTipoUbicacion(it?.tipo ?? '?', ubiSel));
          }
        }
        await bodegaService.registrarCompraDocumentada({
          ubicacionId,
          proveedorId: proveedorId || undefined,
          referencia: referencia.trim(),
          observaciones: observaciones.trim() || undefined,
          lineas: docLineas.map(({ item_id, cantidad: c, precio_unitario, fecha_vencimiento }) => ({
            item_id, cantidad: c, precio_unitario, fecha_vencimiento,
          })),
          clientTxnId: txnId,
        });
        setDocLineas([]);
        clearComprasDocDraft();
        setSuccess('Compra registrada correctamente.');
      }
      setCantidad('');
      setReferencia('');
      setRegistrarEgreso(false);
      setGastoCategoriaId('');
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar compra'));
    } finally {
      setLoading(false);
    }
  };

  const renderInsumoFields = () => (
    <>
      {tipos.length > 1 && (
        <FormSelect label="Tipo de material" value={tipoFilter}
          onChange={(v) => { setTipoFilter(v); setCategoriaFilter(''); setItemId(''); }}
          options={[{ value: '', label: 'Todos los de este almacén' }, ...tipos.map((t) => ({ value: t, label: t }))]} />
      )}
      {categorias.length > 1 && (
        <FormSelect label="Categoría" value={categoriaFilter}
          onChange={(v) => { setCategoriaFilter(v); setItemId(''); }}
          options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c, label: c }))]} />
      )}
      <FormSelect
        label={ubiSel?.codigo === 'ALM_GR' ? 'Ítem granel' : 'Material / insumo / empaque'}
        value={itemId}
        onChange={setItemId}
        required
        options={[
          { value: '', label: insumosFiltrados.length ? '— Seleccionar —' : 'Sin ítems para este almacén' },
          ...insumosFiltrados.map((i) => ({
            value: i.id,
            label: `[${normalizarTipoItem(i.tipo)}] ${itemLabel(i)}`,
          })),
        ]}
      />
      <FormInput label="Cantidad" type="number" value={cantidad}
        onChange={(v) => { setCantidad(v); syncPrecioFromQty(parseFloat(v), precioUnitario, precioTotal); }}
        required={mode === 'simple'} min={0.001} step="any" />
      <PrecioUnitarioTotalToggle modo={modoPrecio} onChange={setModoPrecio} />
      {modoPrecio === 'unitario' ? (
        <FormInput label="Precio unitario (S/)" type="number" value={precioUnitario}
          onChange={(v) => { setPrecioUnitario(v); syncPrecioFromQty(parseFloat(cantidad), v, precioTotal); }}
          min={0} step="0.0001" />
      ) : (
        <FormInput label="Precio total (S/)" type="number" value={precioTotal}
          onChange={(v) => { setPrecioTotal(v); syncPrecioFromQty(parseFloat(cantidad), precioUnitario, v); }}
          min={0} step="0.01" />
      )}
      <FormInput label="Fecha vencimiento (opcional)" type="date" value={fechaVenc} onChange={setFechaVenc} />
    </>
  );

  return (
    <div className="animate-in">
      <PageHeader
        title="Ingreso de Insumos"
        subtitle="Compras a ALM_MP (materiales) o ALM_GR (granel)"
        moduleId="ingreso_materiales"
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      <TabBar
        active={mode}
        onChange={(id) => handleModeChange(id as 'simple' | 'doc')}
        tabs={[
          { id: 'simple', label: 'Compra simple', icon: 'input' },
          { id: 'doc', label: 'Compra documentada', icon: 'description' },
        ]}
      />
      <div className="card">
        <form onSubmit={handleSubmit}>
          <Alert type="info">
            <strong>ALM_MP</strong> → material, insumo y empaque.
            {' '}<strong>ALM_GR</strong> → solo granel.
            {' '}El producto terminado entra por <strong>Producción</strong>, no por esta pantalla.
          </Alert>
          <FormSelect
            label="Almacén destino"
            value={ubicacionId}
            onChange={onUbicacionChange}
            required
            options={almacenes.map((u) => ({
              value: u.id,
              label: `${u.codigo} — ${u.nombre}`,
            }))}
          />
          {ubiSel && (
            <p className="kpi-sub" style={{ marginBottom: '0.75rem' }}>
              {etiquetaFamiliaUbicacion(ubiSel)} · {resumenTiposPermitidos(tiposPermitidos)}.
            </p>
          )}
          <FormSelect label="Proveedor (opcional)" value={proveedorId} onChange={setProveedorId}
            options={[
              { value: '', label: '— Sin proveedor —' },
              ...proveedores.map((p) => ({ value: p.id, label: proveedorLabel(p) })),
            ]} />
          <FormInput label="Referencia / N° documento" value={referencia} onChange={setReferencia} required />
          <FormInput label="Observaciones (opcional)" value={observaciones} onChange={setObservaciones} />
          {renderInsumoFields()}

          {mode === 'simple' && (
            <FormSection title="Egreso asociado (opcional)">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={registrarEgreso}
                  onChange={(e) => setRegistrarEgreso(e.target.checked)}
                />
                <span>Registrar egreso junto con la compra</span>
              </label>
              {registrarEgreso && (
                <>
                  {categoriasGasto.length === 0 ? (
                    <EmptyState
                      icon="category"
                      title="Sin categorías de gasto"
                      hint="Configure categorías en Maestros o recargue catálogos"
                    />
                  ) : (
                    <FormSelect
                      label="Categoría de egreso"
                      value={gastoCategoriaId}
                      onChange={setGastoCategoriaId}
                      required
                      options={categoriasGasto.map((c) => ({ value: c.id, label: c.nombre }))}
                    />
                  )}
                  <FormSelect
                    label="Centro de costo"
                    value={gastoCentroCosto}
                    onChange={setGastoCentroCosto}
                    required
                    options={CENTROS_COSTO}
                  />
                  <p className="qty-base-summary">Descripción: {descripcionEgresoAuto}</p>
                </>
              )}
            </FormSection>
          )}

          {mode === 'doc' && (
            <>
              <div className="form-actions form-actions--flat">
                <button type="button" className="btn btn-ghost" onClick={addDocLine}>
                  <span className="material-icons-round">add</span>
                  Agregar línea al documento
                </button>
              </div>
              {docLineas.length === 0 ? (
                <EmptyState icon="description" title="Sin líneas en el documento" hint="Agregue insumos arriba" />
              ) : (
                <DataTable>
                  <thead><tr><th>Insumo</th><th>Cant.</th><th>P. unit.</th><th>Vence</th><th /></tr></thead>
                  <tbody>
                    {docLineas.map((l) => (
                      <tr key={l.key}>
                        <td>{l.itemLabel}</td>
                        <td className="cell-num">{l.cantidad}</td>
                        <td>{l.precio_unitario != null ? fmtMoney(l.precio_unitario) : '—'}</td>
                        <td>{l.fecha_vencimiento || '—'}</td>
                        <td>
                          <button type="button" className="btn-icon"
                            onClick={() => setDocLineas(docLineas.filter((x) => x.key !== l.key))}>
                            <span className="material-icons-round">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </>
          )}
          <div className="form-actions">
            <SubmitButton loading={loading}
              label={mode === 'doc'
                ? 'Registrar documento'
                : registrarEgreso
                  ? 'Registrar compra + egreso'
                  : 'Registrar compra'}
              icon="input"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchasesPage;
