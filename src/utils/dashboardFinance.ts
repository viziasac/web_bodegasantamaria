import type { GasGasto, InvMovimiento, VentaResumen } from '../types';

export interface FinanceTopRow {
  label: string;
  value: number;
  count: number;
}

export interface FinanceDayExtreme {
  fecha: string;
  total: number;
  count: number;
}

export interface FinanceDailyPoint {
  fecha: string;
  label: string;
  total: number;
}

export interface FinanceKpis {
  ingresos: number;
  egresos: number;
  balance: number;
  ticketPromedio: number;
  opsVentas: number;
  opsGastos: number;
}

function dayKey(iso: string): string {
  return iso.includes('T') ? iso.slice(0, 10) : iso.slice(0, 10);
}

function topFromMap(map: Map<string, { value: number; count: number }>, n: number): FinanceTopRow[] {
  return [...map.entries()]
    .map(([label, v]) => ({ label, value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function bump(map: Map<string, { value: number; count: number }>, key: string, amount: number) {
  const cur = map.get(key) ?? { value: 0, count: 0 };
  cur.value += amount;
  cur.count += 1;
  map.set(key, cur);
}

/** Agrupa ventas por día (YYYY-MM-DD). */
export function ventasPorDia(ventas: VentaResumen[]): Map<string, FinanceDayExtreme> {
  const map = new Map<string, FinanceDayExtreme>();
  for (const v of ventas) {
    const f = dayKey(v.fecha);
    const cur = map.get(f) ?? { fecha: f, total: 0, count: 0 };
    cur.total += v.total || 0;
    cur.count += 1;
    map.set(f, cur);
  }
  return map;
}

/** Día con más / menos venta (solo días con venta > 0). */
export function extremosDiasVenta(ventas: VentaResumen[]): {
  mejor: FinanceDayExtreme | null;
  peor: FinanceDayExtreme | null;
} {
  const days = [...ventasPorDia(ventas).values()].filter((d) => d.total > 0);
  if (days.length === 0) return { mejor: null, peor: null };
  let mejor = days[0];
  let peor = days[0];
  for (const d of days) {
    if (d.total > mejor.total) mejor = d;
    if (d.total < peor.total) peor = d;
  }
  return { mejor, peor };
}

export function topVentasPorCanal(ventas: VentaResumen[], n = 5): FinanceTopRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const v of ventas) bump(map, v.canal?.trim() || 'Sin canal', v.total || 0);
  return topFromMap(map, n);
}

export function topVentasPorPuntoVenta(ventas: VentaResumen[], n = 5): FinanceTopRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const v of ventas) {
    const label = v.cat_ubicacion
      ? `${v.cat_ubicacion.codigo} — ${v.cat_ubicacion.nombre}`
      : 'Sin ubicación';
    bump(map, label, v.total || 0);
  }
  return topFromMap(map, n);
}

export function topVentasPorCliente(ventas: VentaResumen[], n = 5): FinanceTopRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const v of ventas) bump(map, v.ma_cliente?.nombre?.trim() || 'Sin cliente', v.total || 0);
  return topFromMap(map, n);
}

export function topEgresosPorCategoria(gastos: GasGasto[], n = 5): FinanceTopRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const g of gastos) {
    bump(map, g.gas_categoria?.nombre?.trim() || 'Sin categoría', g.monto || 0);
  }
  return topFromMap(map, n);
}

export function topEgresosPorProveedor(gastos: GasGasto[], n = 5): FinanceTopRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const g of gastos) {
    bump(map, g.proveedor_nombre?.trim() || 'Sin proveedor', g.monto || 0);
  }
  return topFromMap(map, n);
}

/** Serie diaria de ingresos ordenada por fecha (para ChartBar). */
export function serieIngresosDiarios(ventas: VentaResumen[]): FinanceDailyPoint[] {
  return [...ventasPorDia(ventas).values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => ({
      fecha: d.fecha,
      label: d.fecha.slice(5),
      total: Math.round(d.total * 100) / 100,
    }));
}

export function financeKpis(ventas: VentaResumen[], gastos: GasGasto[]): FinanceKpis {
  const ingresos = ventas.reduce((s, v) => s + (v.total || 0), 0);
  const egresos = gastos.reduce((s, g) => s + (g.monto || 0), 0);
  return {
    ingresos,
    egresos,
    balance: ingresos - egresos,
    ticketPromedio: ventas.length > 0 ? ingresos / ventas.length : 0,
    opsVentas: ventas.length,
    opsGastos: gastos.length,
  };
}

export function labelMovimientoItem(m: InvMovimiento): string {
  if (m.ma_item) return `${m.ma_item.codigo} — ${m.ma_item.nombre}`;
  if (m.ma_presentacion) return m.ma_presentacion.nombre;
  return m.item_id?.slice(0, 8) ?? '—';
}
