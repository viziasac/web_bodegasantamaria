import React, { useEffect, useState } from 'react';
import { getStockAgregadoPorUbicacion, registrarReempaque } from '../../services/apiProvider';
import { newTxnId } from '../../utils/txnId';
import {
  PageHeader, Alert, FormSelect, FormInput, SubmitButton, EmptyState, toUserMessage, fmtNum,
} from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';

const RepackPage: React.FC = () => {
  const { items, ubicaciones, ensureCatalogLoaded } = useCatalog();
  const [ubicacionId, setUbicacionId] = useState('');
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [cantOrigen, setCantOrigen] = useState('');
  const [cantDestino, setCantDestino] = useState('');
  const [observacion, setObservacion] = useState('');
  const [stockByItem, setStockByItem] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ptItems = items.filter((i) => i.tipo === 'PT');
  const insumoItems = items.filter((i) => i.tipo !== 'PT');
  const reempaqueItems = [...ptItems, ...insumoItems];
  const itemLabel = (i: { id: string; codigo: string; nombre: string; unidad_medida?: string }) => {
    const stock = stockByItem[i.id];
    const stockTxt = stock != null ? ` · stock ${fmtNum(stock, 2)}` : '';
    return `${i.codigo} — ${i.nombre}${stockTxt}`;
  };
  const origenSel = reempaqueItems.find((i) => i.id === origenId);
  const stockOrigen = origenId ? (stockByItem[origenId] ?? 0) : null;
  const cantO = parseFloat(cantOrigen);

  useEffect(() => {
    if (!ubicacionId) { setStockByItem({}); return; }
    getStockAgregadoPorUbicacion(ubicacionId)
      .then((rows) => {
        const map: Record<string, number> = {};
        rows.forEach((r) => { map[r.item_id] = r.stock_total; });
        setStockByItem(map);
      })
      .catch(() => setStockByItem({}));
  }, [ubicacionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (origenId === destinoId) {
      setError('El ítem origen y destino deben ser diferentes.');
      return;
    }
    if (stockOrigen != null && Number.isFinite(cantO) && cantO > stockOrigen) {
      setError(`Stock insuficiente en origen: disponible ${fmtNum(stockOrigen, 2)}.`);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await registrarReempaque({
        ubicacionId,
        itemOrigenId: origenId,
        itemDestinoId: destinoId,
        cantidadOrigen: parseFloat(cantOrigen),
        cantidadDestino: parseFloat(cantDestino),
        observacion: observacion || undefined,
        txnId: newTxnId(),
      });
      setSuccess('Reempaque registrado correctamente.');
      setCantOrigen('');
      setCantDestino('');
      setObservacion('');
      const rows = await getStockAgregadoPorUbicacion(ubicacionId);
      const map: Record<string, number> = {};
      rows.forEach((r) => { map[r.item_id] = r.stock_total; });
      setStockByItem(map);
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar reempaque'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Reempaque" subtitle="Cambio de formato o etiqueta" moduleId="reempaque" />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {reempaqueItems.length === 0 ? (
        <EmptyState icon="transform" title="Sin ítems disponibles para reempaque" />
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <FormSelect label="Ubicación" value={ubicacionId} onChange={setUbicacionId} required
              options={ubicaciones.filter((u) => !u.es_punto_venta).map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` }))} />
            <FormSelect label="Ítem origen" value={origenId} onChange={setOrigenId} required
              options={reempaqueItems.map((i) => ({ value: i.id, label: itemLabel(i) }))} />
            {stockOrigen != null && origenSel && (
              <p className="qty-base-summary">
                Disponible origen: {fmtNum(stockOrigen, 2)} {origenSel.unidad_medida}
              </p>
            )}
            <FormSelect label="Ítem destino" value={destinoId} onChange={setDestinoId} required
              options={reempaqueItems.map((i) => ({ value: i.id, label: itemLabel(i) }))} />
            <FormInput label="Cantidad origen" type="number" value={cantOrigen} onChange={setCantOrigen} required min={0.001} step="any" />
            <FormInput label="Cantidad destino" type="number" value={cantDestino} onChange={setCantDestino} required min={0.001} step="any" />
            <FormInput label="Observación" value={observacion} onChange={setObservacion} />
            <div className="form-actions"><SubmitButton loading={loading} label="Registrar reempaque" icon="transform" /></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RepackPage;
