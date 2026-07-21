import React, { useEffect, useMemo, useState } from 'react';
import {
  getTransferencias, confirmarRecepcionTransferencia,
  getStockAgregadoPorUbicacion, getPresentacionesConStock,
} from '../../services/apiProvider';
import { bodegaService } from '../../services/bodegaService';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import { etiquetaPresentacionCatalogo } from '../../utils/presentacionLabels';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, PageLoader, Alert, FormSelect, FormInput, TabBar,
  DataTable, EmptyState, toUserMessage, fmtDate, fmtNum,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import type { TrnTransferencia } from '../../types';

type TipoTransfer = 'pt' | 'material';
type FiltroHist = 'EN_TRANSITO' | 'TODAS';

interface CartLine {
  id: string;
  tipo: TipoTransfer;
  presentacionId?: string;
  itemId?: string;
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
  const [presentacionId, setPresentacionId] = useState('');
  const [itemId, setItemId] = useState('');
  const [modoCantidad, setModoCantidad] = useState<ModoCantidadEmpaque>('botella');
  const [cantidad, setCantidad] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const presPt = useMemo(
    () => presentaciones.filter((p) => p.ma_item?.tipo === 'PT'),
    [presentaciones],
  );
  const presSel = presPt.find((p) => p.id === presentacionId);
  const materiales = useMemo(
    () => items.filter((i) => i.tipo !== 'PT'),
    [items],
  );
  const matSel = materiales.find((i) => i.id === itemId);

  const cantIngresada = parseFloat(cantidad);
  const cantFinal = tipo === 'pt' && presSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada: cantIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: presSel.cant_unidades ?? 1,
    })
    : cantIngresada;

  const stockDisponible = tipo === 'pt' && presentacionId
    ? (stockMap[`P:${presentacionId}`] ?? 0)
    : tipo === 'material' && itemId
      ? (stockMap[`I:${itemId}`] ?? 0)
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
    if (!ubi) { setStockMap({}); return; }
    try {
      const [agg, pres] = await Promise.all([
        getStockAgregadoPorUbicacion(ubi),
        getPresentacionesConStock(ubi),
      ]);
      const map: Record<string, number> = {};
      for (const p of pres) map[`P:${p.presentacion_id}`] = Number(p.stock_item) || 0;
      for (const r of agg) {
        if (r.tipo !== 'PT') map[`I:${r.item_id}`] = r.stock_total;
      }
      setStockMap(map);
    } catch (err) {
      setStockMap({});
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
    if (stockDisponible != null && cantFinal > stockDisponible) {
      setError(`Stock insuficiente en origen: disponible ${fmtNum(stockDisponible, 2)}.`);
      return;
    }
    if (tipo === 'pt') {
      if (!presSel) { setError('Seleccione presentación.'); return; }
      if (cart.some((l) => l.presentacionId === presentacionId)) {
        setError('Esa presentación ya está en el carrito.');
        return;
      }
      setCart([...cart, {
        id: `L-${Date.now()}`,
        tipo: 'pt',
        presentacionId,
        label: etiquetaPresentacionCatalogo(presSel),
        cantidad: cantFinal,
        unidad: 'bot.',
      }]);
    } else {
      if (!matSel) { setError('Seleccione material.'); return; }
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
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (origenId === destinoId) { setError('Origen y destino deben ser diferentes.'); return; }
    if (cart.length === 0) { setError('Agregue al menos una línea al carrito.'); return; }
    // XOR: all lines same family (all PT or all material) — API XOR per line but batch mixes might fail
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
      setSuccess(`Transferencia creada (${cart.length} línea(s), EN_TRANSITO).`);
      setCart([]);
      setCantidad('');
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
      setSuccess('Transferencia recibida.');
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
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card card-section">
        <h3 className="card-section-title">Nueva transferencia</h3>
        <TabBar
          active={tipo}
          onChange={(id) => { setTipo(id as TipoTransfer); setCantidad(''); }}
          tabs={[
            { id: 'pt', label: 'Producto terminado', icon: 'inventory_2' },
            { id: 'material', label: 'Material / insumo', icon: 'category' },
          ]}
        />
        <form onSubmit={(e) => { e.preventDefault(); addLine(); }}>
          <FormSelect label="Origen" value={origenId} onChange={setOrigenId} required
            options={[
              { value: '', label: '— Origen —' },
              ...ubicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
            ]} />
          <FormSelect label="Destino" value={destinoId} onChange={setDestinoId} required
            options={[
              { value: '', label: '— Destino —' },
              ...ubicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
            ]} />
          {tipo === 'pt' ? (
            <>
              <FormSelect label="Presentación" value={presentacionId} onChange={(v) => {
                setPresentacionId(v);
                const p = presPt.find((x) => x.id === v);
                if (p && (p.cant_unidades ?? 1) <= 1) setModoCantidad('botella');
              }} required
                options={[
                  { value: '', label: '— Presentación —' },
                  ...presPt.map((p) => ({
                    value: p.id,
                    label: `${etiquetaPresentacionCatalogo(p)} · stock ${fmtNum(stockMap[`P:${p.id}`] ?? 0, 0)} bot.`,
                  })),
                ]} />
              {presSel && (presSel.cant_unidades ?? 1) > 1 && (
                <CantidadEmpaqueToggle modo={modoCantidad} onChange={setModoCantidad}
                  cantUnidades={presSel.cant_unidades ?? 1} />
              )}
              <FormInput
                label={presSel ? etiquetaModoCantidad(modoCantidad, presSel.cant_unidades ?? 1) : 'Cantidad'}
                type="number" value={cantidad} onChange={setCantidad} required min={1}
              />
              {presSel && cantFinal > 0 && (
                <p className="qty-base-summary">
                  {resumenCantidadBase({
                    cantidadIngresada: cantIngresada,
                    modo: modoCantidad,
                    cantUnidadesPresentacion: presSel.cant_unidades ?? 1,
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
                    label: `${i.codigo} — ${i.nombre} · stock ${fmtNum(stockMap[`I:${i.id}`] ?? 0, 2)} ${i.unidad_medida}`,
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
                        <button type="button" className="btn btn-sm btn-primary"
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
