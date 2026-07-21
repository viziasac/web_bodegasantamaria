import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bodegaService } from '../../services/bodegaService';
import { getPrecioReferencia, getVentasPorUbicacionFecha } from '../../services/apiProvider';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import {
  categoriasSkus, filtrarSkusPorCategoria, etiquetaSkuConStock,
  presentacionParaModo, factorParaModo, skusDesdeProductosPv,
} from '../../utils/skuVenta';
import {
  clearIngresosCartDraft, loadIngresosCartDraft, saveIngresosCartDraft,
  type ModoVentaIngresos,
} from '../../utils/ingresosDraft';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, FormRow, FormSection,
  DataTable, EmptyState, fmtMoney, fmtDate, toUserMessage,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { CatalogGate } from '../../components/CatalogGate';
import { clienteLabel } from '../../utils/partnerCatalog';
import { canalVentaLabel } from '../../utils/canalVentaLabels';
import { hoyYmd } from '../../utils/fechaLocal';
import { loadWebPrefs } from '../../utils/webPrefs';
import type { ProductoPv, VentaResumen } from '../../types';

interface CartLine {
  itemId: string;
  presentacionId: string;
  nombre: string;
  cantidadBotellas: number;
  precioUnitarioBotella: number;
}

const TIPOS_DOC = [
  { value: '', label: '— Sin tipo —' },
  { value: 'BOLETA', label: 'Boleta' },
  { value: 'FACTURA', label: 'Factura' },
  { value: 'TICKET', label: 'Ticket' },
  { value: 'OTRO', label: 'Otro' },
];

/**
 * POS multi-línea: 1 fila por SKU (ítem PT). Stock en botellas.
 * Botellas/Packs solo define cómo se ingresa la cantidad y qué presentación comercial se registra.
 */
const IncomePage: React.FC = () => {
  const { ubicaciones, canalesVenta, clientes, ensureCatalogLoaded } = useCatalog();
  const [modo, setModo] = useState<ModoVentaIngresos>('agrupada');
  const [draftReady, setDraftReady] = useState(false);
  const [ubicacionId, setUbicacionId] = useState('');
  const [fecha, setFecha] = useState(hoyYmd());
  const [clienteId, setClienteId] = useState('');
  const [clienteTexto, setClienteTexto] = useState('');
  const [nroDoc, setNroDoc] = useState('');
  const [tipoDoc, setTipoDoc] = useState('BOLETA');
  const [moneda, setMoneda] = useState('PEN');
  const [canal, setCanal] = useState('DIRECTO');
  const [observaciones, setObservaciones] = useState('');

  const [productos, setProductos] = useState<ProductoPv[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [itemId, setItemId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [cantidad, setCantidad] = useState('');
  /** En agrupada: precio por botella. En rápida: monto total de la línea. */
  const [precioInput, setPrecioInput] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [ventasDia, setVentasDia] = useState<VentaResumen[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const precioNum = parseFloat(precioInput);
  const precioUnitarioBotella = modo === 'rapida' && botellas > 0 && Number.isFinite(precioNum)
    ? precioNum / botellas
    : precioNum;

  const cartTotal = cart.reduce((s, l) => s + l.cantidadBotellas * l.precioUnitarioBotella, 0);

  const stockDisponibleSku = (skuItemId: string, stockItem: number) => {
    const enCarrito = cart
      .filter((l) => l.itemId === skuItemId)
      .reduce((s, l) => s + l.cantidadBotellas, 0);
    return Math.max(0, stockItem - enCarrito);
  };

  const esRapida = modo === 'rapida';

  const loadProductos = async (almacenId: string) => {
    if (!almacenId) { setProductos([]); return; }
    setLoadingProductos(true);
    try {
      await ensureCatalogLoaded();
      setProductos(await bodegaService.productosParaPuntoVenta(almacenId));
    } catch (err) {
      setProductos([]);
      setError(toUserMessage(err, 'No se pudo cargar productos'));
    } finally {
      setLoadingProductos(false);
    }
  };

  const loadVentasDia = async (ubi: string, f: string) => {
    if (!ubi) return;
    setLoadingVentas(true);
    try {
      setVentasDia(await getVentasPorUbicacionFecha({ ubicacionId: ubi, fecha: f }));
    } catch {
      setVentasDia([]);
    } finally {
      setLoadingVentas(false);
    }
  };

  useEffect(() => {
    const draft = loadIngresosCartDraft();
    if (draft) {
      setModo(draft.modo);
      if (draft.ubicacionId) setUbicacionId(draft.ubicacionId);
      if (draft.fecha) setFecha(draft.fecha);
      if (draft.clienteId) setClienteId(draft.clienteId);
      if (draft.clienteTexto) setClienteTexto(draft.clienteTexto);
      if (draft.nroDoc) setNroDoc(draft.nroDoc);
      if (draft.tipoDoc) setTipoDoc(draft.tipoDoc);
      if (draft.moneda) setMoneda(draft.moneda);
      if (draft.canal) setCanal(draft.canal);
      if (draft.observaciones) setObservaciones(draft.observaciones);
      if (draft.cart.length) {
        setCart(draft.cart.map((l) => ({
          itemId: l.itemId || '',
          presentacionId: l.presentacionId,
          nombre: l.nombre,
          cantidadBotellas: l.cantidadBotellas,
          precioUnitarioBotella: l.precioUnitarioBotella,
        })));
      }
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (pvUbicaciones.length > 0 && !ubicacionId) {
      const prefs = loadWebPrefs();
      const preferred = prefs.defaultPvId && pvUbicaciones.some((u) => u.id === prefs.defaultPvId)
        ? prefs.defaultPvId
        : pvUbicaciones[0].id;
      setUbicacionId(preferred);
      loadProductos(preferred);
      loadVentasDia(preferred, fecha);
    } else if (ubicacionId) {
      loadProductos(ubicacionId);
      loadVentasDia(ubicacionId, fecha);
    }
  }, [draftReady, pvUbicaciones.length]);

  useEffect(() => {
    if (canalesVenta.length === 0) return;
    if (!canalesVenta.some((c) => c.codigo === canal)) {
      const prefs = loadWebPrefs();
      const preferred = prefs.defaultCanal && canalesVenta.some((c) => c.codigo === prefs.defaultCanal)
        ? prefs.defaultCanal
        : canalesVenta[0].codigo;
      setCanal(preferred);
    }
  }, [canalesVenta]);

  useEffect(() => {
    if (!draftReady) return;
    const ubi = pvUbicaciones.find((u) => u.id === ubicacionId);
    saveIngresosCartDraft({
      modo,
      ubicacionId: ubicacionId || undefined,
      ubicacionNombre: ubi ? `${ubi.codigo} — ${ubi.nombre}` : undefined,
      fecha,
      clienteId: clienteId || undefined,
      clienteTexto: clienteTexto || undefined,
      nroDoc: nroDoc || undefined,
      tipoDoc,
      moneda,
      canal,
      observaciones: observaciones || undefined,
      cart,
    });
  }, [
    draftReady, modo, ubicacionId, fecha, clienteId, clienteTexto,
    nroDoc, tipoDoc, moneda, canal, observaciones, cart, pvUbicaciones,
  ]);

  // Completar itemId en líneas de borrador antiguo cuando ya hay catálogo
  useEffect(() => {
    if (!productos.length || !cart.some((l) => !l.itemId)) return;
    setCart((prev) => prev.map((l) => {
      if (l.itemId) return l;
      const p = productos.find((x) => x.presentacion_id === l.presentacionId);
      return p ? { ...l, itemId: p.item_id } : l;
    }));
  }, [productos]);

  const onUbicacionChange = (id: string) => {
    setUbicacionId(id);
    setItemId('');
    setCategoria('');
    setModoCantidad('botella');
    setCart([]);
    loadProductos(id);
    loadVentasDia(id, fecha);
  };

  const onSkuChange = async (v: string) => {
    setItemId(v);
    setModoCantidad('botella');
    const sku = skus.find((s) => s.itemId === v);
    if (!sku || esRapida) return;
    try {
      const ref = await getPrecioReferencia(sku.presentacionBotella.presentacion_id);
      if (ref != null) setPrecioInput(String(ref));
    } catch { /* optional */ }
  };

  const onModoChange = (next: ModoVentaIngresos) => {
    setModo(next);
    setItemId('');
    setCantidad('');
    setPrecioInput('');
    setModoCantidad('botella');
    if (next === 'rapida') setCart([]);
  };

  const buildObservaciones = () => {
    const parts: string[] = [];
    if (clienteTexto.trim()) parts.push(`Cliente: ${clienteTexto.trim()}`);
    if (nroDoc.trim()) parts.push(`${tipoDoc} ${nroDoc.trim()}`);
    if (moneda !== 'PEN') parts.push(`Moneda: ${moneda}`);
    if (observaciones.trim()) parts.push(observaciones.trim());
    return parts.length ? parts.join(' · ') : undefined;
  };

  const etiquetaLinea = (skuNombre: string, modoQty: ModoCantidadEmpaque, factor: number) => (
    modoQty === 'pack' && factor > 1
      ? `${skuNombre} · pack x${factor}`
      : `${skuNombre} · botella`
  );

  const addLine = () => {
    if (!skuSel || !presComercial || !cantidad || !precioInput) {
      setError('Complete producto, cantidad y precio.');
      return;
    }
    if (modoCantidad === 'pack' && !puedePack) {
      setError('Este producto no tiene presentación pack configurada.');
      return;
    }
    if (botellas <= 0 || !Number.isFinite(precioUnitarioBotella) || precioUnitarioBotella <= 0) {
      setError('Cantidad o precio inválido.');
      return;
    }
    const disponible = stockDisponibleSku(skuSel.itemId, skuSel.stockItem);
    if (skuSel.stockItem > 0 && botellas > disponible) {
      setError(`Stock insuficiente: quedan ${disponible} botellas disponibles (ya hay líneas en el carrito).`);
      return;
    }
    setError(null);
    setCart([...cart, {
      itemId: skuSel.itemId,
      presentacionId: presComercial.presentacion_id,
      nombre: etiquetaLinea(skuSel.nombre, modoCantidad, factorActivo),
      cantidadBotellas: botellas,
      precioUnitarioBotella,
    }]);
    setCantidad('');
    setPrecioInput('');
    setItemId('');
    setModoCantidad('botella');
  };

  const clearFormAfterSale = async () => {
    setCart([]);
    setCantidad('');
    setPrecioInput('');
    setItemId('');
    setModoCantidad('botella');
    setClienteTexto('');
    setNroDoc('');
    setObservaciones('');
    clearIngresosCartDraft();
    await loadVentasDia(ubicacionId, fecha);
    await loadProductos(ubicacionId);
  };

  const handleSubmitAgrupada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!ubicacionId) { setError('Seleccione un punto de venta.'); return; }
    if (cart.length === 0) { setError('Agregue al menos una línea al carrito.'); return; }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await bodegaService.registrarVentaMultiLinea({
        ubicacionId,
        canal,
        clienteId: clienteId || undefined,
        observaciones: buildObservaciones(),
        lineas: cart.map((l) => ({
          presentacionId: l.presentacionId,
          cantidadBotellas: l.cantidadBotellas,
          precioUnitarioBotella: l.precioUnitarioBotella,
        })),
        clientTxnId: newTxnId(),
      });
      setSuccess(`Venta registrada: ${cart.length} línea(s) · ${fmtMoney(cartTotal)}`);
      await clearFormAfterSale();
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar venta'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!ubicacionId) { setError('Seleccione un punto de venta.'); return; }
    if (!skuSel || !presComercial || botellas <= 0
      || !Number.isFinite(precioUnitarioBotella) || precioUnitarioBotella <= 0) {
      setError('Complete producto, cantidad y monto total válido.');
      return;
    }
    if (modoCantidad === 'pack' && !puedePack) {
      setError('Este producto no tiene presentación pack configurada.');
      return;
    }
    if (skuSel.stockItem > 0 && botellas > skuSel.stockItem) {
      setError(`Stock insuficiente: hay ${skuSel.stockItem} botellas.`);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await bodegaService.registrarVentaBotellas({
        ubicacionId,
        presentacionId: presComercial.presentacion_id,
        cantidadBotellas: botellas,
        precioUnitarioBotella,
        canal,
        clienteId: clienteId || undefined,
        observaciones: buildObservaciones(),
        clientTxnId: newTxnId(),
      });
      setSuccess(
        `Venta rápida: ${etiquetaLinea(skuSel.nombre, modoCantidad, factorActivo)} · ${botellas} bot. · ${fmtMoney(precioNum)}`,
      );
      await clearFormAfterSale();
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar venta'));
    } finally {
      setLoading(false);
    }
  };

  const stockHint = skuSel
    ? stockDisponibleSku(skuSel.itemId, skuSel.stockItem)
    : 0;

  return (
    <div className="animate-in">
      <PageHeader
        title="Ingresos POS"
        subtitle={esRapida
          ? 'POS — una línea (carrito multi-línea en modo agrupada)'
          : 'POS — carrito multi-línea por comprobante'}
        moduleId="ingresos"
        action={
          <Link to="/sales/modificaciones" className="btn btn-ghost">
            <span className="material-icons-round">edit_note</span>
            Corregir ventas
          </Link>
        }
      />
      <Alert
        type="info"
        message="Seleccione el producto (SKU). El stock se muestra y descuenta en botellas; use Botellas/Packs solo para indicar cómo cuenta la cantidad. Las ventas nuevas siempre se registran con la fecha de hoy (America/Lima)."
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <CatalogGate
        ready={pvUbicaciones.length > 0}
        emptyIcon="storefront"
        emptyTitle="Sin puntos de venta"
        emptyHint="Configure ubicaciones con es_punto_venta en el catálogo"
      >
      <div className="qty-mode-toggle" role="group" aria-label="Modo de venta">
        <button
          type="button"
          className={`qty-mode-btn ${modo === 'agrupada' ? 'active' : ''}`}
          onClick={() => onModoChange('agrupada')}
        >
          <span className="material-icons-round">shopping_cart</span>
          Venta agrupada
        </button>
        <button
          type="button"
          className={`qty-mode-btn ${modo === 'rapida' ? 'active' : ''}`}
          onClick={() => onModoChange('rapida')}
        >
          <span className="material-icons-round">bolt</span>
          Venta rápida
        </button>
      </div>

      <FormSection title="Cabecera del comprobante">
        <FormRow>
          <FormSelect label="Punto de venta" value={ubicacionId} onChange={onUbicacionChange} required
            options={pvUbicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          <FormInput
            label="Consultar ventas del día"
            type="date"
            value={fecha}
            onChange={(v) => { setFecha(v); loadVentasDia(ubicacionId, v); }}
            required
          />
        </FormRow>
        <p className="kpi-sub form-hint-inline">
          Fecha de registro de nuevas ventas = hoy (el RPC no acepta fecha histórica).
        </p>
        <FormRow>
          <FormSelect label="Cliente (opcional)" value={clienteId} onChange={setClienteId}
            options={[
              { value: '', label: '— Sin cliente —' },
              ...clientes.map((c) => ({ value: c.id, label: clienteLabel(c) })),
            ]} />
          <FormInput label="Cliente (texto libre)" value={clienteTexto} onChange={setClienteTexto} />
        </FormRow>
        <FormRow>
          <FormSelect label="Tipo documento" value={tipoDoc} onChange={setTipoDoc}
            options={TIPOS_DOC} />
          <FormInput label="N° documento" value={nroDoc} onChange={setNroDoc} />
        </FormRow>
        <FormRow>
          <FormSelect label="Moneda" value={moneda} onChange={setMoneda}
            options={[{ value: 'PEN', label: 'PEN — Soles' }]} />
          <FormSelect label="Canal" value={canal} onChange={setCanal}
            options={canalesVenta.length > 0
              ? canalesVenta.map((c) => ({ value: c.codigo, label: canalVentaLabel(c) }))
              : [{ value: 'DIRECTO', label: 'Directo' }]} />
        </FormRow>
        <FormInput label="Observaciones" value={observaciones} onChange={setObservaciones} />
      </FormSection>

      <FormSection title={esRapida ? 'Línea de venta' : 'Agregar línea'}>
        {loadingProductos && <p className="kpi-sub">Cargando productos…</p>}
        {categorias.length > 1 && (
          <FormSelect label="Categoría" value={categoria} onChange={(v) => { setCategoria(v); setItemId(''); }}
            options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c, label: c }))]} />
        )}
        <FormSelect
          label="Producto (con stock)"
          value={itemId}
          onChange={onSkuChange}
          options={[
            { value: '', label: '— Seleccionar producto —' },
            ...skusConStock.map((s) => ({
              value: s.itemId,
              label: etiquetaSkuConStock(s),
            })),
          ]}
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
            type="number" value={cantidad} onChange={setCantidad} min={1}
          />
          <FormInput
            label={esRapida ? 'Monto total línea (S/)' : 'Precio por botella (S/)'}
            type="number"
            value={precioInput}
            onChange={setPrecioInput}
            min={0.01}
            step="0.01"
          />
        </FormRow>
        {skuSel && botellas > 0 && (
          <p className="qty-base-summary">
            {resumenCantidadBase({
              cantidadIngresada: cantIngresada,
              modo: modoCantidad,
              cantUnidadesPresentacion: factorActivo,
            })}
            {` · Disp.: ${stockHint} bot.`}
            {esRapida && Number.isFinite(precioUnitarioBotella) && precioUnitarioBotella > 0 && (
              <> · P. unit. {fmtMoney(precioUnitarioBotella)}/bot.</>
            )}
          </p>
        )}
        {!esRapida && (
          <div className="form-actions form-actions--flat">
            <button type="button" className="btn btn-ghost" onClick={addLine}>
              <span className="material-icons-round">add_shopping_cart</span>
              Agregar al carrito
            </button>
          </div>
        )}
        {esRapida && (
          <form onSubmit={handleSubmitRapida}>
            <div className="form-actions">
              <SubmitButton loading={loading} label="Registrar venta rápida" icon="bolt" />
            </div>
          </form>
        )}
      </FormSection>

      {!esRapida && (
        <FormSection title="Carrito">
          {cart.length === 0 ? (
            <EmptyState icon="shopping_cart" title="Carrito vacío" hint="Agregue productos arriba" />
          ) : (
            <>
              <DataTable>
                <thead>
                  <tr><th>Producto</th><th>Cant. (bot.)</th><th>Precio/bot.</th><th>Subtotal</th><th /></tr>
                </thead>
                <tbody>
                  {cart.map((l, i) => (
                    <tr key={`${l.presentacionId}-${i}`}>
                      <td>{l.nombre}</td>
                      <td className="cell-num">{l.cantidadBotellas}</td>
                      <td className="cell-money">{fmtMoney(l.precioUnitarioBotella)}</td>
                      <td className="cell-money">{fmtMoney(l.cantidadBotellas * l.precioUnitarioBotella)}</td>
                      <td>
                        <button type="button" className="btn-icon" onClick={() => setCart(cart.filter((_, j) => j !== i))} title="Quitar">
                          <span className="material-icons-round">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <p className="cart-total">Total: {fmtMoney(cartTotal)}</p>
              <form onSubmit={handleSubmitAgrupada}>
                <div className="form-actions">
                  <SubmitButton loading={loading} label="Registrar venta" icon="point_of_sale" />
                </div>
              </form>
            </>
          )}
        </FormSection>
      )}

      <FormSection title="Ventas del día consultado">
        {loadingVentas ? (
          <p className="kpi-sub">Cargando…</p>
        ) : ventasDia.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title={fecha === hoyYmd() ? 'Sin ventas hoy en este PV' : `Sin ventas el ${fecha} en este PV`}
          />
        ) : (
          <DataTable>
            <thead><tr><th>Fecha</th><th>N° Venta</th><th>Cliente</th><th>Canal</th><th>Total</th></tr></thead>
            <tbody>
              {ventasDia.map((v) => (
                <tr key={v.id}>
                  <td>{v.fecha ? fmtDate(v.fecha.split('T')[0]) : '—'}</td>
                  <td><code className="code-tag">{v.nro_venta || v.id.slice(0, 8)}</code></td>
                  <td>{v.ma_cliente?.nombre || v.observaciones || '—'}</td>
                  <td>{v.canal || '—'}</td>
                  <td className="cell-money">{fmtMoney(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </FormSection>
      </CatalogGate>
    </div>
  );
};

export default IncomePage;
