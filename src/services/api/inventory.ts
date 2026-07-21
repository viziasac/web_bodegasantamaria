/**
 * Inventario, stock, lotes y movimientos.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { ErpRpc } from '../../config/erpContract';
import { friendlyDbError } from '../../utils/erpErrors';
import { sortLotesParaConsumo } from '../../utils/lotePolicy';
import { callRpc, normalizeStockRow, parseNum } from './core';
import type {
  InvMovimiento, InvStockSaldo, MovimientoFilters, StockResumenItem,
  MaItem, MaPresentacion,
} from '../../types';

export async function getResumenStockItems(tipo?: string): Promise<StockResumenItem[]> {
  try {
    const params: Record<string, unknown> = {};
    if (tipo) params.p_tipo = tipo;
    const { data, error } = await supabase.rpc(
      ErpRpc.resumenStockItems,
      Object.keys(params).length ? params : {},
    );
    if (error) throw error;
    return ((data as Record<string, unknown>[]) || []).map(normalizeStockRow);
  } catch {
    return getStockSaldoFallback(tipo);
  }
}

async function getStockSaldoFallback(tipo?: string): Promise<StockResumenItem[]> {
  const { data: rows } = await supabase
    .from(Tables.invStockSaldo)
    .select('item_id, cantidad')
    .gt('cantidad', 0);
  if (!rows?.length) return [];

  const byItem: Record<string, number> = {};
  rows.forEach((r: { item_id: string; cantidad: unknown }) => {
    byItem[r.item_id] = (byItem[r.item_id] || 0) + parseNum(r.cantidad);
  });

  let itemQ = supabase
    .from(Tables.maItem)
    .select('id, codigo, nombre, tipo, unidad_medida, stock_minimo, categoria')
    .in('id', Object.keys(byItem));
  if (tipo) itemQ = itemQ.eq('tipo', tipo);
  const { data: items } = await itemQ;
  return (items || []).map((m: MaItem) =>
    normalizeStockRow({
      ...m,
      item_id: m.id,
      stock_total: byItem[m.id] ?? 0,
    }),
  );
}

export async function getStockAgregadoPorUbicacion(ubicacionId: string): Promise<StockResumenItem[]> {
  const { data: rows, error } = await supabase
    .from(Tables.invStockSaldo)
    .select('item_id, cantidad')
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad', 0);
  if (error) throw error;
  if (!rows?.length) return [];

  const byItem: Record<string, number> = {};
  rows.forEach((r: { item_id: string; cantidad: unknown }) => {
    byItem[r.item_id] = (byItem[r.item_id] || 0) + parseNum(r.cantidad);
  });

  const { data: items, error: itemErr } = await supabase
    .from(Tables.maItem)
    .select('id, codigo, nombre, tipo, unidad_medida, stock_minimo, categoria')
    .in('id', Object.keys(byItem))
    .eq('activo', true);
  if (itemErr) throw itemErr;

  return (items || [])
    .map((m: MaItem) =>
      normalizeStockRow({ ...m, item_id: m.id, stock_total: byItem[m.id] ?? 0 }),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getPresentacionesConStock(ubicacionId: string) {
  const stockItems = await getStockAgregadoPorUbicacion(ubicacionId);
  const ptItems = stockItems.filter((i) => i.tipo === 'PT');
  if (!ptItems.length) return [];

  const { data: pres, error } = await supabase
    .from(Tables.maPresentacion)
    .select('id, codigo, nombre, item_id, cant_unidades, ma_item(id, codigo, nombre, categoria)')
    .eq('activo', true)
    .in('item_id', ptItems.map((i) => i.item_id));
  if (error) throw error;

  const stockMap = Object.fromEntries(ptItems.map((i) => [i.item_id, i.stock_total]));
  return (pres || []).map((p: MaPresentacion & { ma_item?: MaItem }) => ({
    presentacion_id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
    item_id: p.item_id,
    cant_unidades: parseNum(p.cant_unidades) || 1,
    stock_item: stockMap[p.item_id] ?? 0,
    stock_unidades: (stockMap[p.item_id] ?? 0) * (parseNum(p.cant_unidades) || 1),
    categoria: p.ma_item?.categoria,
    item_nombre: p.ma_item?.nombre,
  }));
}

export async function getStockSaldo(ubicacionId?: string): Promise<InvStockSaldo[]> {
  let q = supabase
    .from(Tables.invStockSaldo)
    .select(`
      *,
      cat_ubicacion:ubicacion_id(id, codigo, nombre),
      ma_item:item_id(id, codigo, nombre, tipo, unidad_medida, stock_minimo, categoria),
      inv_lote:lote_id(id, nro_lote, fecha_produccion, fecha_vencimiento)
    `)
    .gt('cantidad', 0)
    .order('cantidad', { ascending: false });
  if (ubicacionId) q = q.eq('ubicacion_id', ubicacionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((row: InvStockSaldo) => ({
    ...row,
    cantidad: parseNum(row.cantidad),
  }));
}

export async function getItemsBajoStockMinimo(): Promise<StockResumenItem[]> {
  try {
    const { data, error } = await supabase.rpc(ErpRpc.itemsBajoStockMinimo, {});
    if (error) throw error;
    return ((data as Record<string, unknown>[]) || []).map(normalizeStockRow);
  } catch {
    const resumen = await getResumenStockItems();
    return resumen.filter((r) => r.bajo_minimo);
  }
}

export async function getLotesDisponibles(opts: {
  ubicacionId: string;
  itemId?: string;
  presentacionId?: string;
}): Promise<Record<string, unknown>[]> {
  let itemId = opts.itemId;
  if (opts.presentacionId && !itemId) {
    const { data: pres } = await supabase
      .from(Tables.maPresentacion)
      .select('item_id')
      .eq('id', opts.presentacionId)
      .maybeSingle();
    itemId = pres?.item_id;
  }
  if (!itemId) return [];

  const { data: rows, error } = await supabase
    .from(Tables.invStockSaldo)
    .select(`
      cantidad, lote_id,
      inv_lote(id, nro_lote, estado, fecha_produccion, fecha_vencimiento)
    `)
    .eq('ubicacion_id', opts.ubicacionId)
    .eq('item_id', itemId)
    .gt('cantidad', 0);
  if (error) throw new Error(friendlyDbError(error));

  const lotes = (rows || [])
    .map((r: Record<string, unknown>) => {
      const lote = r.inv_lote as Record<string, unknown> | null;
      if (lote?.estado && lote.estado !== 'LIBERADO') return null;
      return {
        lote_id: r.lote_id,
        cantidad: parseNum(r.cantidad),
        nro_lote: lote?.nro_lote,
        fecha_produccion: lote?.fecha_produccion,
        fecha_vencimiento: lote?.fecha_vencimiento,
        estado: lote?.estado,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  return sortLotesParaConsumo(lotes);
}

export async function resolveLoteAllocationsFifo(opts: {
  ubicacionId: string;
  cantidad: number;
  itemId?: string;
  presentacionId?: string;
  productoLabel?: string;
}): Promise<{ loteId: string; cantidad: number }[]> {
  if (opts.cantidad <= 0) {
    throw new Error('Cantidad inválida para asignación de lotes');
  }
  const lotes = await getLotesDisponibles(opts);
  const label = opts.productoLabel;
  if (lotes.length === 0) {
    throw new Error(
      label ? `Sin lote disponible para ${label} en este punto de venta` : 'Sin lote disponible en este punto de venta',
    );
  }
  let restante = opts.cantidad;
  const result: { loteId: string; cantidad: number }[] = [];
  for (const l of lotes) {
    if (restante <= 0) break;
    const disp = (l.cantidad as number) || 0;
    if (disp <= 0) continue;
    const loteId = l.lote_id as string;
    if (!loteId) continue;
    const qty = Math.min(restante, disp);
    result.push({ loteId, cantidad: qty });
    restante -= qty;
  }
  if (restante > 0.0001) {
    const faltante = restante % 1 === 0 ? restante.toFixed(0) : restante.toFixed(2);
    throw new Error(
      label
        ? `Stock insuficiente para ${label} (faltan ${faltante} unidades)`
        : `Stock insuficiente en lotes (faltan ${faltante} unidades)`,
    );
  }
  return result;
}

export async function resolveItemId(opts: { itemId?: string; presentacionId?: string }): Promise<string | null> {
  if (opts.itemId) return opts.itemId;
  if (!opts.presentacionId) return null;
  const { data } = await supabase
    .from(Tables.maPresentacion)
    .select('item_id')
    .eq('id', opts.presentacionId)
    .maybeSingle();
  return data?.item_id ?? null;
}

export async function getMovimientos(filters?: MovimientoFilters): Promise<InvMovimiento[]> {
  let q = supabase
    .from(Tables.invMovimiento)
    .select(`
      *,
      cat_ubicacion(id, nombre, codigo),
      ma_item(id, nombre, codigo)
    `)
    .order('fecha', { ascending: false })
    .limit(filters?.limit || 100);
  if (filters?.tipo_mov) q = q.eq('tipo_mov', filters.tipo_mov);
  if (filters?.ubicacion_id) q = q.eq('ubicacion_id', filters.ubicacion_id);
  if (filters?.fecha_desde) q = q.gte('fecha', filters.fecha_desde);
  if (filters?.fecha_hasta) q = q.lte('fecha', filters.fecha_hasta);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getHistorialMovimientos(opts: {
  fechaDesde?: string;
  fechaHasta?: string;
  itemId?: string;
  ubicacionId?: string;
  direccion?: string;
}) {
  const params: Record<string, unknown> = {};
  if (opts.itemId) params.p_item_id = opts.itemId;
  if (opts.ubicacionId) params.p_ubicacion_id = opts.ubicacionId;
  if (opts.direccion) params.p_direccion = opts.direccion;
  if (opts.fechaDesde) params.p_desde = opts.fechaDesde;
  if (opts.fechaHasta) params.p_hasta = opts.fechaHasta;
  const { data, error } = await supabase.rpc(ErpRpc.historialMovimientos, params);
  if (error) throw error;
  return (data as Record<string, unknown>[]) || [];
}

export async function getTrazabilidadLote(nroLote: string) {
  const { data, error } = await supabase.rpc(ErpRpc.trazabilidadLote, { p_nro_lote: nroLote });
  if (error) throw error;
  return (data as Record<string, unknown>[]) || [];
}
