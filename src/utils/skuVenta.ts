/** SKU de venta: un ítem PT con varias presentaciones (botella / pack). Alineado a Flutter SkuProduccion. */
import type { ProductoPv } from '../types';
import type { ModoCantidadEmpaque } from './cantidadEmpaque';
import { formatStockBotellas } from './presentacionLabels';

export interface SkuVenta {
  itemId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  stockItem: number;
  presentacionBotella: ProductoPv;
  presentacionPack?: ProductoPv;
  /** Factor del pack comercial (p.ej. 6). 1 si no hay pack. */
  factorPack: number;
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
    const sorted = [...list].sort((a, b) => (a.cant_unidades ?? 1) - (b.cant_unidades ?? 1));
    const botella = sorted.find((p) => (p.cant_unidades ?? 1) <= 1) ?? sorted[0];
    const packs = sorted.filter((p) => (p.cant_unidades ?? 1) > 1);
    const pack = packs.sort((a, b) => (a.cant_unidades ?? 0) - (b.cant_unidades ?? 0))[0];
    const factorPack = pack ? (pack.cant_unidades ?? 1) : 1;
    const stockItem = Math.max(...sorted.map((p) => p.stock_item || 0), botella.stock_item || 0);

    skus.push({
      itemId,
      codigo: botella.item_codigo?.trim() || '',
      nombre: nombreSku(botella, sorted),
      categoria: categoriaSku(botella),
      stockItem,
      presentacionBotella: botella,
      presentacionPack: pack,
      factorPack,
      presentaciones: sorted,
    });
  }

  skus.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return skus;
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

/** Presentación comercial según modo botella/pack (stock siempre en botellas del ítem). */
export function presentacionParaModo(sku: SkuVenta, modo: ModoCantidadEmpaque): ProductoPv {
  if (modo === 'pack' && sku.presentacionPack && sku.factorPack > 1) {
    return sku.presentacionPack;
  }
  return sku.presentacionBotella;
}

export function factorParaModo(sku: SkuVenta, modo: ModoCantidadEmpaque): number {
  if (modo === 'pack' && sku.factorPack > 1) return sku.factorPack;
  return 1;
}
