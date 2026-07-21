/**
 * Dashboard ejecutivo, KPIs y tendencias.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { ENTRADA_TIPOS, SALIDA_TIPOS } from '../../config/backendEnums';
import { friendlyDbError } from '../../utils/erpErrors';
import { diasEnRango } from '../../utils/periodoMes';
import { ymdInZone } from '../../utils/fechaLocal';
import { callRpc, hoyYmd, inicioMesYmd, parseNum } from './core';
import { getItemsBajoStockMinimo, getResumenStockItems } from './inventory';
import { getResumenReportes } from './reports';
import { getGastosPeriodo, getOrdenesPeriodo, getVentasPeriodo } from './sales';
import { getTransferencias } from './transfers';
import type {
  DashboardKPIs, DashboardEjecutivoData, InventarioFila, AlmacenResumenInv,
  MovimientoTrendDia, AjusteTopItem, AjustePorUbicacion, CatUbicacion, MaItem,
} from '../../types';

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
