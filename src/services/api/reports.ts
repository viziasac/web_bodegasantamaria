/**
 * Reportes agregados (RPC).
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { ErpRpc } from '../../config/erpContract';
import { callRpc } from './core';

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
