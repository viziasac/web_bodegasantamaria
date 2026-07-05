import React, { useEffect, useMemo, useState } from 'react';
import { getTransferencias, confirmarRecepcionTransferencia } from '../../services/apiProvider';
import { bodegaService } from '../../services/bodegaService';
import { newTxnId } from '../../utils/txnId';
import {
  cantidadBaseDesdeEntrada, etiquetaModoCantidad, resumenCantidadBase, type ModoCantidadEmpaque,
} from '../../utils/cantidadEmpaque';
import { etiquetaPresentacionCatalogo } from '../../utils/presentacionLabels';
import { CantidadEmpaqueToggle } from '../../components/CantidadEmpaqueToggle';
import {
  PageHeader, PageLoader, Alert, FormSelect, FormInput, SubmitButton, TabBar,
  DataTable, EmptyState, toUserMessage, fmtDate,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import type { TrnTransferencia } from '../../types';

type TipoTransfer = 'pt' | 'material';
type FiltroHist = 'EN_TRANSITO' | 'TODAS';

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

  const cantIngresada = parseFloat(cantidad);
  const cantFinal = tipo === 'pt' && presSel && !Number.isNaN(cantIngresada) && cantIngresada > 0
    ? cantidadBaseDesdeEntrada({
      cantidadIngresada,
      modo: modoCantidad,
      cantUnidadesPresentacion: presSel.cant_unidades ?? 1,
    })
    : cantIngresada;

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

  useEffect(() => { load(); }, [filtroHist]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (origenId === destinoId) { setError('Origen y destino deben ser diferentes.'); return; }
    if (!Number.isFinite(cantFinal) || cantFinal <= 0) {
      setError('Cantidad inválida.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      const lineas = tipo === 'pt'
        ? [{ presentacion_id: presentacionId, cantidad: cantFinal }]
        : [{ item_id: itemId, cantidad: cantFinal }];
      await bodegaService.crearTransferenciaConFifo({
        origenId, destinoId, lineas, clientTxnId: newTxnId(),
      });
      setSuccess('Transferencia creada (EN_TRANSITO).');
      setCantidad('');
      await load();
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
      <PageHeader title="Transferencias" subtitle="Movimiento entre ubicaciones" />
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
        <form onSubmit={crear}>
          <FormSelect label="Origen" value={origenId} onChange={setOrigenId} required
            options={ubicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          <FormSelect label="Destino" value={destinoId} onChange={setDestinoId} required
            options={ubicaciones.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          {tipo === 'pt' ? (
            <>
              <FormSelect label="Presentación" value={presentacionId} onChange={(v) => {
                setPresentacionId(v);
                const p = presPt.find((x) => x.id === v);
                if (p && (p.cant_unidades ?? 1) <= 1) setModoCantidad('botella');
              }} required
                options={presPt.map((p) => ({ value: p.id, label: etiquetaPresentacionCatalogo(p) }))} />
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
                    cantidadIngresada,
                    modo: modoCantidad,
                    cantUnidadesPresentacion: presSel.cant_unidades ?? 1,
                  })}
                </p>
              )}
            </>
          ) : (
            <>
              <FormSelect label="Material / insumo" value={itemId} onChange={setItemId} required
                options={materiales.map((i) => ({ value: i.id, label: `${i.codigo} — ${i.nombre}` }))} />
              <FormInput label="Cantidad" type="number" value={cantidad} onChange={setCantidad} required min={0.001} step="any" />
            </>
          )}
          <div className="form-actions">
            <SubmitButton loading={submitting} label="Enviar transferencia" icon="swap_horiz" />
          </div>
        </form>
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
                          <span className="material-icons-round">check</span>
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
