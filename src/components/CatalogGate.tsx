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
 */
export const CatalogGate: React.FC<CatalogGateProps> = ({
  ready,
  emptyIcon = 'inventory_2',
  emptyTitle,
  emptyHint,
  children,
}) => {
  const { loaded, loading } = useCatalog();

  if (!loaded || (loading && !ready)) {
    return <PageLoader />;
  }

  if (!ready) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />;
  }

  return <>{children}</>;
};
