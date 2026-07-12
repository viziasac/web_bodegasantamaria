import React, { useState, useEffect, useMemo } from 'react';
import { bodegaService } from '../../services/bodegaService';
import { newTxnId } from '../../utils/txnId';
import { PrecioUnitarioTotalToggle, type ModoPrecio } from '../../components/PrecioUnitarioTotalToggle';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, TabBar, FormSection,
  DataTable, EmptyState, toUserMessage, fmtMoney,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import type { CompraLinea, MaItem } from '../../types';

interface DocLine extends CompraLinea {
  key: string;
  itemLabel?: string;
}

const INSUMO_TIPOS = ['INSUMO', 'EMPAQUE', 'MATERIAL', 'GRANEL'];
const CENTROS_COSTO = [
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'PRODUCCION', label: 'Producción' },
  { value: 'ADMIN', label: 'Administración' },
  { value: 'VENTAS', label: 'Ventas' },
];

const PurchasesPage: React.FC = () => {
  const { ubicaciones, items, proveedores, categoriasGasto, ensureCatalogLoaded } = useCatalog();
  const [mode, setMode] = useState<'simple' | 'doc'>('simple');
  const [ubicacionId, setUbicacionId] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [itemId, setItemId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>('unitario');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [docLineas, setDocLineas] = useState<DocLine[]>([]);
  const [registrarEgreso, setRegistrarEgreso] = useState(false);
  const [gastoCategoriaId, setGastoCategoriaId] = useState('');
  const [gastoCentroCosto, setGastoCentroCosto] = useState('BODEGA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const almacenes = ubicaciones.filter((u) => !u.es_punto_venta);
  const insumos = useMemo(
    () => items.filter((i) => INSUMO_TIPOS.includes(i.tipo)),
    [items],
  );
  const tipos = useMemo(
    () => [...new Set(insumos.map((i) => i.tipo))].sort(),
    [insumos],
  );
  const categorias = useMemo(() => {
    const src = tipoFilter ? insumos.filter((i) => i.tipo === tipoFilter) : insumos;
    return [...new Set(src.map((i) => i.categoria?.trim() || 'Sin categoría'))].sort();
  }, [insumos, tipoFilter]);

  const insumosFiltrados = useMemo(() => {
    let list = insumos;
    if (tipoFilter) list = list.filter((i) => i.tipo === tipoFilter);
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
    }
  }, [almacenes, ubicacionId]);

  useEffect(() => {
    if (selectedInsumo?.tipo === 'GRANEL') {
      const almGr = almacenes.find((u) => u.codigo === 'ALM_GR');
      if (almGr) setUbicacionId(almGr.id);
    }
  }, [itemId, selectedInsumo?.tipo]);

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
      setError('Complete insumo y cantidad válida.');
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
    if (!referencia.trim()) {
      setError('La referencia es obligatoria.');
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
          registrarGasto: registrarEgreso,
          gastoCategoriaId: registrarEgreso ? gastoCategoriaId : undefined,
          gastoCentroCosto: registrarEgreso ? gastoCentroCosto : undefined,
          gastoDescripcion: registrarEgreso ? descripcionEgresoAuto : undefined,
        });
        setSuccess(registrarEgreso
          ? 'Compra y egreso registrados correctamente.'
          : 'Compra registrada correctamente.');
      } else {
        if (docLineas.length === 0) throw new Error('Agregue al menos una línea al documento.');
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
        <FormSelect label="Tipo de insumo" value={tipoFilter}
          onChange={(v) => { setTipoFilter(v); setCategoriaFilter(''); setItemId(''); }}
          options={[{ value: '', label: 'Todos' }, ...tipos.map((t) => ({ value: t, label: t }))]} />
      )}
      {categorias.length > 1 && (
        <FormSelect label="Categoría" value={categoriaFilter}
          onChange={(v) => { setCategoriaFilter(v); setItemId(''); }}
          options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c, label: c }))]} />
      )}
      <FormSelect label="Insumo" value={itemId} onChange={setItemId} required
        options={insumosFiltrados.map((i) => ({ value: i.id, label: itemLabel(i) }))} />
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
      <PageHeader title="Ingreso de Insumos" subtitle="Compras y entradas de materiales" />
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
          <FormSelect label="Ubicación destino" value={ubicacionId} onChange={setUbicacionId} required
            options={almacenes.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          {mode === 'doc' && (
            <FormSelect label="Proveedor" value={proveedorId} onChange={setProveedorId}
              options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))} />
          )}
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
                      hint="Configure categorías en Supabase o recargue catálogos"
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
