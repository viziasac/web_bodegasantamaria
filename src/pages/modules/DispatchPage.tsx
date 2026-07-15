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
  categoriasProductosPv, filtrarProductosPv, etiquetaPresentacionConStock,
} from '../../utils/presentacionLabels';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, FormRow, EmptyState,
  DataTable, toUserMessage, fmtMoney, fmtDate,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { hoyYmd } from '../../utils/fechaLocal';
import { loadWebPrefs } from '../../utils/webPrefs';
import type { ProductoPv, VentaResumen } from '../../types';

const DispatchPage: React.FC = () => {
  const { ubicaciones, canalesVenta, clientes, ensureCatalogLoaded } = useCatalog();
  const prefs = loadWebPrefs();
  const [ubicacionId, setUbicacionId] = useState(prefs.defaultPvId ?? '');
  const [categoria, setCategoria] = useState('');
  const [presentacionId, setPresentacionId] = useState('');
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
  const categorias = useMemo(() => categoriasProductosPv(productos), [productos]);
  const productosFiltrados = useMemo(
    () => filtrarProductosPv(productos, categoria || undefined),
    [productos, categoria],
  );
  const presSel = productos.find((p) => p.presentacion_id === presentacionId)
    ?? productosFiltrados.find((p) => p.presentacion_id === presentacionId);

  const cantIngresada = parseFloat(cantidad);
  const botellas = presSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: presSel.cant_unidades,
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

  const loadLotes = async (ubi: string, pres: string) => {
    if (!ubi || !pres) { setLotes([]); return; }
    try {
      setLotes(await getLotesDisponibles({ ubicacionId: ubi, presentacionId: pres }));
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
      loadProductos(ubicacionId);
      loadVentasHoy(ubicacionId);
    }
  }, [ubicacionId]);

  const onUbicacionChange = (v: string) => {
    setUbicacionId(v);
    setPresentacionId('');
    setCategoria('');
    setLoteId('');
    loadProductos(v);
    loadVentasHoy(v);
  };

  const onPresentacionChange = async (v: string) => {
    setPresentacionId(v);
    setLoteId('');
    loadLotes(ubicacionId, v);
    const p = productos.find((x) => x.presentacion_id === v);
    if (p && p.cant_unidades <= 1) setModoCantidad('botella');
    try {
      const ref = await getPrecioReferencia(v);
      if (ref != null) setPrecioBotella(String(ref));
    } catch { /* optional */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presSel || botellas <= 0) {
      setError('Seleccione producto y cantidad válida.');
      return;
    }
    if (Number.isNaN(precio) || precio <= 0) {
      setError('Ingrese precio por botella válido.');
      return;
    }
    if (presSel.stock_item > 0 && botellas > presSel.stock_item) {
      setError(`Stock insuficiente: hay ${presSel.stock_item} botellas disponibles.`);
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
        presentacionId,
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
        message="Atajo de mostrador o delivery: un producto por ticket. Para varias líneas en un mismo comprobante use Ingresos POS."
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {pvUbicaciones.length === 0 ? (
        <EmptyState
          icon="storefront"
          title="Sin puntos de venta"
          hint="Configure ubicaciones con es_punto_venta en el catálogo"
        />
      ) : (
      <>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <FormSelect label="Punto de venta" value={ubicacionId} onChange={onUbicacionChange} required
            options={pvUbicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          {loadingProductos && <p className="kpi-sub">Cargando productos…</p>}
          {categorias.length > 1 && (
            <FormSelect label="Categoría" value={categoria} onChange={(v) => { setCategoria(v); setPresentacionId(''); }}
              options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c, label: c }))]} />
          )}
          <FormSelect label="Producto (con stock)" value={presentacionId} onChange={onPresentacionChange} required
            options={productosFiltrados
              .filter((p) => p.stock_item > 0)
              .map((p) => ({ value: p.presentacion_id, label: etiquetaPresentacionConStock(p) }))} />
          {presSel && (
            <CantidadEmpaqueToggle
              modo={modoCantidad}
              onChange={setModoCantidad}
              cantUnidades={presSel.cant_unidades}
            />
          )}
          <FormRow>
            <FormInput
              label={presSel ? etiquetaModoCantidad(modoCantidad, presSel.cant_unidades) : 'Cantidad'}
              type="number" value={cantidad} onChange={setCantidad} required min={1}
            />
            <FormInput label="Precio por botella (S/)" type="number" value={precioBotella}
              onChange={setPrecioBotella} required min={0.01} step="0.01" />
          </FormRow>
          {presSel && botellas > 0 && (
            <p className="qty-base-summary">
              {resumenCantidadBase({ cantidadIngresada, modo: modoCantidad, cantUnidadesPresentacion: presSel.cant_unidades })}
              {totalVenta > 0 && ` · Total: ${fmtMoney(totalVenta)}`}
            </p>
          )}
          <FormSelect label="Lote (opcional — FIFO automático)" value={loteId} onChange={setLoteId}
            options={lotes.map((l) => ({ value: l.lote_id as string, label: labelLote(l) }))} />
          <FormSelect label="Canal" value={canal} onChange={setCanal}
            options={canalesVenta.length > 0
              ? canalesVenta.map((c) => ({ value: c.codigo, label: c.nombre }))
              : [{ value: 'DIRECTO', label: 'Directo' }]} />
          <FormSelect label="Cliente (opcional)" value={clienteId} onChange={setClienteId}
            options={clientes.map((c) => ({ value: c.id, label: c.nombre }))} />
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
      </>
      )}
    </div>
  );
};

export default DispatchPage;
