/**
 * Lectura de ventas y consultas de periodo (ventas/gastos/órdenes/transferencias/movimientos).
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { hoyYmd, inicioMesYmd, parseNum } from './core';
import type {
  GasGasto, PrdOrden, TrnTransferencia, VentaDetalleLinea, VentaResumen, InvMovimiento,
} from '../../types';

function mapTransferenciaRow(row: TrnTransferencia): TrnTransferencia {
  const legacy = row as TrnTransferencia & { fecha_creacion?: string };
  return {
    ...row,
    fecha_envio: row.fecha_envio ?? legacy.fecha_creacion,
  };
}

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
