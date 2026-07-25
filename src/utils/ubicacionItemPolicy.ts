/**
 * Política almacén ↔ tipo de ítem.
 * Stock físico se registra solo en la ubicación correcta:
 * - ALM_GR  → GRANEL
 * - ALM_MP  → INSUMO, EMPAQUE, MATERIAL
 * - ALM_PT / PV → PT
 */
import type { CatUbicacion } from '../types';

export type TipoItemCatalogo = 'PT' | 'GRANEL' | 'INSUMO' | 'EMPAQUE' | 'MATERIAL';

export const TIPOS_MP: TipoItemCatalogo[] = ['INSUMO', 'EMPAQUE', 'MATERIAL'];
export const TIPOS_GR: TipoItemCatalogo[] = ['GRANEL'];
export const TIPOS_PT: TipoItemCatalogo[] = ['PT'];

export function normalizarTipoItem(tipo: string | null | undefined): string {
  return (tipo || '').trim().toUpperCase();
}

export function isPuntoVenta(u: Pick<CatUbicacion, 'codigo' | 'es_punto_venta'> | null | undefined): boolean {
  if (!u) return false;
  if (u.es_punto_venta) return true;
  return (u.codigo || '').toUpperCase().startsWith('PV_');
}

export function isTransito(u: Pick<CatUbicacion, 'codigo'> | null | undefined): boolean {
  return (u?.codigo || '').toUpperCase() === 'TRANSIT';
}

/** Tipos de ítem permitidos en una ubicación (vacío = no admite movimientos manuales). */
export function tiposPermitidosParaUbicacion(
  u: Pick<CatUbicacion, 'codigo' | 'es_punto_venta'> | null | undefined,
): TipoItemCatalogo[] {
  if (!u || isTransito(u)) return [];
  const code = (u.codigo || '').toUpperCase();
  if (code === 'ALM_GR') return [...TIPOS_GR];
  if (code === 'ALM_MP') return [...TIPOS_MP];
  if (code === 'ALM_PT' || isPuntoVenta(u)) return [...TIPOS_PT];
  return [];
}

export function itemTipoPermitidoEnUbicacion(
  tipoItem: string | null | undefined,
  u: Pick<CatUbicacion, 'codigo' | 'es_punto_venta'> | null | undefined,
): boolean {
  const tipo = normalizarTipoItem(tipoItem) as TipoItemCatalogo;
  const allowed = tiposPermitidosParaUbicacion(u);
  return allowed.includes(tipo);
}

/** Ubicaciones válidas para ingreso de compras / insumos (no PT, no PV, no tránsito). */
export function ubicacionesParaIngresoInsumos(ubicaciones: CatUbicacion[]): CatUbicacion[] {
  return ubicaciones.filter((u) => {
    if (u.activo === false || isTransito(u) || isPuntoVenta(u)) return false;
    const code = (u.codigo || '').toUpperCase();
    return code === 'ALM_MP' || code === 'ALM_GR';
  });
}

/** Ubicaciones válidas para ajuste de conteo (almacenes + PV; sin tránsito). */
export function ubicacionesParaAjuste(ubicaciones: CatUbicacion[]): CatUbicacion[] {
  return ubicaciones
    .filter((u) => u.activo !== false && !isTransito(u) && tiposPermitidosParaUbicacion(u).length > 0)
    .sort((a, b) => labelUbicacionOrden(a) - labelUbicacionOrden(b)
      || a.codigo.localeCompare(b.codigo, 'es'));
}

function labelUbicacionOrden(u: CatUbicacion): number {
  const c = (u.codigo || '').toUpperCase();
  if (c === 'ALM_MP') return 1;
  if (c === 'ALM_GR') return 2;
  if (c === 'ALM_PT') return 3;
  if (isPuntoVenta(u)) return 4;
  return 9;
}

/** Destino de producción envasado: solo ALM_PT. */
export function ubicacionesParaProduccionPt(ubicaciones: CatUbicacion[]): CatUbicacion[] {
  return ubicaciones.filter((u) => u.activo !== false && (u.codigo || '').toUpperCase() === 'ALM_PT');
}

export function etiquetaFamiliaUbicacion(
  u: Pick<CatUbicacion, 'codigo' | 'es_punto_venta' | 'nombre'> | null | undefined,
): string {
  if (!u) return '';
  const code = (u.codigo || '').toUpperCase();
  if (code === 'ALM_GR') return 'Solo granel (litros)';
  if (code === 'ALM_MP') return 'Solo material, insumo y empaque';
  if (code === 'ALM_PT') return 'Solo producto terminado (botellas)';
  if (isPuntoVenta(u)) return 'Solo producto terminado (botellas)';
  return u.nombre;
}

export function resumenTiposPermitidos(tipos: TipoItemCatalogo[]): string {
  if (!tipos.length) return 'ninguno';
  const labels: Record<TipoItemCatalogo, string> = {
    PT: 'Producto terminado',
    GRANEL: 'Granel',
    INSUMO: 'Insumo',
    EMPAQUE: 'Empaque',
    MATERIAL: 'Material',
  };
  return tipos.map((t) => labels[t] ?? t).join(', ');
}

export function opcionesTipoParaUbicacion(
  u: Pick<CatUbicacion, 'codigo' | 'es_punto_venta'> | null | undefined,
): { value: string; label: string }[] {
  const allowed = tiposPermitidosParaUbicacion(u);
  const labels: Record<string, string> = {
    PT: 'Producto terminado (SKU)',
    GRANEL: 'Granel',
    INSUMO: 'Insumo',
    EMPAQUE: 'Empaque',
    MATERIAL: 'Material',
  };
  const opts = [{ value: '', label: allowed.length > 1 ? 'Todos los tipos de este almacén' : 'Tipo de este almacén' }];
  for (const t of allowed) {
    opts.push({ value: t, label: labels[t] ?? t });
  }
  return opts;
}

/** Tipos de ítem comprables según almacén de destino. */
export function tiposParaIngresoEnUbicacion(
  u: Pick<CatUbicacion, 'codigo' | 'es_punto_venta'> | null | undefined,
): TipoItemCatalogo[] {
  const code = (u?.codigo || '').toUpperCase();
  if (code === 'ALM_GR') return [...TIPOS_GR];
  if (code === 'ALM_MP') return [...TIPOS_MP];
  return [];
}

export function mensajeErrorTipoUbicacion(
  tipoItem: string,
  u: Pick<CatUbicacion, 'codigo' | 'nombre'> | null | undefined,
): string {
  const code = u?.codigo ?? 'ubicación';
  const allowed = resumenTiposPermitidos(tiposPermitidosParaUbicacion(u as CatUbicacion));
  return `El tipo ${normalizarTipoItem(tipoItem)} no corresponde a ${code}. Allí solo: ${allowed}.`;
}
