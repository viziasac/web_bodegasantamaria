import type { ModuleDef, UserRole } from '../types';

/** Secciones del menú (orden de flujo operativo). */
export type ModuleSection =
  | 'inventario'
  | 'produccion'
  | 'comercial'
  | 'consulta'
  | 'admin';

export const MODULE_SECTION_LABELS: Record<ModuleSection, string> = {
  inventario: 'Inventario',
  produccion: 'Producción',
  comercial: 'Comercial',
  consulta: 'Consulta',
  admin: 'Administración',
};

export const MODULE_SECTION_ORDER: ModuleSection[] = [
  'inventario',
  'produccion',
  'comercial',
  'consulta',
  'admin',
];

export interface ModuleDefExt extends ModuleDef {
  section: ModuleSection;
}

/**
 * Orden óptimo: stock → producción → ventas/gastos → consulta → admin.
 * Paths y permisos alineados a Flutter/RLS.
 */
export const ALL_MODULES: ModuleDefExt[] = [
  // Inventario
  { id: 'ver_stock', title: 'Inventario', icon: 'inventory_2', subtitle: 'Stock y ajustes de conteo', path: '/inventory', section: 'inventario' },
  { id: 'ingreso_materiales', title: 'Ingreso Insumos', icon: 'input', subtitle: 'Compras y entradas', path: '/purchases', section: 'inventario' },
  { id: 'transferencias', title: 'Transferencias', icon: 'swap_horiz', subtitle: 'Entre ubicaciones', path: '/transfers', section: 'inventario' },
  // Producción
  { id: 'recetas', title: 'Recetas', icon: 'menu_book', subtitle: 'Fórmulas por botella', path: '/recipes', section: 'produccion' },
  { id: 'produccion_granel', title: 'Granel', icon: 'wine_bar', subtitle: 'Entrada a ALM_GR', path: '/production/bulk', section: 'produccion' },
  { id: 'produccion_envasado', title: 'Producción', icon: 'precision_manufacturing', subtitle: 'Envasado botellas/packs', path: '/production', section: 'produccion' },
  { id: 'reempaque', title: 'Reempaque', icon: 'transform', subtitle: 'Cambio de formato', path: '/repack', section: 'produccion' },
  // Comercial
  { id: 'ingresos', title: 'Ingresos', icon: 'attach_money', subtitle: 'Ventas POS multi-línea', path: '/sales/income', section: 'comercial' },
  { id: 'despacho', title: 'Despacho', icon: 'local_shipping', subtitle: 'Venta rápida una línea', path: '/sales/dispatch', section: 'comercial' },
  { id: 'gastos', title: 'Egresos', icon: 'money_off', subtitle: 'Gastos operativos', path: '/expenses', section: 'comercial' },
  { id: 'modificaciones', title: 'Modificaciones', icon: 'edit_note', subtitle: 'Corregir ventas y gastos', path: '/sales/modificaciones', section: 'comercial' },
  // Consulta
  { id: 'auditoria', title: 'Auditoría', icon: 'fact_check', subtitle: 'Historial y trazabilidad', path: '/audit', section: 'consulta' },
  { id: 'descargas', title: 'Descargas', icon: 'download', subtitle: 'Exportar Excel por mes', path: '/downloads', section: 'consulta' },
  // Admin
  { id: 'materiales_skus', title: 'Materiales / SKUs', icon: 'category', subtitle: 'Catálogo maestro', path: '/materials', section: 'admin', adminOnly: true },
  { id: 'maestros', title: 'Maestros', icon: 'folder_shared', subtitle: 'Proveedores, clientes, canales…', path: '/maestros', section: 'admin', adminOnly: true },
  { id: 'reportes', title: 'Reportes', icon: 'analytics', subtitle: 'Resumen operativo', path: '/reporting', section: 'admin', adminOnly: true },
  { id: 'configuracion', title: 'Configuración', icon: 'settings', subtitle: 'Cuenta y sesión', path: '/settings', section: 'admin' },
];

/** Módulos de ventas: requieren acceso_ventas (alineado Flutter + RLS). */
export const VENTAS_MODULE_IDS = new Set(['ingresos', 'gastos', 'despacho', 'modificaciones']);

const ADMIN_ROLES: UserRole[] = ['admin', 'administrador'];

export function isAdminRole(role?: string): boolean {
  return ADMIN_ROLES.includes((role ?? 'operario') as UserRole);
}

export function getModulesForRole(role?: string, opts?: { accesoVentas?: boolean }): ModuleDefExt[] {
  const accesoVentas = opts?.accesoVentas !== false;
  let list = isAdminRole(role) ? ALL_MODULES : ALL_MODULES.filter((m) => !m.adminOnly);
  if (!accesoVentas) {
    list = list.filter((m) => !VENTAS_MODULE_IDS.has(m.id));
  }
  return list;
}

export function getModulesGrouped(
  role?: string,
  opts?: { accesoVentas?: boolean },
): { section: ModuleSection; label: string; modules: ModuleDefExt[] }[] {
  const modules = getModulesForRole(role, opts);
  return MODULE_SECTION_ORDER
    .map((section) => ({
      section,
      label: MODULE_SECTION_LABELS[section],
      modules: modules.filter((m) => m.section === section),
    }))
    .filter((g) => g.modules.length > 0);
}

export function getModuleByPath(path: string): ModuleDefExt | undefined {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
  return ALL_MODULES.find((m) => m.path === normalized);
}

export function getModuleById(id: string): ModuleDefExt | undefined {
  return ALL_MODULES.find((m) => m.id === id);
}

export function canAccessModule(
  role: string | undefined,
  module: ModuleDef,
  opts?: { accesoVentas?: boolean },
): boolean {
  if (module.adminOnly && !isAdminRole(role)) return false;
  if (VENTAS_MODULE_IDS.has(module.id) && opts?.accesoVentas === false) return false;
  return true;
}
