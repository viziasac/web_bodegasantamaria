/**
 * Acceso a Supabase — port de api_provider.dart (modelo Jul 2026)
 */
import { supabase } from './supabaseClient';
import { Tables } from '../config/supabaseTables';
import { ErpRpc, type RpcResult } from '../config/erpContract';
import { ENTRADA_TIPOS, SALIDA_TIPOS } from '../config/backendEnums';
import { messageFromRpc, friendlyDbError } from '../utils/erpErrors';
import { sortLotesParaConsumo } from '../utils/lotePolicy';
import { newTxnId } from '../utils/txnId';
import { diasEnRango } from '../utils/periodoMes';
import { hoyYmd, inicioMesYmd, ymdInZone } from '../utils/fechaLocal';
import type {
  CatUbicacion, MaItem, MaPresentacion, MaEmpaqueTipo, MaProveedor, MaCliente,
  InvMovimiento, InvStockSaldo, PrdOrden, RecReceta, GasCategoria, GasGasto,
  TrnTransferencia, InsumoValidacionOrden, DashboardKPIs, MovimientoFilters,
  VentaLinea, CompraLinea, TransferLinea,
  StockResumenItem, VentaResumen, InventarioFila, AlmacenResumenInv,
  MovimientoTrendDia, DashboardEjecutivoData, AjusteTopItem, AjustePorUbicacion,
  VentaDetalleLinea, AppUserRoleRow,
} from '../types';

/** Supabase devuelve numeric como string en muchos campos */
export function parseNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeStockRow(r: Record<string, unknown>): StockResumenItem {
  const stock = parseNum(r.stock_total ?? r.cantidad ?? r.cantidad_actual);
  const min = parseNum(r.stock_minimo);
  return {
    item_id: String(r.item_id ?? ''),
    codigo: String(r.codigo ?? ''),
    nombre: String(r.nombre ?? ''),
    tipo: String(r.tipo ?? ''),
    categoria: r.categoria as string | null | undefined,
    unidad_medida: String(r.unidad_medida ?? 'unid'),
    stock_minimo: min,
    stock_total: stock,
    bajo_minimo: r.bajo_minimo === true || (min > 0 && stock < min),
  };
}

async function getUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

function parseRpcResult(res: unknown): RpcResult {
  if (res && typeof res === 'object' && !Array.isArray(res)) {
    return res as RpcResult;
  }
  return { ok: true, data: res };
}

export async function callRpc<T = unknown>(
  fn: string,
  params: Record<string, unknown>,
  fallback = 'Operación fallida',
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(friendlyDbError(error));
  const result = parseRpcResult(data);
  if (result.ok === false) {
    throw new Error(messageFromRpc(result) || fallback);
  }
  return (result.data ?? data) as T;
}

export { hoyYmd, inicioMesYmd } from '../utils/fechaLocal';

// ─── Catálogos ───

export async function getUbicaciones(opts?: { soloPuntoVenta?: boolean }): Promise<CatUbicacion[]> {
  let q = supabase
    .from(Tables.catUbicacion)
    .select('id, codigo, nombre, tipo, es_punto_venta, activo')
    .eq('activo', true)
    .order('nombre');
  if (opts?.soloPuntoVenta) q = q.eq('es_punto_venta', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getCanalesVenta() {
  const { data, error } = await supabase.from(Tables.catCanalVenta).select('*').order('nombre');
  if (error) throw error;
  return data || [];
}

export async function getItems(opts?: { tipo?: string; includeInactive?: boolean }): Promise<MaItem[]> {
  let q = supabase.from(Tables.maItem).select('*').order('nombre');
  if (!opts?.includeInactive) q = q.eq('activo', true);
  if (opts?.tipo) q = q.eq('tipo', opts.tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getInsumos(): Promise<MaItem[]> {
  const items = await getItems();
  return items.filter((i) => {
    const t = (i.tipo ?? '').trim().toUpperCase();
    return t.length > 0 && t !== 'PT';
  });
}

export async function getItemsGranel(): Promise<MaItem[]> {
  return getItems({ tipo: 'GRANEL' });
}

export async function getItemsPt(): Promise<MaItem[]> {
  return getItems({ tipo: 'PT' });
}

export async function getPresentaciones(itemId?: string, opts?: { includeInactive?: boolean }): Promise<MaPresentacion[]> {
  let q = supabase
    .from(Tables.maPresentacion)
    .select('*, ma_item(id, codigo, nombre, tipo, unidad_medida, categoria), ma_empaque_tipo:empaque_id(id, nombre, factor)')
    .order('nombre');
  if (!opts?.includeInactive) q = q.eq('activo', true);
  if (itemId) q = q.eq('item_id', itemId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((p: Record<string, unknown>) => ({
    ...p,
    ma_empaque_tipo: p.ma_empaque_tipo as MaEmpaqueTipo | undefined,
  })) as MaPresentacion[];
}

export async function getEmpaqueTipos(): Promise<MaEmpaqueTipo[]> {
  const { data, error } = await supabase
    .from(Tables.maEmpaqueTipo)
    .select('id, nombre, factor, activo')
    .eq('activo', true)
    .order('factor');
  if (error) throw error;
  return (data || []).map((e) => ({
    id: String(e.id),
    nombre: String(e.nombre),
    factor: parseNum(e.factor) || 1,
    activo: e.activo !== false,
  }));
}

export async function createItem(opts: {
  codigo: string;
  nombre: string;
  tipo: string;
  unidad_medida: string;
  categoria?: string;
  stock_minimo?: number;
  granel_base_id?: string;
  pct_merma?: number;
}): Promise<MaItem> {
  const codigo = opts.codigo.trim().toUpperCase();
  if (!codigo || codigo.length > 6) throw new Error('Código de ítem: máximo 6 caracteres.');
  if (!opts.nombre.trim()) throw new Error('Nombre obligatorio.');
  if (!opts.tipo) throw new Error('Tipo obligatorio.');
  if (!opts.unidad_medida.trim()) throw new Error('Unidad de medida obligatoria.');

  const payload: Record<string, unknown> = {
    codigo,
    nombre: opts.nombre.trim(),
    tipo: opts.tipo,
    unidad_medida: opts.unidad_medida.trim(),
    activo: true,
    stock_minimo: opts.stock_minimo ?? 0,
    pct_merma: opts.pct_merma ?? 0,
  };
  if (opts.categoria?.trim()) payload.categoria = opts.categoria.trim();
  if (opts.tipo === 'PT' && opts.granel_base_id) payload.granel_base_id = opts.granel_base_id;

  const { data, error } = await supabase
    .from(Tables.maItem)
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaItem;
}

export async function updateItem(opts: {
  id: string;
  nombre?: string;
  categoria?: string | null;
  stock_minimo?: number;
  unidad_medida?: string;
  activo?: boolean;
  granel_base_id?: string | null;
  pct_merma?: number;
}): Promise<MaItem> {
  const patch: Record<string, unknown> = {};
  if (opts.nombre != null) patch.nombre = opts.nombre.trim();
  if (opts.categoria !== undefined) patch.categoria = opts.categoria?.trim() || null;
  if (opts.stock_minimo != null) patch.stock_minimo = opts.stock_minimo;
  if (opts.unidad_medida != null) patch.unidad_medida = opts.unidad_medida.trim();
  if (opts.activo != null) patch.activo = opts.activo;
  if (opts.granel_base_id !== undefined) patch.granel_base_id = opts.granel_base_id;
  if (opts.pct_merma != null) patch.pct_merma = opts.pct_merma;
  if (Object.keys(patch).length === 0) throw new Error('Sin cambios.');

  const { data, error } = await supabase
    .from(Tables.maItem)
    .update(patch)
    .eq('id', opts.id)
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaItem;
}

export async function createPresentacion(opts: {
  codigo: string;
  nombre: string;
  itemId: string;
  empaqueId: string;
  cantUnidades?: number;
}): Promise<MaPresentacion> {
  const codigo = opts.codigo.trim().toUpperCase();
  if (!codigo || codigo.length > 5) throw new Error('Código SKU: máximo 5 caracteres.');
  if (!opts.nombre.trim()) throw new Error('Nombre obligatorio.');
  if (!opts.itemId) throw new Error('Seleccione el ítem PT.');
  if (!opts.empaqueId) throw new Error('Seleccione tipo de empaque.');

  const empaques = await getEmpaqueTipos();
  const emp = empaques.find((e) => e.id === opts.empaqueId);
  if (!emp) throw new Error('Empaque no encontrado.');
  const cant = opts.cantUnidades ?? emp.factor;
  if (cant !== emp.factor) {
    throw new Error(`cant_unidades debe coincidir con el factor del empaque (${emp.factor}).`);
  }

  const { data, error } = await supabase
    .from(Tables.maPresentacion)
    .insert({
      codigo,
      nombre: opts.nombre.trim(),
      item_id: opts.itemId,
      empaque_id: opts.empaqueId,
      cant_unidades: cant,
      activo: true,
    })
    .select('*, ma_item(id, codigo, nombre, tipo), ma_empaque_tipo:empaque_id(id, nombre, factor)')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaPresentacion;
}

export async function updatePresentacion(opts: {
  id: string;
  nombre?: string;
  activo?: boolean;
}): Promise<MaPresentacion> {
  const patch: Record<string, unknown> = {};
  if (opts.nombre != null) patch.nombre = opts.nombre.trim();
  if (opts.activo != null) patch.activo = opts.activo;
  if (Object.keys(patch).length === 0) throw new Error('Sin cambios.');

  const { data, error } = await supabase
    .from(Tables.maPresentacion)
    .update(patch)
    .eq('id', opts.id)
    .select('*, ma_item(id, codigo, nombre, tipo), ma_empaque_tipo:empaque_id(id, nombre, factor)')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaPresentacion;
}

export async function getProveedores(): Promise<MaProveedor[]> {
  const { data, error } = await supabase.from(Tables.maProveedor).select('*').eq('activo', true).order('nombre');
  if (error) throw error;
  return data || [];
}

export async function getClientes(): Promise<MaCliente[]> {
  const { data, error } = await supabase.from(Tables.maCliente).select('*').eq('activo', true).order('nombre');
  if (error) throw error;
  return data || [];
}

export async function getCategoriasGasto(): Promise<GasCategoria[]> {
  const { data, error } = await supabase.from(Tables.gasCategoria).select('*').eq('activo', true).order('nombre');
  if (error) throw error;
  return data || [];
}

// ─── Maestros admin (CRUD directo; sin DELETE físico — soft via activo) ───

export async function upsertProveedor(opts: {
  id?: string;
  nombre: string;
  ruc?: string;
  activo?: boolean;
}): Promise<MaProveedor> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de proveedor obligatorio.');
  const payload: Record<string, unknown> = {
    nombre,
    ruc: opts.ruc?.trim() || null,
    activo: opts.activo ?? true,
  };
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.maProveedor).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as MaProveedor;
  }
  const { data, error } = await supabase.from(Tables.maProveedor).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaProveedor;
}

export async function upsertCliente(opts: {
  id?: string;
  nombre: string;
  tipo?: string;
  activo?: boolean;
}): Promise<MaCliente> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de cliente obligatorio.');
  const payload: Record<string, unknown> = {
    nombre,
    tipo: opts.tipo?.trim() || null,
    activo: opts.activo ?? true,
  };
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.maCliente).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as MaCliente;
  }
  const { data, error } = await supabase.from(Tables.maCliente).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaCliente;
}

export async function upsertCanalVenta(opts: {
  codigo?: string;
  nombre: string;
  /** Update by existing codigo */
  codigoOriginal?: string;
}): Promise<{ codigo: string; nombre: string }> {
  const nombre = opts.nombre.trim();
  const codigo = (opts.codigo ?? opts.codigoOriginal ?? '').trim().toUpperCase();
  if (!nombre) throw new Error('Nombre de canal obligatorio.');
  if (!codigo) throw new Error('Código de canal obligatorio.');
  if (opts.codigoOriginal) {
    const { data, error } = await supabase
      .from(Tables.catCanalVenta)
      .update({ nombre })
      .eq('codigo', opts.codigoOriginal)
      .select('*')
      .single();
    if (error) throw new Error(friendlyDbError(error));
    return data as { codigo: string; nombre: string };
  }
  const { data, error } = await supabase
    .from(Tables.catCanalVenta)
    .insert({ codigo, nombre })
    .select('*')
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data as { codigo: string; nombre: string };
}

export async function upsertEmpaqueTipo(opts: {
  id?: string;
  nombre: string;
  factor: number;
  activo?: boolean;
}): Promise<MaEmpaqueTipo> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de empaque obligatorio.');
  if (!Number.isFinite(opts.factor) || opts.factor < 1) throw new Error('Factor debe ser ≥ 1.');
  const payload: Record<string, unknown> = {
    nombre,
    factor: Math.round(opts.factor),
    activo: opts.activo ?? true,
  };
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.maEmpaqueTipo).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as MaEmpaqueTipo;
  }
  const { data, error } = await supabase.from(Tables.maEmpaqueTipo).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as MaEmpaqueTipo;
}

export async function upsertCategoriaGasto(opts: {
  id?: string;
  nombre: string;
  centro_costo?: string;
  activo?: boolean;
}): Promise<GasCategoria> {
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error('Nombre de categoría obligatorio.');
  const payload: Record<string, unknown> = {
    nombre,
    centro_costo: opts.centro_costo?.trim() || null,
    activo: opts.activo ?? true,
  };
  if (opts.id) {
    const { data, error } = await supabase.from(Tables.gasCategoria).update(payload).eq('id', opts.id).select('*').single();
    if (error) throw new Error(friendlyDbError(error));
    return data as GasCategoria;
  }
  const { data, error } = await supabase.from(Tables.gasCategoria).insert(payload).select('*').single();
  if (error) throw new Error(friendlyDbError(error));
  return data as GasCategoria;
}

export async function listMaestrosAdmin() {
  const [proveedores, clientes, canales, empaques, categorias] = await Promise.all([
    supabase.from(Tables.maProveedor).select('*').order('nombre'),
    supabase.from(Tables.maCliente).select('*').order('nombre'),
    supabase.from(Tables.catCanalVenta).select('*').order('nombre'),
    supabase.from(Tables.maEmpaqueTipo).select('*').order('factor'),
    supabase.from(Tables.gasCategoria).select('*').order('nombre'),
  ]);
  for (const r of [proveedores, clientes, canales, empaques, categorias]) {
    if (r.error) throw new Error(friendlyDbError(r.error));
  }
  return {
    proveedores: (proveedores.data || []) as MaProveedor[],
    clientes: (clientes.data || []) as MaCliente[],
    canales: (canales.data || []) as { codigo: string; nombre: string }[],
    empaques: (empaques.data || []) as MaEmpaqueTipo[],
    categorias: (categorias.data || []) as GasCategoria[],
  };
}

export async function getPrecioReferencia(presentacionId: string, segmento = 'GENERAL'): Promise<number | null> {
  const { data } = await supabase
    .from(Tables.venPrecioRef)
    .select('precio_minimo')
    .eq('presentacion_id', presentacionId)
    .eq('segmento', segmento)
    .eq('activo', true)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.precio_minimo != null ? Number(data.precio_minimo) : null;
}

// ─── Inventario ───

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

async function resolveItemId(opts: { itemId?: string; presentacionId?: string }): Promise<string | null> {
  if (opts.itemId) return opts.itemId;
  if (!opts.presentacionId) return null;
  const { data } = await supabase
    .from(Tables.maPresentacion)
    .select('item_id')
    .eq('id', opts.presentacionId)
    .maybeSingle();
  return data?.item_id ?? null;
}

// ─── Movimientos ───

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

// ─── Recetas ───

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

// ─── Producción ───

export async function getOrdenes(estado?: string): Promise<PrdOrden[]> {
  let q = supabase
    .from(Tables.prdOrden)
    .select(`
      *,
      ma_item:item_producido_id(id, codigo, nombre, tipo),
      ma_presentacion:presentacion_id(id, codigo, nombre, cant_unidades, item_id)
    `)
    .order('fecha_inicio', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function resolveItemPtId(presentacionOrPtId: string): Promise<string> {
  const { data: pres } = await supabase
    .from(Tables.maPresentacion)
    .select('item_id')
    .eq('id', presentacionOrPtId)
    .maybeSingle();
  if (pres?.item_id) return String(pres.item_id);
  const { data: item } = await supabase
    .from(Tables.maItem)
    .select('id, tipo')
    .eq('id', presentacionOrPtId)
    .maybeSingle();
  if (item?.tipo === 'PT') return String(item.id);
  return presentacionOrPtId;
}

async function stockPorItemEnUbicacion(ubicacionId: string | undefined): Promise<Record<string, number>> {
  if (!ubicacionId) return {};
  const { data: stockRows, error: stockErr } = await supabase
    .from(Tables.invStockSaldo)
    .select('item_id, cantidad')
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad', 0);
  if (stockErr) throw stockErr;
  const stockPorItem: Record<string, number> = {};
  for (const r of stockRows ?? []) {
    const id = String(r.item_id);
    stockPorItem[id] = (stockPorItem[id] ?? 0) + parseNum(r.cantidad);
  }
  return stockPorItem;
}

/** Preview alineado con fn_validar_insumos_orden: GRANEL en ALM_GR; resto en ALM_MP. */
export async function validarInsumosPreview(opts: {
  itemProducidoId: string;
  cantPlanificada: number;
}): Promise<InsumoValidacionOrden[]> {
  const ptId = await resolveItemPtId(opts.itemProducidoId);
  const { data: ubiRows } = await supabase
    .from(Tables.catUbicacion)
    .select('id, codigo')
    .in('codigo', ['ALM_MP', 'ALM_GR']);
  const almMpId = (ubiRows ?? []).find((u) => u.codigo === 'ALM_MP')?.id as string | undefined;
  const almGrId = (ubiRows ?? []).find((u) => u.codigo === 'ALM_GR')?.id as string | undefined;
  if (!almMpId) return [];

  const recetas = await getRecetas();
  const componentes = recetas.filter((r) => r.item_producido_id === ptId);
  if (componentes.length === 0) return [];

  const [stockMp, stockGr] = await Promise.all([
    stockPorItemEnUbicacion(almMpId),
    stockPorItemEnUbicacion(almGrId),
  ]);

  return componentes.map((r) => {
    const compId = r.componente_id ?? r.item_componente_id;
    const comp = r.componente ?? r.ma_item_componente;
    const tipo = (comp?.tipo ?? '').toUpperCase();
    const esGranel = tipo === 'GRANEL';
    const req = r.cantidad * opts.cantPlanificada;
    const disp = esGranel ? (stockGr[compId] ?? 0) : (stockMp[compId] ?? 0);
    const faltante = Math.max(0, req - disp);
    return {
      item_id: compId,
      codigo: comp?.codigo,
      nombre: comp?.nombre ?? '—',
      unidad_medida: comp?.unidad_medida,
      tipo: tipo || undefined,
      ubicacion_codigo: esGranel ? 'ALM_GR' : 'ALM_MP',
      requerido: req,
      disponible: disp,
      faltante,
      suficiente: disp >= req,
    };
  });
}

export async function checkStockProduccion(
  presentacionOrPtId: string,
  cantidadBotellas: number,
): Promise<{
  tiene_stock: boolean;
  detalle: {
    nombre: string;
    codigo?: string;
    tipo?: string;
    ubicacion_codigo?: 'ALM_GR' | 'ALM_MP';
    necesario: number;
    disponible: number;
    faltante: number;
  }[];
}> {
  const preview = await validarInsumosPreview({
    itemProducidoId: presentacionOrPtId,
    cantPlanificada: Math.round(cantidadBotellas),
  });
  const detalle = preview.map((v) => ({
    nombre: v.nombre,
    codigo: v.codigo,
    tipo: v.tipo,
    ubicacion_codigo: v.ubicacion_codigo,
    necesario: v.requerido,
    disponible: v.disponible,
    faltante: v.faltante,
  }));
  return {
    tiene_stock: preview.length > 0 && preview.every((v) => v.suficiente),
    detalle,
  };
}

export async function validarInsumosOrden(ordenId: string): Promise<InsumoValidacionOrden[]> {
  const { data, error } = await supabase.rpc(ErpRpc.validarInsumosOrden, { p_orden_id: ordenId });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) || []).map((r) => {
    const requerido = parseNum(r.cantidad_req ?? r.requerido);
    const disponible = parseNum(r.cantidad_disp ?? r.disponible);
    const faltante = parseNum(r.faltante ?? Math.max(0, requerido - disponible));
    const tipo = r.tipo ? String(r.tipo).toUpperCase() : undefined;
    const esGranel = tipo === 'GRANEL';
    return {
      item_id: String(r.item_id ?? ''),
      codigo: r.codigo ? String(r.codigo) : undefined,
      nombre: String(r.nombre ?? r.item_nombre ?? '—'),
      unidad_medida: r.unidad_medida ? String(r.unidad_medida) : undefined,
      tipo,
      ubicacion_codigo: esGranel ? 'ALM_GR' : 'ALM_MP',
      requerido,
      disponible,
      faltante,
      suficiente: r.tiene_todo === true || r.suficiente === true || faltante <= 0,
    };
  });
}

export async function crearOrdenProduccion(opts: {
  itemProducidoId: string;
  cantidadProgramada: number;
  ubicacionDestinoId?: string;
  observaciones?: string;
  txnId?: string;
  presentacionId?: string;
  modoCantidad?: 'BOTELLA' | 'PACK';
}): Promise<string> {
  const uid = await getUserId();
  const { data: nroData, error: nroErr } = await supabase.rpc(ErpRpc.generarNroOrden, { p_fecha: hoyYmd() });
  if (nroErr) throw nroErr;
  const txnId = opts.txnId ?? newTxnId();
  const { data, error } = await supabase
    .from(Tables.prdOrden)
    .insert({
      nro_orden: String(nroData),
      item_producido_id: opts.itemProducidoId,
      cant_planificada: Math.round(opts.cantidadProgramada),
      estado: 'BORRADOR',
      ubicacion_destino_id: opts.ubicacionDestinoId ?? null,
      observaciones: opts.observaciones ?? null,
      presentacion_id: opts.presentacionId ?? null,
      modo_cantidad: opts.modoCantidad ?? 'BOTELLA',
      usuario_id: uid ?? null,
      txn_id: txnId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Transferencias ───

function mapTransferenciaRow(row: TrnTransferencia): TrnTransferencia {
  const legacy = row as TrnTransferencia & { fecha_creacion?: string };
  return {
    ...row,
    fecha_envio: row.fecha_envio ?? legacy.fecha_creacion,
  };
}

export async function getTransferencias(estado?: string): Promise<TrnTransferencia[]> {
  let q = supabase
    .from(Tables.trnTransferencia)
    .select(`
      *,
      origen:origen_id(id, codigo, nombre),
      destino:destino_id(id, codigo, nombre),
      trn_transferencia_detalle(id, item_id, presentacion_id, lote_id, cantidad)
    `)
    .order('fecha_envio', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapTransferenciaRow);
}

// ─── Gastos ───

export async function getGastos(limit = 50): Promise<GasGasto[]> {
  const { data, error } = await supabase
    .from(Tables.gasGasto)
    .select('*, gas_categoria(id, nombre, centro_costo)')
    .order('fecha', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ─── Ventas ───

export async function getVentas(limit = 50): Promise<VentaResumen[]> {
  const { data, error } = await supabase
    .from(Tables.venVenta)
    .select(`
      id, fecha, nro_venta, total, canal, tipo, observaciones, ubicacion_id,
      cat_ubicacion:ubicacion_id(id, codigo, nombre),
      ma_cliente:cliente_id(id, nombre)
    `)
    .order('fecha', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((v: Record<string, unknown>) => ({
    ...v,
    total: parseNum(v.total),
  })) as VentaResumen[];
}

export async function getVentasPorUbicacionFecha(opts: {
  ubicacionId: string;
  fecha?: string;
  limit?: number;
}): Promise<VentaResumen[]> {
  const fecha = opts.fecha ?? hoyYmd();
  const { data, error } = await supabase
    .from(Tables.venVenta)
    .select(`
      id, fecha, nro_venta, total, canal, tipo, observaciones, estado,
      cat_ubicacion:ubicacion_id(id, codigo, nombre),
      ma_cliente:cliente_id(id, nombre)
    `)
    .eq('ubicacion_id', opts.ubicacionId)
    .or('estado.is.null,estado.eq.ACTIVA')
    .gte('fecha', `${fecha}T00:00:00`)
    .lte('fecha', `${fecha}T23:59:59`)
    .order('fecha', { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw error;
  return (data || []).map((v: Record<string, unknown>) => ({
    ...v,
    total: parseNum(v.total),
  })) as VentaResumen[];
}

export async function getVentasDelMes(): Promise<{ total: number; count: number; ventas: VentaResumen[] }> {
  const ventas = await getVentasPeriodo(inicioMesYmd(), hoyYmd());
  return {
    total: ventas.reduce((s, v) => s + v.total, 0),
    count: ventas.length,
    ventas,
  };
}

export async function getVentasPeriodo(
  fechaDesde: string,
  fechaHasta: string,
  opts?: { includeAnuladas?: boolean },
): Promise<VentaResumen[]> {
  let q = supabase
    .from(Tables.venVenta)
    .select(`
      id, fecha, nro_venta, total, canal, tipo, observaciones, ubicacion_id, cliente_id,
      estado, anulado_at, anulado_motivo,
      cat_ubicacion:ubicacion_id(id, codigo, nombre),
      ma_cliente:cliente_id(id, nombre)
    `)
    .gte('fecha', fechaDesde)
    .lte('fecha', `${fechaHasta}T23:59:59`)
    .order('fecha', { ascending: false });
  if (!opts?.includeAnuladas) {
    q = q.or('estado.is.null,estado.eq.ACTIVA');
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((v: Record<string, unknown>) => ({
    ...v,
    total: parseNum(v.total),
  })) as VentaResumen[];
}

export async function getVentaDetalle(ventaId: string): Promise<VentaDetalleLinea[]> {
  const { data, error } = await supabase
    .from(Tables.venDetalle)
    .select(`
      id, venta_id, item_id, presentacion_id, lote_id, cantidad, precio_unitario, subtotal,
      ma_item:item_id(id, codigo, nombre, tipo, unidad_medida),
      ma_presentacion:presentacion_id(id, codigo, nombre, cant_unidades)
    `)
    .eq('venta_id', ventaId)
    .order('fecha_creacion', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: Record<string, unknown>) => ({
    ...d,
    cantidad: parseNum(d.cantidad),
    precio_unitario: parseNum(d.precio_unitario),
    subtotal: parseNum(d.subtotal),
  })) as VentaDetalleLinea[];
}

export async function getGastosPeriodo(fechaDesde: string, fechaHasta: string): Promise<GasGasto[]> {
  const { data, error } = await supabase
    .from(Tables.gasGasto)
    .select('*, gas_categoria(id, nombre, centro_costo)')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .order('fecha', { ascending: true });
  if (error) throw error;
  return (data || []).map((g: GasGasto) => ({ ...g, monto: parseNum(g.monto) }));
}

export async function getOrdenesPeriodo(fechaDesde: string, fechaHasta: string): Promise<PrdOrden[]> {
  const { data, error } = await supabase
    .from(Tables.prdOrden)
    .select(`
      *,
      ma_item:item_producido_id(id, codigo, nombre, tipo),
      ma_presentacion:presentacion_id(id, codigo, nombre, cant_unidades, item_id)
    `)
    .gte('fecha_inicio', fechaDesde)
    .lte('fecha_inicio', `${fechaHasta}T23:59:59`)
    .order('fecha_inicio', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getTransferenciasPeriodo(fechaDesde: string, fechaHasta: string): Promise<TrnTransferencia[]> {
  const { data, error } = await supabase
    .from(Tables.trnTransferencia)
    .select('*, origen:origen_id(id, codigo, nombre), destino:destino_id(id, codigo, nombre)')
    .gte('fecha_envio', `${fechaDesde}T00:00:00`)
    .lte('fecha_envio', `${fechaHasta}T23:59:59`)
    .order('fecha_envio', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTransferenciaRow);
}

export async function getMovimientosPeriodo(
  fechaDesde: string,
  fechaHasta: string,
  opts?: { tipo_mov?: string | string[]; limit?: number },
): Promise<InvMovimiento[]> {
  let q = supabase
    .from(Tables.invMovimiento)
    .select(`
      *,
      cat_ubicacion(id, nombre, codigo),
      ma_item(id, nombre, codigo, tipo, unidad_medida)
    `)
    .gte('fecha', fechaDesde)
    .lte('fecha', `${fechaHasta}T23:59:59`)
    .order('fecha', { ascending: true });
  if (opts?.tipo_mov) {
    if (Array.isArray(opts.tipo_mov)) q = q.in('tipo_mov', opts.tipo_mov);
    else q = q.eq('tipo_mov', opts.tipo_mov);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((m: InvMovimiento) => ({ ...m, cantidad: parseNum(m.cantidad) }));
}

// ─── Reportes ───

export async function getReporteVentasPeriodo(fechaDesde: string, fechaHasta: string, ubicacionId?: string) {
  const params: Record<string, unknown> = {
    p_desde: fechaDesde,
    p_hasta: fechaHasta,
  };
  if (ubicacionId) params.p_ubicacion_id = ubicacionId;
  const { data, error } = await supabase.rpc(ErpRpc.reporteVentasPeriodo, params);
  if (error) throw error;
  return (data as Record<string, unknown>[]) || [];
}

export async function getReporteGastosPeriodo(fechaDesde: string, fechaHasta: string, centroCosto?: string) {
  const params: Record<string, unknown> = {
    p_desde: fechaDesde,
    p_hasta: fechaHasta,
  };
  if (centroCosto) params.p_centro_costo = centroCosto;
  const { data, error } = await supabase.rpc(ErpRpc.reporteGastosPeriodo, params);
  if (error) throw error;
  return (data as Record<string, unknown>[]) || [];
}

export async function getResumenReportes(fechaDesde: string, fechaHasta: string, opts?: { ubicacionId?: string; centroCosto?: string }) {
  const [ventas, gastos, ordenesRes, comprasRes] = await Promise.all([
    getReporteVentasPeriodo(fechaDesde, fechaHasta, opts?.ubicacionId),
    getReporteGastosPeriodo(fechaDesde, fechaHasta, opts?.centroCosto),
    (async () => {
      let q = supabase
        .from(Tables.prdOrden)
        .select('cant_real, ubicacion_destino_id')
        .eq('estado', 'COMPLETADA')
        .gte('fecha_completada', `${fechaDesde}T00:00:00`)
        .lte('fecha_completada', `${fechaHasta}T23:59:59`);
      if (opts?.ubicacionId) q = q.eq('ubicacion_destino_id', opts.ubicacionId);
      return q;
    })(),
    (async () => {
      let q = supabase
        .from(Tables.invMovimiento)
        .select('cantidad, ubicacion_id, item_id, ma_item!inner(tipo)')
        .eq('tipo_mov', 'COMPRA')
        .gte('fecha', `${fechaDesde}T00:00:00`)
        .lte('fecha', `${fechaHasta}T23:59:59`);
      if (opts?.ubicacionId) q = q.eq('ubicacion_id', opts.ubicacionId);
      return q;
    })(),
  ]);

  if (ordenesRes.error) throw ordenesRes.error;
  if (comprasRes.error) throw comprasRes.error;

  let totalVentas = 0;
  let ventasUnidades = 0;
  for (const v of ventas) {
    totalVentas += Number(v.total_vendido) || 0;
    ventasUnidades += Number(v.cant_vendida) || 0;
  }
  const totalGastos = gastos.reduce((s, g) => s + (Number(g.total_gastado) || 0), 0);
  const produccion = (ordenesRes.data || []).reduce((s, o) => s + (Number(o.cant_real) || 0), 0);

  let entradasInsumo = 0;
  for (const c of comprasRes.data || []) {
    const tipo = String((c.ma_item as { tipo?: string } | null)?.tipo ?? '').toUpperCase();
    if (tipo !== 'INSUMO' && tipo !== 'EMPAQUE') continue;
    entradasInsumo += Number(c.cantidad) || 0;
  }

  return {
    ingresos_monto: totalVentas,
    egresos_monto: totalGastos,
    ventas_unidades: ventasUnidades,
    produccion_unidades: produccion,
    entradas_insumo_cantidad: entradasInsumo,
    gastos_detalle: gastos,
    totalVentas,
    totalGastos,
    balance: totalVentas - totalGastos,
    produccion,
    ventas,
    gastos,
  };
}

// ─── Dashboard ───

export async function getDashboardKPIs(fechaDesde?: string, fechaHasta?: string): Promise<DashboardKPIs> {
  const desde = fechaDesde ?? inicioMesYmd();
  const hasta = fechaHasta ?? hoyYmd();
  const insumoTypes = new Set(['GRANEL', 'INSUMO', 'EMPAQUE', 'MATERIAL']);
  const [itemsPt, allInsumo, alertas, movHoy, gastosMes, prodMes, ventasMes] = await Promise.all([
    getResumenStockItems('PT'),
    getResumenStockItems(),
    getItemsBajoStockMinimo(),
    (async () => {
      const hoy = hoyYmd();
      const { count } = await supabase.from(Tables.invMovimiento).select('id', { count: 'exact', head: true }).gte('fecha', hoy);
      return count || 0;
    })(),
    (async () => {
      const { data } = await supabase.from(Tables.gasGasto).select('monto').gte('fecha', desde).lte('fecha', hasta);
      return (data || []).reduce((s, r) => s + (r.monto || 0), 0);
    })(),
    (async () => {
      const { data } = await supabase
        .from(Tables.invMovimiento)
        .select('cantidad')
        .eq('tipo_mov', 'PRODUCCION')
        .gte('fecha', desde)
        .lte('fecha', `${hasta}T23:59:59`);
      return (data || []).reduce((s, r) => s + parseNum(r.cantidad), 0);
    })(),
    (async () => {
      const ventas = await getVentasPeriodo(desde, hasta);
      return {
        total: ventas.reduce((s, v) => s + v.total, 0),
        count: ventas.length,
      };
    })(),
  ]);

  const itemsInsumo = allInsumo.filter((i) => insumoTypes.has(i.tipo));

  return {
    totalStockPT: itemsPt.reduce((s, r) => s + r.stock_total, 0),
    totalStockInsumos: itemsInsumo.reduce((s, r) => s + r.stock_total, 0),
    alertasStockBajo: alertas.length,
    movimientosHoy: movHoy as number,
    gastosDelMes: gastosMes as number,
    produccionMes: prodMes as number,
    ventasMes: ventasMes.total,
    ventasMesCount: ventasMes.count,
  };
}

export async function getMovimientosPorDia(dias = 7) {
  const trend = await getMovimientosTrendDetalle(dias);
  return trend.map(({ fecha, entradas, salidas }) => ({ fecha, entradas, salidas }));
}

export async function getMovimientosTrendDetalle(dias = 14, rango?: { desde: string; hasta: string }): Promise<MovimientoTrendDia[]> {
  let desdeYmd: string;
  let hastaYmd: string;
  let dayKeys: string[];

  if (rango) {
    desdeYmd = rango.desde;
    hastaYmd = rango.hasta;
    dayKeys = diasEnRango(desdeYmd, hastaYmd);
  } else {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desdeYmd = ymdInZone(desde);
    hastaYmd = hoyYmd();
    dayKeys = diasEnRango(desdeYmd, hastaYmd);
  }

  const agrupado: Record<string, MovimientoTrendDia> = {};
  for (const key of dayKeys) {
    agrupado[key] = { fecha: key, entradas: 0, salidas: 0, ajustes: 0, merma: 0 };
  }

  const { data, error } = await supabase
    .from(Tables.invMovimiento)
    .select('fecha, tipo_mov, cantidad')
    .gte('fecha', desdeYmd)
    .lte('fecha', `${hastaYmd}T23:59:59`)
    .order('fecha', { ascending: true });
  if (error) throw error;

  (data || []).forEach((m: { fecha: string; tipo_mov: string; cantidad: unknown }) => {
    const dia = m.fecha?.split('T')[0] || '';
    if (!agrupado[dia]) {
      agrupado[dia] = { fecha: dia, entradas: 0, salidas: 0, ajustes: 0, merma: 0 };
    }
    const qty = Math.abs(parseNum(m.cantidad));
    const tipo = m.tipo_mov;
    if (tipo === 'AJUSTE_ING' || tipo === 'AJUSTE_SAL') {
      agrupado[dia].ajustes += qty;
    } else if (tipo === 'MERMA') {
      agrupado[dia].merma += qty;
    } else if (ENTRADA_TIPOS.includes(tipo as typeof ENTRADA_TIPOS[number])) {
      agrupado[dia].entradas += qty;
    } else if (SALIDA_TIPOS.includes(tipo as typeof SALIDA_TIPOS[number])) {
      agrupado[dia].salidas += qty;
    }
  });

  return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function getDashboardEjecutivoData(fechaDesde?: string, fechaHasta?: string): Promise<DashboardEjecutivoData> {
  const inicioMes = fechaDesde ?? inicioMesYmd();
  const finMes = fechaHasta ?? hoyYmd();

  const [
    financiero,
    movsAjusteRes,
    alertas,
    ordenesMesRes,
    ordenesBorradorRes,
    transferencias,
    stockPt,
  ] = await Promise.all([
    getResumenReportes(inicioMes, finMes),
    supabase
      .from(Tables.invMovimiento)
      .select(`
        cantidad, tipo_mov, item_id, ubicacion_id,
        ma_item(id, nombre, codigo),
        cat_ubicacion(id, nombre)
      `)
      .in('tipo_mov', ['AJUSTE_ING', 'AJUSTE_SAL', 'MERMA'])
      .gte('fecha', inicioMes)
      .lte('fecha', `${finMes}T23:59:59`),
    getItemsBajoStockMinimo(),
    supabase
      .from(Tables.prdOrden)
      .select('cant_planificada, cant_real, estado')
      .eq('estado', 'COMPLETADA')
      .gte('fecha_completada', inicioMes)
      .lte('fecha_completada', finMes),
    supabase
      .from(Tables.prdOrden)
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'BORRADOR'),
    getTransferencias('EN_TRANSITO'),
    getResumenStockItems('PT'),
  ]);

  if (movsAjusteRes.error) throw movsAjusteRes.error;
  if (ordenesMesRes.error) throw ordenesMesRes.error;
  if (ordenesBorradorRes.error) throw ordenesBorradorRes.error;

  type MovAjusteRow = {
    cantidad: unknown;
    tipo_mov: string;
    item_id: string | null;
    ma_item?: { nombre?: string } | null;
    cat_ubicacion?: { nombre?: string } | null;
  };

  const movs = (movsAjusteRes.data || []) as MovAjusteRow[];
  let ajustesCount = 0;
  let ajustesVolumenAbs = 0;
  let ajustesDeltaNeto = 0;
  let mermaCount = 0;
  let mermaVolumen = 0;

  const porItem: Record<string, AjusteTopItem> = {};
  const porUbi: Record<string, AjustePorUbicacion> = {};

  for (const m of movs) {
    const qty = Math.abs(parseNum(m.cantidad));
    const ubi = m.cat_ubicacion?.nombre || 'Sin ubicación';
    const itemId = m.item_id || 'unknown';
    const itemNombre = m.ma_item?.nombre || 'Ítem';

    if (m.tipo_mov === 'MERMA') {
      mermaCount += 1;
      mermaVolumen += qty;
      continue;
    }

    ajustesCount += 1;
    ajustesVolumenAbs += qty;
    const signed = m.tipo_mov === 'AJUSTE_ING' ? qty : -qty;
    ajustesDeltaNeto += signed;

    if (!porItem[itemId]) {
      porItem[itemId] = { itemId, itemNombre, ubicacionNombre: ubi, deltaNeto: 0, volumenAbs: 0, count: 0 };
    }
    porItem[itemId].deltaNeto += signed;
    porItem[itemId].volumenAbs += qty;
    porItem[itemId].count += 1;

    if (!porUbi[ubi]) porUbi[ubi] = { ubicacion: ubi, volumenAbs: 0, count: 0 };
    porUbi[ubi].volumenAbs += qty;
    porUbi[ubi].count += 1;
  }

  const totalStockPt = stockPt.reduce((s, r) => s + r.stock_total, 0);
  const impactoAjustesPct = totalStockPt > 0 ? (ajustesVolumenAbs / totalStockPt) * 100 : 0;

  const ordenesMes = ordenesMesRes.data || [];
  const prodPlan = ordenesMes.reduce((s, o) => s + parseNum(o.cant_planificada), 0);
  const prodReal = ordenesMes.reduce((s, o) => s + parseNum(o.cant_real), 0);
  const prodCumplimiento = prodPlan > 0 ? prodReal / prodPlan : 1;

  const topAjustes = Object.values(porItem)
    .sort((a, b) => b.volumenAbs - a.volumenAbs)
    .slice(0, 8);

  const ajustesPorUbicacion = Object.values(porUbi)
    .sort((a, b) => b.volumenAbs - a.volumenAbs);

  return {
    totalVentas: financiero.totalVentas,
    totalGastos: financiero.totalGastos,
    balance: financiero.balance,
    produccionReal: financiero.produccion,
    ajustesCount,
    ajustesVolumenAbs,
    ajustesDeltaNeto,
    mermaCount,
    mermaVolumen,
    impactoAjustesPct,
    prodPlan,
    prodReal,
    prodCumplimiento,
    topAjustes,
    ajustesPorUbicacion,
    alertasStock: alertas.slice(0, 10),
    transferenciasPendientes: transferencias.length,
    ordenesBorrador: ordenesBorradorRes.count || 0,
  };
}

export async function getStockPorUbicacion() {
  const { data } = await supabase
    .from(Tables.invStockSaldo)
    .select('cantidad, cat_ubicacion:ubicacion_id(nombre)')
    .gt('cantidad', 0);
  const agrupado: Record<string, number> = {};
  (data || []).forEach((r: { cantidad: unknown; cat_ubicacion?: { nombre: string } | null }) => {
    const ubi = r.cat_ubicacion?.nombre || 'Sin ubicación';
    agrupado[ubi] = (agrupado[ubi] || 0) + parseNum(r.cantidad);
  });
  return Object.entries(agrupado).map(([ubicacion, cantidad]) => ({ ubicacion, cantidad }));
}

/** Inventario agregado ítem × almacén (una sola consulta). */
export async function getInventarioDetallado(): Promise<InventarioFila[]> {
  const { data, error } = await supabase
    .from(Tables.invStockSaldo)
    .select(`
      cantidad,
      cat_ubicacion:ubicacion_id(id, codigo, nombre, es_punto_venta),
      ma_item:item_id(id, codigo, nombre, tipo, unidad_medida, stock_minimo, categoria)
    `)
    .gt('cantidad', 0);
  if (error) throw new Error(friendlyDbError(error));

  const map = new Map<string, InventarioFila>();
  for (const row of data || []) {
    const ubi = row.cat_ubicacion as CatUbicacion | null;
    const item = row.ma_item as MaItem | null;
    if (!ubi?.id || !item?.id) continue;
    const key = `${ubi.id}:${item.id}`;
    const qty = parseNum(row.cantidad);
    const prev = map.get(key);
    if (prev) {
      prev.stock_total += qty;
      prev.lotes_count += 1;
    } else {
      const min = parseNum(item.stock_minimo);
      map.set(key, {
        almacen_id: ubi.id,
        almacen_codigo: ubi.codigo,
        almacen_nombre: ubi.nombre,
        es_punto_venta: !!ubi.es_punto_venta,
        item_id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        tipo: item.tipo,
        categoria: item.categoria || 'Sin categoría',
        unidad_medida: item.unidad_medida,
        stock_total: qty,
        lotes_count: 1,
        stock_minimo: min,
        bajo_minimo: false,
      });
    }
  }

  const result = Array.from(map.values());
  for (const r of result) {
    r.bajo_minimo = r.stock_minimo > 0 && r.stock_total < r.stock_minimo;
  }
  result.sort((a, b) => {
    const cmpAlm = a.almacen_nombre.localeCompare(b.almacen_nombre);
    if (cmpAlm !== 0) return cmpAlm;
    const cmpCat = a.categoria.localeCompare(b.categoria);
    if (cmpCat !== 0) return cmpCat;
    return a.nombre.localeCompare(b.nombre);
  });
  return result;
}

export function buildResumenPorAlmacen(filas: InventarioFila[]): AlmacenResumenInv[] {
  const byAlm = new Map<string, AlmacenResumenInv>();
  for (const f of filas) {
    let res = byAlm.get(f.almacen_id);
    if (!res) {
      res = {
        almacen_id: f.almacen_id,
        almacen_codigo: f.almacen_codigo,
        almacen_nombre: f.almacen_nombre,
        es_punto_venta: f.es_punto_venta,
        sku_count: 0,
        lotes_count: 0,
        total_cantidad: 0,
        alertas: 0,
        por_tipo: {},
      };
      byAlm.set(f.almacen_id, res);
    }
    res.sku_count += 1;
    res.lotes_count += f.lotes_count;
    res.total_cantidad += f.stock_total;
    if (f.bajo_minimo) res.alertas += 1;
    if (!res.por_tipo[f.tipo]) res.por_tipo[f.tipo] = { skus: 0, cantidad: 0 };
    res.por_tipo[f.tipo].skus += 1;
    res.por_tipo[f.tipo].cantidad += f.stock_total;
  }
  return Array.from(byAlm.values()).sort((a, b) => a.almacen_nombre.localeCompare(b.almacen_nombre));
}

export async function getGastosPorCategoria() {
  const { data } = await supabase.from(Tables.gasGasto).select('monto, gas_categoria(nombre)');
  const agrupado: Record<string, number> = {};
  (data || []).forEach((r: { monto: number; gas_categoria?: { nombre: string } | null }) => {
    const cat = r.gas_categoria?.nombre || 'Sin categoría';
    agrupado[cat] = (agrupado[cat] || 0) + (r.monto || 0);
  });
  return Object.entries(agrupado).map(([categoria, total]) => ({ categoria, total }));
}

// ─── RPC Writes ───

async function registrarAjusteRpc(opts: {
  itemId: string;
  ubicacionId: string;
  delta: number;
  motivo: string;
  loteId?: string;
  observacion?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  const motivo = opts.delta < 0 && /merma/i.test(opts.motivo) && !opts.motivo.startsWith('MERMA')
    ? `MERMA: ${opts.motivo}`
    : opts.motivo;
  await callRpc(ErpRpc.ajusteRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_ubicacion_id: opts.ubicacionId,
    p_item_id: opts.itemId,
    p_lote_id: opts.loteId ?? null,
    p_delta: opts.delta,
    p_motivo: motivo,
    p_observacion: opts.observacion ?? null,
    p_usuario_id: uid ?? null,
  }, 'No se pudo registrar el ajuste.');
}

export async function registrarCompra(opts: {
  itemId: string;
  cantidad: number;
  ubicacionId: string;
  motivo?: string;
  observacion?: string;
  precioUnitario?: number;
  fechaVencimiento?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  const { data, error } = await supabase.rpc(ErpRpc.compraRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_item_id: opts.itemId,
    p_ubicacion_id: opts.ubicacionId,
    p_cantidad: Math.abs(opts.cantidad),
    p_precio_unitario: opts.precioUnitario ?? null,
    p_motivo: opts.motivo ?? null,
    p_observacion: opts.observacion ?? null,
    p_fecha_vencimiento: opts.fechaVencimiento ?? null,
    p_usuario_id: uid ?? null,
  });
  if (error) throw new Error(friendlyDbError(error));
  return String(data);
}

/** Compra + egreso opcional (`fn_compra_registrar_con_gasto`). */
export async function registrarCompraConGasto(opts: {
  itemId: string;
  cantidad: number;
  ubicacionId: string;
  registrarGasto: boolean;
  gastoCategoriaId?: string;
  motivo?: string;
  observacion?: string;
  precioUnitario?: number;
  fechaVencimiento?: string;
  txnId?: string;
  gastoCentroCosto?: string;
  gastoDescripcion?: string;
  gastoProveedorNombre?: string;
}) {
  const uid = await getUserId();
  const { data, error } = await supabase.rpc(ErpRpc.compraRegistrarConGasto, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_item_id: opts.itemId,
    p_ubicacion_id: opts.ubicacionId,
    p_cantidad: Math.abs(opts.cantidad),
    p_precio_unitario: opts.precioUnitario ?? null,
    p_motivo: opts.motivo ?? null,
    p_observacion: opts.observacion ?? null,
    p_fecha_vencimiento: opts.fechaVencimiento ?? null,
    p_usuario_id: uid ?? null,
    p_registrar_gasto: opts.registrarGasto,
    p_gasto_categoria_id: opts.gastoCategoriaId ?? null,
    p_gasto_centro_costo: opts.gastoCentroCosto ?? 'BODEGA',
    p_gasto_descripcion: opts.gastoDescripcion ?? null,
    p_gasto_proveedor_nombre: opts.gastoProveedorNombre ?? null,
  });
  if (error) throw new Error(friendlyDbError(error));
  return String(data);
}

export async function registrarCompraDoc(opts: {
  ubicacionId: string;
  lineas: CompraLinea[];
  proveedorId?: string;
  referencia?: string;
  observaciones?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  return callRpc<{ compra_id?: string }>(ErpRpc.compraRegistrarDoc, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_ubicacion_id: opts.ubicacionId,
    p_proveedor_id: opts.proveedorId ?? null,
    p_referencia: opts.referencia ?? null,
    p_observaciones: opts.observaciones ?? null,
    p_usuario_id: uid ?? null,
    p_lineas: opts.lineas,
  }, 'No se pudo registrar la compra documentada.');
}

export async function registrarAjustePorSku(opts: {
  delta: number;
  ubicacionId: string;
  motivo: string;
  itemId?: string;
  presentacionId?: string;
  loteId?: string;
  txnId?: string;
}) {
  if (opts.delta === 0) return;
  const effectiveItemId = await resolveItemId({ itemId: opts.itemId, presentacionId: opts.presentacionId });
  if (!effectiveItemId) throw new Error('No se pudo determinar el ítem');

  if (opts.loteId) {
    await registrarAjusteRpc({
      itemId: effectiveItemId,
      ubicacionId: opts.ubicacionId,
      delta: opts.delta,
      motivo: opts.motivo,
      loteId: opts.loteId,
      txnId: opts.txnId,
    });
    return;
  }

  if (opts.delta > 0) {
    await registrarAjusteRpc({
      itemId: effectiveItemId,
      ubicacionId: opts.ubicacionId,
      delta: opts.delta,
      motivo: opts.motivo,
      txnId: opts.txnId,
    });
    return;
  }

  const asignaciones = await resolveLoteAllocationsFifo({
    ubicacionId: opts.ubicacionId,
    cantidad: Math.abs(opts.delta),
    itemId: effectiveItemId,
  });
  for (const a of asignaciones) {
    await registrarAjusteRpc({
      itemId: effectiveItemId,
      ubicacionId: opts.ubicacionId,
      delta: -a.cantidad,
      motivo: opts.motivo,
      loteId: a.loteId,
      txnId: opts.txnId,
    });
  }
}

export async function registrarGranel(opts: {
  itemId: string;
  cantidad: number;
  ubicacionId?: string;
  observacion?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  await callRpc(ErpRpc.granelRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_item_id: opts.itemId,
    p_ubicacion_id: opts.ubicacionId ?? null,
    p_cantidad: opts.cantidad,
    p_observacion: opts.observacion ?? null,
    p_usuario_id: uid ?? null,
  }, 'No se pudo registrar producción de granel.');
}

export async function registrarReempaque(opts: {
  ubicacionId: string;
  itemOrigenId: string;
  itemDestinoId: string;
  cantidadOrigen: number;
  cantidadDestino: number;
  observacion?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  await callRpc(ErpRpc.reempaqueRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_ubicacion_id: opts.ubicacionId,
    p_item_origen_id: opts.itemOrigenId,
    p_item_destino_id: opts.itemDestinoId,
    p_cantidad_origen: opts.cantidadOrigen,
    p_cantidad_destino: opts.cantidadDestino,
    p_observacion: opts.observacion ?? null,
    p_usuario_id: uid ?? null,
  }, 'No se pudo registrar el reempaque.');
}

// ─── Ventas ───

export async function validarStockDisponible(opts: {
  itemId: string;
  loteId: string;
  ubicacionId: string;
  cantidad: number;
}): Promise<{ tiene_stock: boolean; faltante?: number }> {
  const { data, error } = await supabase.rpc(ErpRpc.validarStockDisponible, {
    p_item_id: opts.itemId,
    p_lote_id: opts.loteId,
    p_ubicacion_id: opts.ubicacionId,
    p_cantidad: opts.cantidad,
  });
  if (error) throw new Error(friendlyDbError(error));
  const row = ((data as Record<string, unknown>[]) || [])[0];
  return {
    tiene_stock: row?.tiene_stock === true,
    faltante: row?.faltante != null ? Number(row.faltante) : undefined,
  };
}

export async function calcularTotalVenta(ventaId: string): Promise<number> {
  const { data, error } = await supabase.rpc(ErpRpc.calcularTotalVenta, { p_venta_id: ventaId });
  if (error) throw error;
  return Number(data) || 0;
}

export async function registrarVentaAtomica(opts: {
  ubicacionId: string;
  canal: string;
  lineas: VentaLinea[];
  tipo?: string;
  clienteId?: string;
  observaciones?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  const { data, error } = await supabase.rpc(ErpRpc.ventaRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_ubicacion_id: opts.ubicacionId,
    p_canal: opts.canal,
    p_tipo: opts.tipo ?? 'VENTA',
    p_cliente_id: opts.clienteId ?? null,
    p_observaciones: opts.observaciones ?? null,
    p_usuario_id: uid ?? null,
    p_lineas: opts.lineas,
  });
  if (error) throw new Error(friendlyDbError(error));
  return String(data);
}

export async function registrarGasto(payload: Record<string, unknown>, txnId?: string) {
  const uid = await getUserId();
  const body = { ...payload };
  if (uid && body.usuario_id == null) body.usuario_id = uid;
  await callRpc(ErpRpc.gastoRegistrar, {
    p_txn_id: txnId ?? newTxnId(),
    p_payload: body,
  }, 'No se pudo registrar el gasto.');
}

export async function actualizarGasto(gastoId: string, payload: Record<string, unknown>) {
  const uid = await getUserId();
  await callRpc(ErpRpc.gastoActualizar, {
    p_gasto_id: gastoId,
    p_payload: payload,
    p_usuario_id: uid ?? null,
  }, 'No se pudo actualizar el gasto.');
}

export async function eliminarGasto(gastoId: string) {
  const uid = await getUserId();
  await callRpc(ErpRpc.gastoEliminar, {
    p_gasto_id: gastoId,
    p_usuario_id: uid ?? null,
  }, 'No se pudo eliminar el gasto.');
}

export async function actualizarVenta(opts: {
  ventaId: string;
  observaciones?: string | null;
  clienteId?: string | null;
  canal?: string;
  tipo?: string;
  lineas?: { id: string; precio_unitario: number }[];
}) {
  const uid = await getUserId();
  const payload: Record<string, unknown> = {};
  if (opts.observaciones !== undefined) payload.observaciones = opts.observaciones;
  if (opts.clienteId !== undefined) payload.cliente_id = opts.clienteId;
  if (opts.canal != null) payload.canal = opts.canal;
  if (opts.tipo != null) payload.tipo = opts.tipo;
  if (opts.lineas) payload.lineas = opts.lineas;
  await callRpc(ErpRpc.ventaActualizar, {
    p_venta_id: opts.ventaId,
    p_payload: payload,
    p_usuario_id: uid ?? null,
  }, 'No se pudo actualizar la venta.');
}

export async function anularVenta(ventaId: string, motivo?: string) {
  const uid = await getUserId();
  await callRpc(ErpRpc.ventaAnular, {
    p_venta_id: ventaId,
    p_motivo: motivo ?? null,
    p_usuario_id: uid ?? null,
  }, 'No se pudo anular la venta.');
}

export async function completarOrden(ordenId: string, cantReal: number) {
  const uid = await getUserId();
  await callRpc(ErpRpc.ordenCompletar, {
    p_orden_id: ordenId,
    p_cant_real: cantReal,
    p_usuario_id: uid ?? null,
  }, 'No se pudo completar la orden.');
}

export async function anularOrden(ordenId: string) {
  const uid = await getUserId();
  await callRpc(ErpRpc.anularOrden, {
    p_orden_id: ordenId,
    p_usuario_id: uid ?? null,
  }, 'No se pudo anular la orden.');
}

async function expandTransferLineasFifo(origenId: string, lineas: TransferLinea[]): Promise<TransferLinea[]> {
  const expanded: TransferLinea[] = [];
  for (const line of lineas) {
    // XOR estricto: PT → presentacion_id; materiales → item_id (nunca ambos).
    const xorLine: TransferLinea = line.presentacion_id
      ? {
          presentacion_id: line.presentacion_id,
          item_id: undefined,
          lote_id: line.lote_id,
          cantidad: line.cantidad,
        }
      : {
          item_id: line.item_id,
          presentacion_id: undefined,
          lote_id: line.lote_id,
          cantidad: line.cantidad,
        };
    if (!xorLine.presentacion_id && !xorLine.item_id) {
      throw new Error('Cada línea de transferencia requiere presentacion_id o item_id.');
    }
    if (xorLine.lote_id) {
      expanded.push(xorLine);
      continue;
    }
    const cant = xorLine.cantidad;
    if (cant <= 0) throw new Error('Cantidad inválida en línea de transferencia');
    const lotes = await getLotesDisponibles({
      ubicacionId: origenId,
      presentacionId: xorLine.presentacion_id,
      itemId: xorLine.presentacion_id ? undefined : xorLine.item_id,
    });
    if (lotes.length === 0) throw new Error('Sin stock/lotes disponibles en origen');
    let restante = cant;
    for (const l of lotes) {
      if (restante <= 0) break;
      const disp = (l.cantidad as number) || 0;
      const qty = Math.min(restante, disp);
      expanded.push({
        item_id: xorLine.item_id,
        presentacion_id: xorLine.presentacion_id,
        lote_id: l.lote_id as string,
        cantidad: qty,
      });
      restante -= qty;
    }
    if (restante > 0) throw new Error(`Stock insuficiente en origen (faltan ${restante} unidades)`);
  }
  return expanded;
}

export async function crearTransferencia(opts: {
  origenId: string;
  destinoId: string;
  lineas: TransferLinea[];
  observaciones?: string;
  txnId?: string;
}) {
  const uid = await getUserId();
  const lineasExpandidas = await expandTransferLineasFifo(opts.origenId, opts.lineas);
  const { data, error } = await supabase.rpc(ErpRpc.transferenciaRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_origen_id: opts.origenId,
    p_destino_id: opts.destinoId,
    p_observaciones: opts.observaciones ?? null,
    p_usuario_id: uid ?? null,
    p_lineas: lineasExpandidas.map((l) => ({
      // XOR: enviar solo un lado (null el otro) para CHECK de BD.
      item_id: l.presentacion_id ? null : (l.item_id ?? null),
      presentacion_id: l.presentacion_id ?? null,
      lote_id: l.lote_id,
      cantidad: l.cantidad,
    })),
  });
  if (error) throw new Error(friendlyDbError(error));
  return String(data);
}

export async function confirmarRecepcionTransferencia(transferenciaId: string) {
  const uid = await getUserId();
  await callRpc(ErpRpc.transferenciaRecibir, {
    p_transferencia_id: transferenciaId,
    p_usuario_id: uid ?? null,
  }, 'No se pudo confirmar la recepción.');
}

// ─── Usuarios (admin) ───

export async function listarUsuariosAdmin(): Promise<AppUserRoleRow[]> {
  const data = await callRpc<AppUserRoleRow[]>(
    ErpRpc.usuariosListar,
    {},
    'No se pudo listar usuarios.',
  );
  return Array.isArray(data) ? data : [];
}

export async function actualizarPermisosUsuario(opts: {
  userId: string;
  role?: string;
  activo?: boolean;
  accesoWeb?: boolean;
  accesoApp?: boolean;
  accesoVentas?: boolean;
  nombre?: string | null;
}): Promise<AppUserRoleRow> {
  return callRpc<AppUserRoleRow>(
    ErpRpc.usuarioActualizarPermisos,
    {
      p_user_id: opts.userId,
      p_role: opts.role ?? null,
      p_activo: opts.activo ?? null,
      p_acceso_web: opts.accesoWeb ?? null,
      p_acceso_app: opts.accesoApp ?? null,
      p_acceso_ventas: opts.accesoVentas ?? null,
      p_nombre: opts.nombre === undefined ? null : opts.nombre,
    },
    'No se pudieron actualizar los permisos.',
  );
}
