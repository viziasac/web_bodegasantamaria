import type { MaPresentacion, ProductoPv } from '../types';

export function etiquetaEmpaque(cantUnidades: number): string {
  if (cantUnidades <= 1) return 'botella';
  return `pack ×${cantUnidades} bot.`;
}

export function formatStockBotellas(stock: number, decimales = 0): string {
  if (decimales <= 0) return `${Math.round(stock)} bot.`;
  return `${stock.toFixed(decimales)} bot.`;
}

/** Dropdown catálogo (producción, venta). */
export function etiquetaPresentacionCatalogo(p: { nombre: string; cant_unidades?: number }): string {
  const cu = p.cant_unidades ?? 1;
  return `${p.nombre} · ${etiquetaEmpaque(cu)}`;
}

/** Fila de presentación con stock (venta / despacho). */
export function etiquetaPresentacionConStock(p: {
  nombre: string;
  cant_unidades?: number;
  stock_item: number;
}): string {
  const cu = p.cant_unidades ?? 1;
  let label = `${p.nombre} · ${etiquetaEmpaque(cu)}`;
  if (p.stock_item > 0) label += ` · ${formatStockBotellas(p.stock_item)} disp.`;
  return label;
}

export function categoriaDePresentacion(p: MaPresentacion): string {
  const c = p.ma_item?.categoria?.trim();
  if (c) return c;
  const n = p.nombre.trim();
  if (n) return n.split(/\s+/)[0];
  return 'Sin categoría';
}

export function categoriaDeProductoPv(p: ProductoPv): string {
  const c = p.categoria?.trim();
  if (c) return c;
  const n = p.nombre.trim();
  if (n) return n.split(/\s+/)[0];
  return 'Sin categoría';
}

export function categoriasProductosPv(productos: ProductoPv[]): string[] {
  const set = new Set(productos.map(categoriaDeProductoPv));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

export function filtrarProductosPv(productos: ProductoPv[], categoria?: string): ProductoPv[] {
  if (!categoria) return productos;
  return productos.filter((p) => categoriaDeProductoPv(p) === categoria);
}

export function categoriasDistintas(presentaciones: MaPresentacion[]): string[] {
  const set = new Set(presentaciones.map(categoriaDePresentacion));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

export function presentacionesParaProduccion(presentaciones: MaPresentacion[]): MaPresentacion[] {
  return presentaciones.filter((p) => p.ma_item?.tipo === 'PT' && p.activo !== false);
}

export function etiquetaOrdenPlan(orden: {
  cant_planificada: number;
  modo_cantidad?: string | null;
  ma_presentacion?: { nombre?: string; cant_unidades?: number } | null;
}): string {
  const botNum = orden.cant_planificada;
  const pres = orden.ma_presentacion;
  const modo = orden.modo_cantidad ?? 'BOTELLA';
  const cantUn = pres?.cant_unidades ?? 1;
  let line = `Plan: ${botNum} bot.`;
  if (pres?.nombre) line += ` · ${pres.nombre}`;
  if (modo === 'PACK' && cantUn > 1 && botNum % cantUn === 0) {
    line += ` (${botNum / cantUn} pack(s) × ${cantUn})`;
  }
  return line;
}
