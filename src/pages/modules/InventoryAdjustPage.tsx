import React, { useEffect, useState } from 'react';
import { bodegaService } from '../../services/bodegaService';
import { getLotesDisponibles } from '../../services/apiProvider';
import { labelLote } from '../../utils/lotePolicy';
import { newTxnId } from '../../utils/txnId';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, fmtNum, toUserMessage,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import type { AjusteItemOption } from '../../types';

const LOTE_AUTO = '__auto__';

const InventoryAdjustPage: React.FC = () => {
  const { ubicaciones, ensureCatalogLoaded } = useCatalog();
  const [ubicacionId, setUbicacionId] = useState('');
  const [itemsStock, setItemsStock] = useState<AjusteItemOption[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [loteId, setLoteId] = useState(LOTE_AUTO);
  const [conteo, setConteo] = useState('');
  const [motivo, setMotivo] = useState('Conteo físico');
  const [lotes, setLotes] = useState<Record<string, unknown>[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const almacenes = ubicaciones.filter((u) => !u.es_punto_venta);
  const selected = itemsStock.find((o) => o.key === selectedKey);
  const conteoNum = parseFloat(conteo);
  const delta = selected && Number.isFinite(conteoNum) ? conteoNum - selected.stockTeorico : null;

  useEffect(() => {
    if (!ubicacionId && almacenes.length > 0) {
      const almMp = almacenes.find((u) => u.codigo === 'ALM_MP');
      setUbicacionId(almMp?.id ?? almacenes[0].id);
    }
  }, [almacenes, ubicacionId]);

  const loadItems = async (ubi: string) => {
    if (!ubi) { setItemsStock([]); return; }
    setLoadingItems(true);
    try {
      await ensureCatalogLoaded();
      setItemsStock(await bodegaService.itemsConStockParaAjuste(ubi));
    } catch (err) {
      setItemsStock([]);
      setError(toUserMessage(err, 'Error cargando ítems con stock'));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadLotes = async (ubi: string, opt: AjusteItemOption | undefined) => {
    if (!ubi || !opt) { setLotes([]); return; }
    try {
      setLotes(await getLotesDisponibles({
        ubicacionId: ubi,
        presentacionId: opt.presentacionId,
        itemId: opt.isProducto ? undefined : opt.id,
      }));
    } catch {
      setLotes([]);
    }
  };

  useEffect(() => {
    if (ubicacionId) loadItems(ubicacionId);
  }, [ubicacionId]);

  const onUbicacionChange = (v: string) => {
    setUbicacionId(v);
    setSelectedKey('');
    setLoteId(LOTE_AUTO);
    loadItems(v);
  };

  const onItemChange = (key: string) => {
    setSelectedKey(key);
    setLoteId(LOTE_AUTO);
    setConteo('');
    const opt = itemsStock.find((o) => o.key === key);
    loadLotes(ubicacionId, opt);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError('Seleccione un ítem con stock.');
      return;
    }
    if (!Number.isFinite(conteoNum)) {
      setError('Ingrese conteo físico válido.');
      return;
    }
    if (delta === 0) {
      setError('El conteo coincide con el stock teórico (delta = 0).');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await bodegaService.registrarAjusteInventario({
        ubicacionId,
        option: selected,
        conteoFisico: conteoNum,
        motivo,
        loteId: loteId !== LOTE_AUTO ? loteId : undefined,
        txnId: newTxnId(),
      });
      setSuccess(`Ajuste registrado: delta ${delta! > 0 ? '+' : ''}${fmtNum(delta!, 2)} ${selected.unidadMedida ?? ''}`);
      setConteo('');
      setSelectedKey('');
      await loadItems(ubicacionId);
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar ajuste'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Ajuste Manual" subtitle="Conteo físico — calcula delta automáticamente" />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      <div className="card">
        <form onSubmit={handleSubmit}>
          <FormSelect label="Ubicación" value={ubicacionId} onChange={onUbicacionChange} required
            options={almacenes.map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
          {loadingItems && <p className="kpi-sub">Cargando ítems con stock…</p>}
          <FormSelect label="Ítem (insumo o presentación PT)" value={selectedKey} onChange={onItemChange} required
            options={itemsStock.map((o) => ({
              value: o.key,
              label: `${o.nombre} · stock ${fmtNum(o.stockTeorico, 2)} ${o.unidadMedida ?? ''}`,
            }))} />
          {selected && (
            <p className="qty-base-summary">
              Stock teórico: {fmtNum(selected.stockTeorico, 2)} {selected.unidadMedida ?? ''}
              {selected.isProducto && ' (botellas)'}
            </p>
          )}
          <FormSelect label="Lote" value={loteId} onChange={setLoteId}
            options={[
              { value: LOTE_AUTO, label: 'Automático (FIFO/FEFO)' },
              ...lotes.map((l) => ({ value: l.lote_id as string, label: labelLote(l) })),
            ]} />
          <FormInput
            label={selected?.isProducto ? 'Conteo físico (botellas)' : `Conteo físico (${selected?.unidadMedida ?? 'uds'})`}
            type="number" value={conteo} onChange={setConteo} required step="any"
          />
          {delta != null && Number.isFinite(conteoNum) && (
            <p className={`qty-base-summary ${delta === 0 ? '' : delta > 0 ? 'text-ok' : 'text-danger'}`}>
              Delta: {delta > 0 ? '+' : ''}{fmtNum(delta, 2)} {selected?.unidadMedida ?? ''}
            </p>
          )}
          <FormInput label="Motivo" value={motivo} onChange={setMotivo} required />
          <div className="form-actions">
            <SubmitButton loading={loading} label="Registrar ajuste" icon="tune" />
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAdjustPage;
