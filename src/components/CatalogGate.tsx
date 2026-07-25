import React from 'react';
import { useCatalog } from '../context/CatalogContext';
import { EmptyState, PageLoader } from './ui';

interface CatalogGateProps {
  /** true cuando el catálogo ya tiene lo necesario para el formulario */
  ready: boolean;
  emptyIcon?: string;
  emptyTitle: string;
  emptyHint?: string;
  children: React.ReactNode;
}

/**
 * Evita EmptyState falso mientras el catálogo aún carga.
 * Si el catálogo falla, muestra error + reintento (no spinner infinito).
 */
export const CatalogGate: React.FC<CatalogGateProps> = ({
  ready,
  emptyIcon = 'inventory_2',
  emptyTitle,
  emptyHint,
  children,
}) => {
  const { loaded, loading, error, refreshCatalog } = useCatalog();

  if (error && !loaded && !loading) {
    return (
      <EmptyState
        icon="cloud_off"
        title="No se pudo cargar el catálogo"
        hint={error}
        action={(
          <button type="button" className="btn btn-primary" onClick={() => { void refreshCatalog(); }}>
            Reintentar
          </button>
        )}
      />
    );
  }

  if (!loaded || (loading && !ready)) {
    return <PageLoader />;
  }

  if (!ready) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />;
  }

  return <>{children}</>;
};
