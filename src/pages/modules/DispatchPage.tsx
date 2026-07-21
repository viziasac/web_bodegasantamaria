import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { bodegaService } from '../../services/bodegaService';
import { getLotesDisponibles, getPrecioReferencia, getVentasPorUbicacionFecha } from '../../services/apiProvider';
import { labelLote } from '../../utils/lotePolicy';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import {
  categoriasSkus, filtrarSkusPorCategoria, etiquetaSkuConStock,
  presentacionParaModo, factorParaModo, skusDesdeProductosPv,
} from '../../utils/skuVenta';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, FormRow, EmptyState,
  DataTable, toUserMessage, fmtMoney, fmtDate,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { CatalogGate } from '../../components/CatalogGate';
import { clienteLabel } from '../../utils/partnerCatalog';
import { canalVentaLabel } from '../../utils/canalVentaLabels';
import { hoyYmd } from '../../utils/fechaLocal';
import { loadWebPrefs } from '../../utils/webPrefs';
import type { ProductoPv, VentaResumen } from '../../types';

/**
 * Despacho: 1 fila por SKU (ítem PT). Stock en botellas.
 * El toggle botella/pack solo cambia cómo se ingresa la cantidad y qué presentación comercial se registra.
 * Cliente es opcional (nullable en ven_venta.cliente_id).
 */
const DispatchPage: React.FC = () => {
  const { ubicaciones, canalesVenta, clientes, ensureCatalogLoaded } = useCatalog();
  const prefs = loadWebPrefs();
  const [ubicacionId, setUbicacionId] = useState(prefs.defaultPvId ?? '');
  const [categoria, setCategoria] = useState('');
  const [itemId, setItemId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [cantidad, setCantidad] = useState('');
  const [precioBotella, setPrecioBotella] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [loteId, setLoteId] = useState('');
  const [canal, setCanal] = useState(prefs.defaultCanal ?? 'DIRECTO');
  const [productos, setProductos] = useState<ProductoPv[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [lotes, setLotes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ventasHoy, setVentasHoy] = useState<VentaResumen[]>([]);

  const pvUbicaciones = ubicaciones.filter((u) => u.es_punto_venta);

  const skus = useMemo(() => skusDesdeProductosPv(productos), [productos]);
  const categorias = useMemo(() => categoriasSkus(skus), [skus]);
  const skusFiltrados = useMemo(
    () => filtrarSkusPorCategoria(skus, categoria || undefined),
    [skus, categoria],
  );
  const skusConStock = useMemo(
    () => skusFiltrados.filter((s) => s.stockItem > 0),
    [skusFiltrados],
  );

  const skuSel = skus.find((s) => s.itemId === itemId)
    ?? skusFiltrados.find((s) => s.itemId === itemId);

  const factorPack = skuSel ? factorParaModo(skuSel, 'pack') : 1;
  const puedePack = Boolean(skuSel?.presentacionPack && factorPack > 1);
  const factorActivo = skuSel ? factorParaModo(skuSel, modoCantidad) : 1;
  const presComercial = skuSel ? presentacionParaModo(skuSel, modoCantidad) : undefined;

  const cantIngresada = parseFloat(cantidad);
  const botellas = skuSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada: cantIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: factorActivo,
    })
    : 0;
  const precio = parseFloat(precioBotella);
  const totalVenta = !Number.isNaN(precio) && botellas > 0 ? precio * botellas : 0;

  useEffect(() => {
    if (pvUbicaciones.length > 0 && !ubicacionId) {
      const preferred = prefs.defaultPvId && pvUbicaciones.some((u) => u.id === prefs.defaultPvId)
        ? prefs.defaultPvId
        : pvUbicaciones[0].id;
      setUbicacionId(preferred);
    }
  }, [pvUbicaciones.length]);

  useEffect(() => {
    if (canalesVenta.length > 0 && !canalesVenta.some((c) => c.codigo === canal)) {
      const preferred = prefs.defaultCanal && canalesVenta.some((c) => c.codigo === prefs.defaultCanal)
        ? prefs.defaultCanal
        : canalesVenta[0].codigo;
      setCanal(preferred);
    }
  }, [canalesVenta]);

  const loadProductos = async (ubi: string) => {
    if (!ubi) { setProductos([]); return; }
    setLoadingProductos(true);
    try {
      await ensureCatalogLoaded();
      setProductos(await bodegaService.productosParaPuntoVenta(ubi));
    } catch (err) {
      setProductos([]);
      setError(toUserMessage(err, 'No se pudieron cargar productos'));
    } finally {
      setLoadingProductos(false);
    }
  };

  const loadLotes = async (ubi: string, itemPtId: string) => {
    if (!ubi || !itemPtId) { setLotes([]); return; }
    try {
      setLotes(await getLotesDisponibles({ ubicacionId: ubi, itemId: itemPtId }));
    } catch (err) {
      setLotes([]);
      setError(toUserMessage(err, 'No se pudieron cargar los lotes'));
    }
  };

  const loadVentasHoy = async (ubi: string) => {
    if (!ubi) { setVentasHoy([]); return; }
    try {
      setVentasHoy(await getVentasPorUbicacionFecha({ ubicacionId: ubi, fecha: hoyYmd() }));
    } catch {
      setVentasHoy([]);
    }
  };

  useEffect(() => {
    if (ubicacionId) {
      void loadProductos(ubicacionId);
      void loadVentasHoy(ubicacionId);
    }
  }, [ubicacionId]);

  const onUbicacionChange = (v: string) => {
    setUbicacionId(v);
    setItemId('');
    setCategoria('');
    setLoteId('');
    setModoCantidad('botella');
    void loadProductos(v);
    void loadVentasHoy(v);
  };

  const onSkuChange = async (v: string) => {
    setItemId(v);
    setLoteId('');
    setModoCantidad('botella');
    const sku = skus.find((s) => s.itemId === v);
    if (!sku) return;
    void loadLotes(ubicacionId, sku.itemId);
    try {
      const ref = await getPrecioReferencia(sku.presentacionBotella.presentacion_id);
      if (ref != null) setPrecioBotella(String(ref));
    } catch { /* optional */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!skuSel || !presComercial || botellas <= 0) {
      setError('Seleccione producto y cantidad válida.');
      return;
    }
    if (modoCantidad === 'pack' && !puedePack) {
      setError('Este producto no tiene presentación pack configurada.');
      return;
    }
    if (Number.isNaN(precio) || precio <= 0) {
      setError('Ingrese precio por botella válido.');
      return;
    }
    if (skuSel.stockItem > 0 && botellas > skuSel.stockItem) {
      setError(`Stock insuficiente: hay ${skuSel.stockItem} botellas disponibles.`);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      const obsParts = [referencia.trim()].filter(Boolean);
      await bodegaService.registrarVentaBotellas({
        ubicacionId,
        presentacionId: presComercial.presentacion_id,
        cantidadBotellas: botellas,
        precioUnitarioBotella: precio,
        canal,
        clienteId: clienteId || undefined,
        observaciones: obsParts.length ? obsParts.join(' · ') : undefined,
        loteId: loteId || undefined,
        clientTxnId: newTxnId(),
      });
      setSuccess(`Venta registrada: ${botellas} bot. · ${fmtMoney(totalVenta)}`);
      setCantidad('');
      setLoteId('');
      await Promise.all([loadProductos(ubicacionId), loadVentasHoy(ubicacionId)]);
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo registrar la venta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Despacho"
        subtitle="Mostrador / delivery — una línea por ticket (fecha = hoy)"
        moduleId="despacho"
        action={
          <Link to="/sales/income" className="btn btn-ghost">
            <span className="material-icons-round">shopping_cart</span>
            POS multi-línea
          </Link>
        }
      />
      <Alert
        type="info"
        message="Seleccione el producto (SKU). El stock se muestra y descuenta en botellas; use Botellas/Packs solo para indicar cómo cuenta la cantidad."
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      <CatalogGate
        ready={pvUbicaciones.length > 0}
        emptyIcon="storefront"
        emptyTitle="Sin puntos de venta"
        emptyHint="Configure ubicaciones con es_punto_venta en el catálogo"
      >
        <div className="card">
          <form onSubmit={handleSubmit}>
            <FormSelect label="Punto de venta" value={ubicacionId} onChange={onUbicacionChange} required
              options={pvUbicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
            {loadingProductos && <p className="kpi-sub">Cargando productos…</p>}
            {categorias.length > 1 && (
              <FormSelect label="Categoría" value={categoria} onChange={(v) => { setCategoria(v); setItemId(''); }}
                options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c, label: c }))]} />
            )}
            <FormSelect
              label="Producto (con stock)"
              value={itemId}
              onChange={onSkuChange}
              required
              options={skusConStock.map((s) => ({
                value: s.itemId,
                label: etiquetaSkuConStock(s),
              }))}
            />
            {skuSel && puedePack && (
              <CantidadEmpaqueToggle
                modo={modoCantidad}
                onChange={setModoCantidad}
                cantUnidades={factorPack}
              />
            )}
            <FormRow>
              <FormInput
                label={skuSel ? etiquetaModoCantidad(modoCantidad, factorActivo) : 'Cantidad'}
                type="number" value={cantidad} onChange={setCantidad} required min={1}
              />
              <FormInput label="Precio por botella (S/)" type="number" value={precioBotella}
                onChange={setPrecioBotella} required min={0.01} step="0.01" />
            </FormRow>
            {skuSel && botellas > 0 && (
              <p className="qty-base-summary">
                {resumenCantidadBase({
                  cantidadIngresada: cantIngresada,
                  modo: modoCantidad,
                  cantUnidadesPresentacion: factorActivo,
                })}
                {` · Stock: ${skuSel.stockItem} bot.`}
                {totalVenta > 0 && ` · Total: ${fmtMoney(totalVenta)}`}
              </p>
            )}
            <FormSelect label="Lote (opcional — FIFO automático)" value={loteId} onChange={setLoteId}
              options={[
                { value: '', label: 'Automático (FIFO)' },
                ...lotes
                  .filter((l) => l.lote_id != null && String(l.lote_id).length > 0)
                  .map((l) => ({ value: String(l.lote_id), label: labelLote(l) })),
              ]} />
            <FormSelect label="Canal" value={canal} onChange={setCanal}
              options={canalesVenta.length > 0
                ? canalesVenta.map((c) => ({ value: c.codigo, label: canalVentaLabel(c) }))
                : [{ value: 'DIRECTO', label: 'Directo' }]} />
            <FormSelect label="Cliente (opcional)" value={clienteId} onChange={setClienteId}
              options={[
                { value: '', label: '— Sin cliente —' },
                ...clientes.map((c) => ({ value: c.id, label: clienteLabel(c) })),
              ]} />
            <FormInput label="Referencia / destino (opcional)" value={referencia} onChange={setReferencia}
              placeholder="Nombre cliente o nota de despacho" />
            <div className="form-actions">
              <SubmitButton loading={loading} label="Registrar venta" icon="local_shipping" />
            </div>
          </form>
        </div>

        <div className="card card-section" style={{ marginTop: '1.25rem' }}>
          <h3 className="card-section-title">Hoy en este PV</h3>
          {ventasHoy.length === 0 ? (
            <EmptyState icon="receipt_long" title="Sin ventas hoy en este punto" />
          ) : (
            <DataTable>
              <thead>
                <tr><th>Hora / N°</th><th>Canal</th><th>Total</th></tr>
              </thead>
              <tbody>
                {ventasHoy.slice(0, 12).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <code className="code-tag">{v.nro_venta || v.id.slice(0, 8)}</code>
                      {' · '}
                      {v.fecha ? fmtDate(String(v.fecha).split('T')[0]) : '—'}
                    </td>
                    <td>{v.canal || '—'}</td>
                    <td className="cell-money">{fmtMoney(v.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      </CatalogGate>
    </div>
  );
};

export default DispatchPage;
