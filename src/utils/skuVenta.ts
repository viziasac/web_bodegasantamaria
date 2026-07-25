/** SKU de venta: un ítem PT con varias presentaciones (botella / packs ×N). Stock siempre en botellas. */
import type { MaPresentacion, ProductoPv } from '../types';
import type { ModoCantidadEmpaque } from './cantidadEmpaque';
import { formatStockBotellas } from './presentacionLabels';

export interface PackSku {
  presentacion: ProductoPv;
  factor: number;
}

export interface SkuVenta {
  itemId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  stockItem: number;
  presentacionBotella: ProductoPv;
  /** Pack comercial por defecto (menor factor > 1). */
  presentacionPack?: ProductoPv;
  /** Factor del pack por defecto. 1 si no hay pack. */
  factorPack: number;
  /** Todos los packs comerciales (×6, ×12, …) ordenados por factor. */
  packs: PackSku[];
  presentaciones: ProductoPv[];
}

function limpiarNombrePresentacion(nombre: string): string {
  let n = nombre.trim();
  const sep = n.indexOf(' · ');
  if (sep > 0) n = n.slice(0, sep).trim();
  return n;
}

function nombreSku(botella: ProductoPv, list: ProductoPv[]): string {
  const fromItem = botella.item_nombre?.trim();
  if (fromItem) return fromItem;
  const cleaned = limpiarNombrePresentacion(botella.nombre);
  if (cleaned) return cleaned;
  for (const p of list) {
    const c = limpiarNombrePresentacion(p.nombre);
    if (c) return c;
  }
  return botella.nombre;
}

function categoriaSku(p: ProductoPv): string {
  const c = p.categoria?.trim();
  if (c) return c;
  const n = nombreSku(p, [p]);
  return n.split(/\s+/)[0] || 'Sin categoría';
}

function buildSkuFromList(itemId: string, list: ProductoPv[]): SkuVenta {
  const sorted = [...list].sort((a, b) => (a.cant_unidades ?? 1) - (b.cant_unidades ?? 1));
  const botella = sorted.find((p) => (p.cant_unidades ?? 1) <= 1) ?? sorted[0];
  const packsRaw = sorted.filter((p) => (p.cant_unidades ?? 1) > 1);
  // Un factor único por tamaño (si hay duplicados, conserva el primero).
  const packs: PackSku[] = [];
  const seenFactors = new Set<number>();
  for (const p of packsRaw) {
    const factor = p.cant_unidades ?? 1;
    if (factor <= 1 || seenFactors.has(factor)) continue;
    seenFactors.add(factor);
    packs.push({ presentacion: p, factor });
  }
  packs.sort((a, b) => a.factor - b.factor);
  const packDefault = packs[0];
  const stockItem = Math.max(...sorted.map((p) => p.stock_item || 0), botella.stock_item || 0);

  return {
    itemId,
    codigo: botella.item_codigo?.trim() || '',
    nombre: nombreSku(botella, sorted),
    categoria: categoriaSku(botella),
    stockItem,
    presentacionBotella: botella,
    presentacionPack: packDefault?.presentacion,
    factorPack: packDefault?.factor ?? 1,
    packs,
    presentaciones: sorted,
  };
}

/** Agrupa presentaciones PT por item_id (1 fila = 1 SKU). */
export function skusDesdeProductosPv(productos: ProductoPv[]): SkuVenta[] {
  const byItem = new Map<string, ProductoPv[]>();
  for (const p of productos) {
    if (!p.item_id) continue;
    const list = byItem.get(p.item_id) ?? [];
    list.push(p);
    byItem.set(p.item_id, list);
  }

  const skus: SkuVenta[] = [];
  for (const [itemId, list] of byItem) {
    skus.push(buildSkuFromList(itemId, list));
  }

  skus.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return skus;
}

/** SKUs PT desde catálogo (transferencias / producción) + stock opcional por ítem. */
export function skusDesdeCatalogoPt(
  presentaciones: MaPresentacion[],
  stockByItem: Record<string, number> = {},
): SkuVenta[] {
  const asPv: ProductoPv[] = presentaciones
    .filter((p) => p.ma_item?.tipo === 'PT' && p.activo !== false)
    .map((p) => ({
      presentacion_id: p.id,
      item_id: p.item_id,
      nombre: p.nombre,
      cant_unidades: p.cant_unidades ?? 1,
      stock_item: stockByItem[p.item_id] ?? 0,
      categoria: p.ma_item?.categoria,
      item_nombre: p.ma_item?.nombre,
      item_codigo: p.ma_item?.codigo,
    }));
  return skusDesdeProductosPv(asPv);
}

export function categoriasSkus(skus: SkuVenta[]): string[] {
  return [...new Set(skus.map((s) => s.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
}

export function filtrarSkusPorCategoria(skus: SkuVenta[], categoria?: string): SkuVenta[] {
  if (!categoria) return skus;
  return skus.filter((s) => s.categoria === categoria);
}

export function etiquetaSkuConStock(sku: SkuVenta): string {
  const code = sku.codigo?.trim();
  const base = code && code !== sku.nombre ? `${code} · ${sku.nombre}` : sku.nombre;
  if (sku.stockItem > 0) return `${base} · ${formatStockBotellas(sku.stockItem)} disp.`;
  return `${base} · sin stock`;
}

export function factoresPackSku(sku: SkuVenta): number[] {
  return sku.packs.map((p) => p.factor);
}

/** Presentación comercial según modo + factor de pack seleccionado. */
export function presentacionParaFactor(sku: SkuVenta, modo: ModoCantidadEmpaque, factorPack: number): ProductoPv {
  if (modo === 'pack' && factorPack > 1) {
    const pack = sku.packs.find((p) => p.factor === factorPack);
    if (pack) return pack.presentacion;
    if (sku.presentacionPack) return sku.presentacionPack;
  }
  return sku.presentacionBotella;
}

/** @deprecated Prefer presentacionParaFactor con factor explícito. */
export function presentacionParaModo(sku: SkuVenta, modo: ModoCantidadEmpaque): ProductoPv {
  return presentacionParaFactor(sku, modo, sku.factorPack);
}

export function factorActivoSku(sku: SkuVenta, modo: ModoCantidadEmpaque, factorPackSel: number): number {
  if (modo === 'pack' && factorPackSel > 1) return factorPackSel;
  return 1;
}

/** @deprecated Prefer factorActivoSku. */
export function factorParaModo(sku: SkuVenta, modo: ModoCantidadEmpaque): number {
  if (modo === 'pack' && sku.factorPack > 1) return sku.factorPack;
  return 1;
}
