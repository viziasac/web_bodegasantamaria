import React, { useEffect, useMemo, useState } from 'react';
import {
  getTransferencias, confirmarRecepcionTransferencia,
  getStockAgregadoPorUbicacion,
} from '../../services/apiProvider';
import { bodegaService } from '../../services/bodegaService';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import {
  skusDesdeCatalogoPt, categoriasSkus, filtrarSkusPorCategoria,
  etiquetaSkuConStock, presentacionParaFactor, factorActivoSku, factoresPackSku,
} from '../../utils/skuVenta';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, PageLoader, Alert, FormSelect, FormInput, TabBar,
  DataTable, EmptyState, toUserMessage, fmtDate, fmtNum,
  PageFeedback,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { ubicacionesOperativas, tiposPermitidosParaUbicacion, normalizarTipoItem } from '../../utils/ubicacionItemPolicy';
import { MSG_RECIBIDO, MSG_REGISTRADO } from '../../utils/uiFeedback';
import type { TrnTransferencia } from '../../types';

type TipoTransfer = 'pt' | 'material';
type FiltroHist = 'EN_TRANSITO' | 'TODAS';

interface CartLine {
  id: string;
  tipo: TipoTransfer;
  /** PT: item_id del SKU (reserva stock). */
  itemId?: string;
  presentacionId?: string;
  label: string;
  cantidad: number;
  unidad: string;
}

const TransfersPage: React.FC = () => {
  const { ubicaciones, presentaciones, items, ensureCatalogLoaded } = useCatalog();
  const [filtroHist, setFiltroHist] = useState<FiltroHist>('EN_TRANSITO');
  const [transferencias, setTransferencias] = useState<TrnTransferencia[]>([]);
  const [tipo, setTipo] = useState<TipoTransfer>('pt');
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [itemId, setItemId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [factorPackSel, setFactorPackSel] = useState(1);
  const [cantidad, setCantidad] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [stockByItem, setStockByItem] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ubiOps = useMemo(() => ubicacionesOperativas(ubicaciones), [ubicaciones]);
  const origenSel = ubiOps.find((u) => u.id === origenId);

  const skus = useMemo(
    () => skusDesdeCatalogoPt(presentaciones, stockByItem),
    [presentaciones, stockByItem],
  );
  const categorias = useMemo(() => categoriasSkus(skus), [skus]);
  const skusFiltrados = useMemo(() => {
    let list = filtrarSkusPorCategoria(skus, categoria || undefined);
    if (origenSel) {
      const allow = tiposPermitidosParaUbicacion(origenSel);
      if (allow.length && !allow.includes('PT')) list = [];
    }
    return list;
  }, [skus, categoria, origenSel]);
  const skuSel = skus.find((s) => s.itemId === itemId)
    ?? skusFiltrados.find((s) => s.itemId === itemId);

  const materiales = useMemo(() => {
    let list = items.filter((i) => normalizarTipoItem(i.tipo) !== 'PT' && i.activo !== false);
    if (origenSel) {
      const allow = new Set(tiposPermitidosParaUbicacion(origenSel).map((t) => t));
      list = list.filter((i) => allow.has(normalizarTipoItem(i.tipo) as 'GRANEL' | 'INSUMO' | 'EMPAQUE' | 'MATERIAL'));
    }
    return list;
  }, [items, origenSel]);
  const matSel = materiales.find((i) => i.id === itemId);

  const packFactores = skuSel ? factoresPackSku(skuSel) : [];
  const puedePack = packFactores.length > 0;
  const factorPackSelSafe = puedePack && packFactores.includes(factorPackSel)
    ? factorPackSel
    : (packFactores[0] ?? 1);
  const factorActivo = skuSel ? factorActivoSku(skuSel, modoCantidad, factorPackSelSafe) : 1;
  const presComercial = skuSel
    ? presentacionParaFactor(skuSel, modoCantidad, factorPackSelSafe)
    : undefined;

  const cantIngresada = parseFloat(cantidad);
  const cantFinal = tipo === 'pt' && skuSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada: cantIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: factorActivo,
    })
    : cantIngresada;

  const stockReservado = (id: string) => cart
    .filter((l) => l.itemId === id)
    .reduce((s, l) => s + l.cantidad, 0);

  const stockDisponible = tipo === 'pt' && skuSel
    ? Math.max(0, skuSel.stockItem - stockReservado(skuSel.itemId))
    : tipo === 'material' && itemId
      ? Math.max(0, (stockByItem[itemId] ?? 0) - stockReservado(itemId))
      : null;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTransferencias(filtroHist === 'EN_TRANSITO' ? 'EN_TRANSITO' : undefined);
      setTransferencias(data);
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando transferencias'));
    } finally {
      setLoading(false);
    }
  };

  const loadStockOrigen = async (ubi: string) => {
    if (!ubi) { setStockByItem({}); return; }
    try {
      const agg = await getStockAgregadoPorUbicacion(ubi);
      const map: Record<string, number> = {};
      for (const r of agg) map[r.item_id] = r.stock_total;
      setStockByItem(map);
    } catch (err) {
      setStockByItem({});
      setError(toUserMessage(err, 'No se pudo cargar el stock del origen'));
    }
  };

  useEffect(() => { load(); }, [filtroHist]);
  useEffect(() => { if (origenId) loadStockOrigen(origenId); }, [origenId]);

  const addLine = () => {
    if (!Number.isFinite(cantFinal) || cantFinal <= 0) {
      setError('Cantidad inválida.');
      return;
    }
    if (!origenId || !destinoId) {
      setError('Seleccione origen y destino.');
      return;
    }
    if (origenId === destinoId) {
      setError('Origen y destino deben ser diferentes.');
      return;
    }
    if (stockDisponible != null && cantFinal > stockDisponible) {
      setError(`Stock insuficiente en origen: disponible ${fmtNum(stockDisponible, 2)} bot./uds.`);
      return;
    }
    const destino = ubiOps.find((u) => u.id === destinoId);
    if (tipo === 'pt') {
      if (!skuSel) { setError('Seleccione un SKU.'); return; }
      if (modoCantidad === 'pack' && (!puedePack || !presComercial)) {
        setError('Seleccione un pack con presentación comercial configurada (matriz SKU × empaque).');
        return;
      }
      if (!presComercial) { setError('Seleccione un SKU.'); return; }
      if (!tiposPermitidosParaUbicacion(origenSel).includes('PT')) {
        setError('El origen no admite producto terminado. Use ALM_PT o un PV.');
        return;
      }
      if (!tiposPermitidosParaUbicacion(destino).includes('PT')) {
        setError('El destino no admite producto terminado. Use ALM_PT o un PV.');
        return;
      }
      if (cart.some((l) => l.itemId === skuSel.itemId && l.tipo === 'pt')) {
        setError('Ese SKU ya está en el carrito. Quite la línea o ajuste la cantidad.');
        return;
      }
      setCart([...cart, {
        id: `L-${Date.now()}`,
        tipo: 'pt',
        itemId: skuSel.itemId,
        presentacionId: presComercial.presentacion_id,
        label: `${etiquetaSkuConStock(skuSel).replace(/ · .*disp\.| · sin stock/, '')} · ${modoCantidad === 'pack' ? `pack ×${factorActivo}` : 'botellas'}`,
        cantidad: cantFinal,
        unidad: 'bot.',
      }]);
    } else {
      if (!matSel) { setError('Seleccione material.'); return; }
      const tipoMat = normalizarTipoItem(matSel.tipo);
      if (!tiposPermitidosParaUbicacion(origenSel).includes(tipoMat as 'GRANEL' | 'INSUMO' | 'EMPAQUE' | 'MATERIAL')) {
        setError(`El origen no admite ${tipoMat}.`);
        return;
      }
      if (!tiposPermitidosParaUbicacion(destino).includes(tipoMat as 'GRANEL' | 'INSUMO' | 'EMPAQUE' | 'MATERIAL')) {
        setError(`El destino no admite ${tipoMat}.`);
        return;
      }
      if (cart.some((l) => l.itemId === itemId)) {
        setError('Ese material ya está en el carrito.');
        return;
      }
      setCart([...cart, {
        id: `L-${Date.now()}`,
        tipo: 'material',
        itemId,
        label: `${matSel.codigo} — ${matSel.nombre}`,
        cantidad: cantFinal,
        unidad: matSel.unidad_medida,
      }]);
    }
    setError(null);
    setCantidad('');
    setItemId('');
    setModoCantidad('botella');
    setFactorPackSel(1);
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (origenId === destinoId) { setError('Origen y destino deben ser diferentes.'); return; }
    if (cart.length === 0) { setError('Agregue al menos una línea al carrito.'); return; }
    const hasPt = cart.some((l) => l.tipo === 'pt');
    const hasMat = cart.some((l) => l.tipo === 'material');
    if (hasPt && hasMat) {
      setError('No mezcle PT y materiales en la misma transferencia. Envíe por separado.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      const lineas = cart.map((l) => (l.tipo === 'pt'
        ? { presentacion_id: l.presentacionId!, cantidad: l.cantidad }
        : { item_id: l.itemId!, cantidad: l.cantidad }));
      await bodegaService.crearTransferenciaConFifo({
        origenId, destinoId, lineas, clientTxnId: newTxnId(),
      });
      setSuccess(MSG_REGISTRADO);
      setCart([]);
      setCantidad('');
      setItemId('');
      await Promise.all([load(), loadStockOrigen(origenId)]);
    } catch (err) {
      setError(toUserMessage(err, 'Error al crear transferencia'));
    } finally {
      setSubmitting(false);
    }
  };

  const recibir = async (id: string) => {
    if (!confirm('¿Confirmar recepción de esta transferencia?')) return;
    setReceivingId(id);
    setError(null);
    try {
      await confirmarRecepcionTransferencia(id);
      setSuccess(MSG_RECIBIDO);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'Error al recibir transferencia'));
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Transferencias" subtitle="Movimiento entre ubicaciones — carrito multi-línea" moduleId="transferencias" />
      <PageFeedback
        success={success}
        error={error}
        onClearSuccess={() => setSuccess(null)}
        onClearError={() => setError(null)}
      />

      <div className="card card-section">
        <h3 className="card-section-title">Nueva transferencia</h3>
        <Alert type="info">
          PT se transfiere por SKU en botellas. Pack ×6 / ×12 solo cambia cómo ingresa la cantidad;
          el stock físico es el mismo pool de botellas.
        </Alert>
        <TabBar
          active={tipo}
          onChange={(id) => {
            setTipo(id as TipoTransfer);
            setCantidad('');
            setItemId('');
            setModoCantidad('botella');
            setFactorPackSel(1);
          }}
          tabs={[
            { id: 'pt', label: 'Producto terminado', icon: 'inventory_2' },
            { id: 'material', label: 'Material / insumo', icon: 'category' },
          ]}
        />
        <form onSubmit={(e) => { e.preventDefault(); addLine(); }}>
          <FormSelect label="Origen" value={origenId} onChange={(v) => {
            setOrigenId(v);
            setCart([]);
            setItemId('');
            setCategoria('');
          }} required
            options={[
              { value: '', label: '— Origen —' },
              ...ubiOps.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
            ]} />
          <FormSelect label="Destino" value={destinoId} onChange={setDestinoId} required
            options={[
              { value: '', label: '— Destino —' },
              ...ubiOps.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
            ]} />
          {tipo === 'pt' ? (
            <>
              {categorias.length > 1 && (
                <FormSelect
                  label="Categoría"
                  value={categoria}
                  onChange={(v) => { setCategoria(v); setItemId(''); }}
                  options={[
                    { value: '', label: 'Todas' },
                    ...categorias.map((c) => ({ value: c, label: c })),
                  ]}
                />
              )}
              <FormSelect
                label="SKU (producto terminado)"
                value={itemId}
                onChange={(v) => {
                  setItemId(v);
                  setModoCantidad('botella');
                  const sku = skus.find((s) => s.itemId === v);
                  setFactorPackSel(sku?.factorPack ?? 1);
                }}
                required
                options={[
                  { value: '', label: '— Seleccionar SKU —' },
                  ...skusFiltrados.map((s) => ({
                    value: s.itemId,
                    label: etiquetaSkuConStock(s),
                  })),
                ]}
              />
              {skuSel && puedePack && (
                <CantidadEmpaqueToggle
                  modo={modoCantidad}
                  onChange={setModoCantidad}
                  cantUnidades={factorPackSelSafe}
                  packFactores={packFactores}
                  onFactorChange={setFactorPackSel}
                />
              )}
              <FormInput
                label={skuSel ? etiquetaModoCantidad(modoCantidad, factorActivo) : 'Cantidad'}
                type="number" value={cantidad} onChange={setCantidad} required min={1}
              />
              {skuSel && cantFinal > 0 && (
                <p className="qty-base-summary">
                  {resumenCantidadBase({
                    cantidadIngresada: cantIngresada,
                    modo: modoCantidad,
                    cantUnidadesPresentacion: factorActivo,
                  })}
                  {stockDisponible != null && ` · Disponible origen: ${fmtNum(stockDisponible, 0)} bot.`}
                </p>
              )}
            </>
          ) : (
            <>
              <FormSelect label="Material / insumo" value={itemId} onChange={setItemId} required
                options={[
                  { value: '', label: '— Material —' },
                  ...materiales.map((i) => ({
                    value: i.id,
                    label: `${i.codigo} — ${i.nombre} · stock ${fmtNum(stockByItem[i.id] ?? 0, 2)} ${i.unidad_medida}`,
                  })),
                ]} />
              <FormInput label="Cantidad" type="number" value={cantidad} onChange={setCantidad} required min={0.001} step="any" />
              {stockDisponible != null && (
                <p className="qty-base-summary">Disponible origen: {fmtNum(stockDisponible, 2)} {matSel?.unidad_medida ?? ''}</p>
              )}
            </>
          )}
          <div className="form-actions form-actions--flat">
            <button type="submit" className="btn btn-ghost">
              <span className="material-icons-round">add</span>
              Agregar al carrito
            </button>
          </div>
        </form>

        {cart.length > 0 && (
          <>
            <DataTable>
              <thead>
                <tr><th>Ítem</th><th>Cantidad</th><th /></tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.id}>
                    <td>{l.label}</td>
                    <td>{fmtNum(l.cantidad, 2)} {l.unidad}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn-icon" title="Quitar"
                        onClick={() => setCart(cart.filter((x) => x.id !== l.id))}>
                        <span className="material-icons-round">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={crear}>
                <span className="material-icons-round">{submitting ? 'hourglass_empty' : 'swap_horiz'}</span>
                {submitting ? 'Procesando…' : `Enviar ${cart.length} línea(s)`}
              </button>
            </div>
          </>
        )}
      </div>

      <TabBar
        active={filtroHist}
        onChange={(id) => setFiltroHist(id as FiltroHist)}
        tabs={[
          { id: 'EN_TRANSITO', label: 'Pendientes', icon: 'local_shipping' },
          { id: 'TODAS', label: 'Todas', icon: 'list' },
        ]}
      />

      {loading ? <PageLoader /> : (
        <div className="card card-section">
          <h3 className="card-section-title">Historial</h3>
          {transferencias.length === 0 ? (
            <EmptyState icon="swap_horiz" title="Sin transferencias" />
          ) : (
            <DataTable>
              <thead>
                <tr><th>N°</th><th>Origen</th><th>Destino</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {transferencias.map((t) => (
                  <tr key={t.id}>
                    <td><code className="code-tag">{t.nro_transferencia || t.id.slice(0, 8)}</code></td>
                    <td>{t.origen?.nombre ?? '—'}</td>
                    <td>{t.destino?.nombre ?? '—'}</td>
                    <td><span className={`status-tag ${t.estado === 'RECIBIDA' ? 'status-ok' : 'status-warn'}`}>{t.estado}</span></td>
                    <td>{t.fecha_envio ? fmtDate(String(t.fecha_envio).split('T')[0]) : '—'}</td>
                    <td className="cell-actions">
                      {t.estado === 'EN_TRANSITO' && (
                        <button type="button" className="btn-sm btn-primary"
                          disabled={receivingId === t.id}
                          onClick={() => recibir(t.id)}>
                          <span className="material-icons-round">{receivingId === t.id ? 'hourglass_empty' : 'check'}</span>
                          {receivingId === t.id ? '…' : 'Recibir'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      )}
    </div>
  );
};

export default TransfersPage;
