import React from 'react';
import { Link } from 'react-router-dom';
import {
  PageHeader, PageLoader, TabBar, Alert,
} from '../../components/ui';
import { useInventarioData } from '../../components/inventory/useInventarioData';
import { InventoryPanorama } from '../../components/inventory/InventoryPanorama';
import { InventoryFilters } from '../../components/inventory/InventoryFilters';
import { useCatalog } from '../../context/CatalogContext';
import InventoryAdjustPage from './InventoryAdjustPage';

type InvTab = 'resumen' | 'ajuste';

const InventoryPage: React.FC = () => {
  const { ubicaciones, ensureCatalogLoaded } = useCatalog();
  const inv = useInventarioData(ensureCatalogLoaded);
  const [tab, setTab] = React.useState<InvTab>(() => {
    const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    return p.get('tab') === 'ajuste' ? 'ajuste' : 'resumen';
  });

  const { loading, error, setError, reload } = inv;

  return (
    <div className="animate-in">
      <PageHeader
        title="Inventario"
        subtitle="Consulta de stock y conteos físicos"
        action={
          <div className="page-header-actions">
            <Link to="/" className="btn btn-ghost">
              <span className="material-icons-round">insights</span>
              Ver detalle en Dashboard
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => reload()}>
              <span className="material-icons-round">refresh</span> Actualizar
            </button>
          </div>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <TabBar
        active={tab}
        onChange={(id) => setTab(id as InvTab)}
        tabs={[
          { id: 'resumen', label: 'Resumen', icon: 'inventory_2' },
          { id: 'ajuste', label: 'Ajuste / conteo', icon: 'tune' },
        ]}
      />

      {tab === 'resumen' && (
        <>
          {!loading && (
            <InventoryFilters
              ubicaciones={ubicaciones}
              ubicacionId={inv.ubicacionId}
              onUbicacionChange={inv.setUbicacionId}
              tipoFilter={inv.tipoFilter}
              onTipoChange={inv.setTipoFilter}
              categoriaFilter={inv.categoriaFilter}
              onCategoriaChange={inv.setCategoriaFilter}
              categorias={inv.categorias}
              search={inv.search}
              onSearchChange={inv.setSearch}
              soloAlertas={inv.soloAlertas}
              onSoloAlertasChange={inv.setSoloAlertas}
              hasActiveFilters={inv.hasActiveFilters}
              onClearFilters={inv.clearFilters}
              compact
            />
          )}
          {loading ? (
            <PageLoader />
          ) : (
            <InventoryPanorama
              data={inv}
              ubicaciones={ubicaciones}
              hideFilters
            />
          )}
        </>
      )}

      {tab === 'ajuste' && <InventoryAdjustPage embedded />}
    </div>
  );
};

export default InventoryPage;
