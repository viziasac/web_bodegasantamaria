import React, { useState, useEffect } from 'react';
import { bodegaService } from '../../services/bodegaService';
import { newTxnId } from '../../utils/txnId';
import { PageHeader, Alert, FormSelect, FormInput, SubmitButton, EmptyState, toUserMessage } from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';

const BulkProductionPage: React.FC = () => {
  const { items, ensureCatalogLoaded } = useCatalog();
  const [itemId, setItemId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [tanque, setTanque] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const granelItems = items.filter((i) => i.tipo === 'GRANEL');

  useEffect(() => {
    ensureCatalogLoaded();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanque.trim()) {
      setError('Ingrese referencia del tanque.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await ensureCatalogLoaded();
      await bodegaService.producirGranel({
        materialId: itemId,
        cantidad: parseFloat(cantidad),
        tanque: tanque.trim(),
        clientTxnId: newTxnId(),
      });
      const item = granelItems.find((i) => i.id === itemId);
      setSuccess(`Producción de ${item?.nombre ?? 'granel'} registrada en ALM_GR.`);
      setCantidad('');
      setTanque('');
    } catch (err) {
      setError(toUserMessage(err, 'Error al registrar granel'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader title="Producción Granel" subtitle="Entrada de vino/pisco a granel (ALM_GR)" moduleId="produccion_granel" />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      {granelItems.length === 0 ? (
        <EmptyState icon="wine_bar" title="Sin ítems de tipo GRANEL" hint="Configure ítems granel en el catálogo" />
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <FormSelect label="Ítem granel" value={itemId} onChange={setItemId} required
              options={granelItems.map((i) => ({ value: i.id, label: `${i.codigo} — ${i.nombre}` }))} />
            <FormInput label="Cantidad (litros)" type="number" value={cantidad} onChange={setCantidad} required min={0.001} step="any" />
            <FormInput label="Referencia tanque" value={tanque} onChange={setTanque} required placeholder="Ej: T-01, Tanque principal" />
            <div className="form-actions"><SubmitButton loading={loading} label="Registrar granel" icon="wine_bar" /></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BulkProductionPage;
