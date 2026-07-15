/**
 * Mapa id → página lazy. Fuente única junto a ALL_MODULES (registry).
 * Al agregar un módulo: registrelo en moduleRegistry + aquí.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { ALL_MODULES } from './moduleRegistry';

export type LazyPage = LazyExoticComponent<ComponentType<unknown>>;

export const MODULE_PAGES: Record<string, LazyPage> = {
  ver_stock: lazy(() => import('../pages/modules/InventoryPage')),
  ingreso_materiales: lazy(() => import('../pages/modules/PurchasesPage')),
  transferencias: lazy(() => import('../pages/modules/TransfersPage')),
  recetas: lazy(() => import('../pages/modules/RecipesPage')),
  produccion_granel: lazy(() => import('../pages/modules/BulkProductionPage')),
  produccion_envasado: lazy(() => import('../pages/modules/ProductionPage')),
  reempaque: lazy(() => import('../pages/modules/RepackPage')),
  ingresos: lazy(() => import('../pages/modules/IncomePage')),
  despacho: lazy(() => import('../pages/modules/DispatchPage')),
  gastos: lazy(() => import('../pages/modules/ExpensesPage')),
  modificaciones: lazy(() => import('../pages/modules/ModificacionesPage')),
  auditoria: lazy(() => import('../pages/modules/AuditPage')),
  descargas: lazy(() => import('../pages/modules/DownloadsPage')),
  materiales_skus: lazy(() => import('../pages/modules/MaterialsPage')),
  maestros: lazy(() => import('../pages/modules/MaestrosPage')),
  usuarios: lazy(() => import('../pages/modules/UsuariosPage')),
  reportes: lazy(() => import('../pages/modules/ReportingPage')),
  configuracion: lazy(() => import('../pages/modules/SettingsPage')),
};

/** Path relativo (sin `/` inicial) para <Route path=…>. */
export function moduleRoutePath(absolutePath: string): string {
  return absolutePath.replace(/^\//, '');
}

export function getRoutableModules() {
  const missing = ALL_MODULES.filter((m) => !MODULE_PAGES[m.id]);
  if (missing.length > 0 && import.meta.env.DEV) {
    console.warn(
      '[moduleRoutes] Falta página lazy para:',
      missing.map((m) => m.id).join(', '),
    );
  }
  return ALL_MODULES.filter((m) => MODULE_PAGES[m.id]);
}
