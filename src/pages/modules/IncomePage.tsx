import React, { useEffect, useMemo, useState } from 'react';
import { bodegaService } from '../../services/bodegaService';
import { getPrecioReferencia, getVentasPorUbicacionFecha } from '../../services/apiProvider';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import {
  categoriasProductosPv, filtrarProductosPv, etiquetaPresentacionConStock,
} from '../../utils/presentacionLabels';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, FormRow, FormSection,
  ModuleHelp, DataTable, EmptyState, fmtMoney, fmtDate, toUserMessage,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import type { ProductoPv, VentaResumen } from '../../types';

interface CartLine {
  presentacionId: string;
  nombre: string;
  cantidadBotellas: number;
  precioUnitarioBotella: number;
}

const TIPOS_DOC = [
  { value: 'BOLETA', label: 'Boleta' },
  { value: 'FACTURA', label: 'Factura' },
  { value: 'TICKET', label: 'Ticket' },
  { value: 'OTRO', label: 'Otro' },
];

const IncomePage: React.FC = () => {
  const { ubicaciones, canalesVenta, clientes, ensureCatalogLoaded } = useCatalog();
  const [ubicacionId, setUbicacionId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
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
  const [presentacionId, setPresentacionId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [cantidad, setCantidad] = useState('');
  const [precioBotella, setPrecioBotella] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [ventasDia, setVentasDia] = useState<VentaResumen[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pvUbicaciones = ubicaciones.filter((u) => u.es_punto_venta);
  const categorias = useMemo(() => categoriasProductosPv(productos), [productos]);
  const productosFiltrados = useMemo(
    () => filtrarProductosPv(productos, categoria || undefined),
    [productos, categoria],
  );
  const presSel = productos.find((p) => p.presentacion_id === presentacionId);

  const cantIngresada = parseFloat(cantidad);
  const botellas = presSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: presSel.cant_unidades,
    })
    : 0;

  const cartTotal = cart.reduce((s, l) => s + l.cantidadBotellas * l.precioUnitarioBotella, 0);

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
    if (pvUbicaciones.length > 0 && !ubicacionId) {
      setUbicacionId(pvUbicaciones[0].id);
      loadProductos(pvUbicaciones[0].id);
      loadVentasDia(pvUbicaciones[0].id, fecha);
    }
  }, [pvUbicaciones.length]);

  useEffect(() => {
    if (canalesVenta.length > 0 && !canalesVenta.some((c) => c.codigo === canal)) {
      setCanal(canalesVenta[0].codigo);
    }
  }, [canalesVenta]);

  const onUbicacionChange = (id: string) => {
    setUbicacionId(id);
    setPresentacionId('');
    setCategoria('');
    setCart([]);
    loadProductos(id);
    loadVentasDia(id, fecha);
  };

  const onPresentacionChange = async (v: string) => {
    setPresentacionId(v);
    const p = productos.find((x) => x.presentacion_id === v);
    if (p && p.cant_unidades <= 1) setModoCantidad('botella');
    try {
      const ref = await getPrecioReferencia(v);
      if (ref != null) setPrecioBotella(String(ref));
    } catch { /* optional */ }
  };

  const addLine = () => {
    if (!presentacionId || !cantidad || !precioBotella) {
      setError('Complete producto, cantidad y precio por botella.');
      return;
    }
    const precio = parseFloat(precioBotella);
    if (!presSel || botellas <= 0 || Number.isNaN(precio) || precio <= 0) {
      setError('Cantidad o precio inválido.');
      return;
    }
    if (presSel.stock_item > 0 && botellas > presSel.stock_item) {
      setError(`Stock insuficiente: hay ${presSel.stock_item} botellas.`);
      return;
    }
    setError(null);
    setCart([...cart, {
      presentacionId,
      nombre: presSel.nombre,
      cantidadBotellas: botellas,
      precioUnitarioBotella: precio,
    }]);
    setCantidad('');
    setPrecioBotella('');
    setPresentacionId('');
  };

  const buildObservaciones = () => {
    const parts: string[] = [];
    if (clienteTexto.trim()) parts.push(`Cliente: ${clienteTexto.trim()}`);
    if (nroDoc.trim()) parts.push(`${tipoDoc} ${nroDoc.trim()}`);
    if (moneda !== 'PEN') parts.push(`Moneda: ${moneda}`);
    if (observaciones.trim()) parts.push(observaciones.trim());
    return parts.length ? parts.join(' · ') : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setCart([]);
      await loadVentasDia(ubicacionId, fecha);
      await loadProductos(ubicacionId);
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar venta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Ingresos POS" subtitle="Ventas con carrito multi-línea" />
      <ModuleHelp message="Use este módulo para ventas con varios productos en un comprobante. Para una venta rápida de un solo ítem, use Despacho." />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <FormSection title="Cabecera del comprobante">
        <FormRow>
          <FormSelect label="Punto de venta" value={ubicacionId} onChange={onUbicacionChange} required
            options={pvUbicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          <FormInput label="Fecha" type="date" value={fecha}
            onChange={(v) => { setFecha(v); loadVentasDia(ubicacionId, v); }} required />
        </FormRow>
        <FormRow>
          <FormSelect label="Cliente (catálogo)" value={clienteId} onChange={setClienteId}
            options={clientes.map((c) => ({ value: c.id, label: c.nombre }))} />
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
              ? canalesVenta.map((c) => ({ value: c.codigo, label: c.nombre }))
              : [{ value: 'DIRECTO', label: 'Directo' }]} />
        </FormRow>
        <FormInput label="Observaciones" value={observaciones} onChange={setObservaciones} />
      </FormSection>

      <FormSection title="Agregar línea">
        {loadingProductos && <p className="kpi-sub">Cargando productos…</p>}
        {categorias.length > 1 && (
          <FormSelect label="Categoría" value={categoria} onChange={(v) => { setCategoria(v); setPresentacionId(''); }}
            options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c, label: c }))]} />
        )}
        <FormSelect label="Producto" value={presentacionId} onChange={onPresentacionChange}
          options={productosFiltrados
            .filter((p) => p.stock_item > 0)
            .map((p) => ({ value: p.presentacion_id, label: etiquetaPresentacionConStock(p) }))} />
        {presSel && (
          <CantidadEmpaqueToggle modo={modoCantidad} onChange={setModoCantidad} cantUnidades={presSel.cant_unidades} />
        )}
        <FormRow>
          <FormInput
            label={presSel ? etiquetaModoCantidad(modoCantidad, presSel.cant_unidades) : 'Cantidad'}
            type="number" value={cantidad} onChange={setCantidad} min={1}
          />
          <FormInput label="Precio por botella (S/)" type="number" value={precioBotella}
            onChange={setPrecioBotella} min={0.01} step="0.01" />
        </FormRow>
        {presSel && botellas > 0 && (
          <p className="qty-base-summary">
            {resumenCantidadBase({ cantidadIngresada, modo: modoCantidad, cantUnidadesPresentacion: presSel.cant_unidades })}
          </p>
        )}
        <div className="form-actions form-actions--flat">
          <button type="button" className="btn btn-ghost" onClick={addLine}>
            <span className="material-icons-round">add_shopping_cart</span>
            Agregar al carrito
          </button>
        </div>
      </FormSection>

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
            <form onSubmit={handleSubmit}>
              <div className="form-actions">
                <SubmitButton loading={loading} label="Registrar venta" icon="point_of_sale" />
              </div>
            </form>
          </>
        )}
      </FormSection>

      <FormSection title="Ventas del día">
        {loadingVentas ? (
          <p className="kpi-sub">Cargando…</p>
        ) : ventasDia.length === 0 ? (
          <EmptyState icon="receipt_long" title="Sin ventas hoy en este PV" />
        ) : (
          <DataTable>
            <thead><tr><th>Hora</th><th>N° Venta</th><th>Cliente</th><th>Canal</th><th>Total</th></tr></thead>
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
    </div>
  );
};

export default IncomePage;
