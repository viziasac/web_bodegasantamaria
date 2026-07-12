import type { ModuleDef, UserRole } from '../types';

export const ALL_MODULES: ModuleDef[] = [
  { id: 'ingreso_materiales', title: 'Ingreso Insumos', icon: 'input', subtitle: 'Entradas y compras', path: '/purchases' },
  { id: 'produccion_envasado', title: 'Producción', icon: 'precision_manufacturing', subtitle: 'Envasado — botellas o packs', path: '/production' },
  { id: 'produccion_granel', title: 'Granel', icon: 'wine_bar', subtitle: 'Producción a granel', path: '/production/bulk' },
  { id: 'reempaque', title: 'Reempaque', icon: 'transform', subtitle: 'Cambio de formato', path: '/repack' },
  { id: 'ver_stock', title: 'Inventario', icon: 'inventory_2', subtitle: 'Stock y ajustes de conteo', path: '/inventory' },
  { id: 'despacho', title: 'Despacho', icon: 'local_shipping', subtitle: 'Venta rápida — una línea', path: '/sales/dispatch' },
  { id: 'recetas', title: 'Recetas', icon: 'menu_book', subtitle: 'Fórmulas por botella', path: '/recipes' },
  { id: 'auditoria', title: 'Auditoría', icon: 'fact_check', subtitle: 'Historial y trazabilidad', path: '/audit' },
  { id: 'gastos', title: 'Egresos', icon: 'money_off', subtitle: 'Gastos operativos', path: '/expenses' },
  { id: 'ingresos', title: 'Ingresos', icon: 'attach_money', subtitle: 'Ventas POS — carrito multi-línea', path: '/sales/income' },
  { id: 'transferencias', title: 'Transferencias', icon: 'swap_horiz', subtitle: 'Entre ubicaciones', path: '/transfers' },
  { id: 'descargas', title: 'Descargas', icon: 'download', subtitle: 'Exportar a Excel por mes', path: '/downloads' },
  { id: 'materiales_skus', title: 'Materiales / SKUs', icon: 'category', subtitle: 'Catálogo maestro', path: '/materials', adminOnly: true },
  { id: 'reportes', title: 'Reportes', icon: 'analytics', subtitle: 'Resumen operativo', path: '/reporting', adminOnly: true },
  { id: 'configuracion', title: 'Configuración', icon: 'settings', subtitle: 'Cuenta y sesión', path: '/settings' },
];

/** Módulos de ventas: requieren acceso_ventas (alineado Flutter + RLS). */
export const VENTAS_MODULE_IDS = new Set(['ingresos', 'gastos', 'despacho']);

const ADMIN_ROLES: UserRole[] = ['admin', 'administrador'];

export function isAdminRole(role?: string): boolean {
  return ADMIN_ROLES.includes((role ?? 'operario') as UserRole);
}

export interface ModuleAccessOpts {
  role?: string;
  accesoVentas?: boolean;
}

export function getModulesForRole(role?: string, opts?: { accesoVentas?: boolean }): ModuleDef[] {
  const accesoVentas = opts?.accesoVentas !== false;
  let list = isAdminRole(role) ? ALL_MODULES : ALL_MODULES.filter((m) => !m.adminOnly);
  if (!accesoVentas) {
    list = list.filter((m) => !VENTAS_MODULE_IDS.has(m.id));
  }
  return list;
}

export function getModuleByPath(path: string): ModuleDef | undefined {
  return ALL_MODULES.find((m) => m.path === path);
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
