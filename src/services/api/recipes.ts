/**
 * Recetas (BOM) de productos terminados.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { friendlyDbError } from '../../utils/erpErrors';
import type { RecReceta } from '../../types';

export async function getRecetas(): Promise<RecReceta[]> {
  const { data, error } = await supabase
    .from(Tables.recReceta)
    .select(`
      id, item_producido_id, componente_id, cantidad, es_variable,
      item_producido:ma_item!rec_receta_item_producido_id_fkey(id, codigo, nombre, tipo, categoria),
      componente:ma_item!rec_receta_base_componente_id_fkey(id, codigo, nombre, tipo, unidad_medida)
    `);
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    item_componente_id: r.componente_id,
    ma_item_producido: r.item_producido,
    ma_item_componente: r.componente,
  })) as RecReceta[];
}

/** Cantidad siempre por 1 botella (contrato producción). */
export async function createRecetaLinea(opts: {
  itemProducidoId: string;
  componenteId: string;
  cantidad: number;
  esVariable?: boolean;
}): Promise<RecReceta> {
  if (!opts.itemProducidoId) throw new Error('Seleccione el producto terminado.');
  if (!opts.componenteId) throw new Error('Seleccione el componente.');
  if (!Number.isFinite(opts.cantidad) || opts.cantidad <= 0) {
    throw new Error('Cantidad debe ser > 0 (por 1 botella).');
  }
  const { data, error } = await supabase
    .from(Tables.recReceta)
    .insert({
      item_producido_id: opts.itemProducidoId,
      componente_id: opts.componenteId,
      cantidad: opts.cantidad,
      es_variable: opts.esVariable ?? false,
    })
    .select(`
      id, item_producido_id, componente_id, cantidad, es_variable,
      item_producido:ma_item!rec_receta_item_producido_id_fkey(id, codigo, nombre, tipo, categoria),
      componente:ma_item!rec_receta_base_componente_id_fkey(id, codigo, nombre, tipo, unidad_medida)
    `)
    .single();
  if (error) throw new Error(friendlyDbError(error));
  const r = data as Record<string, unknown>;
  return {
    ...(r as unknown as RecReceta),
    item_componente_id: String(r.componente_id),
    ma_item_producido: r.item_producido as RecReceta['ma_item_producido'],
    ma_item_componente: r.componente as RecReceta['ma_item_componente'],
  };
}

export async function updateRecetaLinea(opts: {
  id: string;
  cantidad?: number;
  esVariable?: boolean;
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (opts.cantidad != null) {
    if (!Number.isFinite(opts.cantidad) || opts.cantidad <= 0) {
      throw new Error('Cantidad debe ser > 0 (por 1 botella).');
    }
    patch.cantidad = opts.cantidad;
  }
  if (opts.esVariable != null) patch.es_variable = opts.esVariable;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from(Tables.recReceta).update(patch).eq('id', opts.id);
  if (error) throw new Error(friendlyDbError(error));
}

/** Solo líneas BOM — no elimina materiales ni SKUs. */
export async function deleteRecetaLinea(id: string): Promise<void> {
  const { error } = await supabase.from(Tables.recReceta).delete().eq('id', id);
  if (error) throw new Error(friendlyDbError(error));
}

/** Inserta varias líneas de BOM para un PT (cada cantidad = por 1 botella). */
export async function createRecetaLineas(
  itemProducidoId: string,
  lines: { componenteId: string; cantidad: number; esVariable?: boolean }[],
): Promise<RecReceta[]> {
  if (!itemProducidoId) throw new Error('Seleccione el producto terminado.');
  if (!lines.length) throw new Error('Agregue al menos un componente.');
  const ids = new Set<string>();
  const rows: {
    item_producido_id: string;
    componente_id: string;
    cantidad: number;
    es_variable: boolean;
  }[] = [];
  for (const line of lines) {
    if (!line.componenteId) throw new Error('Cada línea requiere un componente.');
    if (ids.has(line.componenteId)) {
      throw new Error('Hay componentes duplicados en el borrador.');
    }
    ids.add(line.componenteId);
    if (!Number.isFinite(line.cantidad) || line.cantidad <= 0) {
      throw new Error('Cantidad debe ser > 0 (por 1 botella).');
    }
    rows.push({
      item_producido_id: itemProducidoId,
      componente_id: line.componenteId,
      cantidad: line.cantidad,
      es_variable: line.esVariable ?? false,
    });
  }
  const { data, error } = await supabase
    .from(Tables.recReceta)
    .insert(rows)
    .select(`
      id, item_producido_id, componente_id, cantidad, es_variable,
      item_producido:ma_item!rec_receta_item_producido_id_fkey(id, codigo, nombre, tipo, categoria),
      componente:ma_item!rec_receta_base_componente_id_fkey(id, codigo, nombre, tipo, unidad_medida)
    `);
  if (error) throw new Error(friendlyDbError(error));
  return (data || []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as RecReceta),
    item_componente_id: String(r.componente_id),
    ma_item_producido: r.item_producido as RecReceta['ma_item_producido'],
    ma_item_componente: r.componente as RecReceta['ma_item_componente'],
  }));
}

/** Elimina todas las líneas BOM de un PT (no toca ma_item). */
export async function deleteRecetasDePt(itemProducidoId: string): Promise<void> {
  if (!itemProducidoId) throw new Error('PT inválido.');
  const { error } = await supabase
    .from(Tables.recReceta)
    .delete()
    .eq('item_producido_id', itemProducidoId);
  if (error) throw new Error(friendlyDbError(error));
}
