import React, { useEffect, useState } from 'react';
import { getRecetas } from '../../services/apiProvider';
import { PageHeader, PageLoader, Alert, DataTable, EmptyState, toUserMessage } from '../../components/ui';
import type { RecReceta } from '../../types';

const RecipesPage: React.FC = () => {
  const [recetas, setRecetas] = useState<RecReceta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecetas()
      .then(setRecetas)
      .catch((err) => setError(toUserMessage(err, 'Error cargando recetas')))
      .finally(() => setLoading(false));
  }, []);

  const grouped = recetas.reduce<Record<string, RecReceta[]>>((acc, r) => {
    const key = r.ma_item_producido?.nombre || r.item_producido_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="animate-in">
      <PageHeader title="Recetas" subtitle="Fórmulas y componentes (solo lectura)" />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {loading ? <PageLoader /> : recetas.length === 0 ? (
        <EmptyState icon="menu_book" title="Sin recetas registradas" />
      ) : (
        Object.entries(grouped).map(([producto, items]) => (
          <div className="card card-section" key={producto}>
            <div className="card-header"><h3>{producto}</h3></div>
            <DataTable>
              <thead><tr><th>Componente</th><th>Cantidad</th><th>Unidad</th></tr></thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id}>
                    <td>{r.ma_item_componente?.nombre}</td>
                    <td className="cell-num">{r.cantidad}</td>
                    <td>{r.unidad || r.ma_item_componente?.unidad_medida}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        ))
      )}
    </div>
  );
};

export default RecipesPage;
