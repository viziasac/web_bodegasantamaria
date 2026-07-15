import {
  getResumenReportes,
  getVentasPeriodo,
  getGastosPeriodo,
  getOrdenesPeriodo,
  getTransferenciasPeriodo,
  getMovimientosPeriodo,
  getInventarioDetallado,
  getDashboardEjecutivoData,
} from './apiProvider';
import { rangoMes, type RangoMes } from '../utils/periodoMes';
import type { ExcelSheet } from '../utils/excelExport';

export type ExportModuloId =
  | 'resumen'
  | 'ventas'
  | 'gastos'
  | 'produccion'
  | 'transferencias'
  | 'compras'
  | 'ajustes'
  | 'movimientos'
  | 'inventario';

export interface ExportModuloMeta {
  id: ExportModuloId;
  title: string;
  subtitle: string;
  icon: string;
}

export const EXPORT_MODULOS: ExportModuloMeta[] = [
  { id: 'resumen', title: 'Resumen ejecutivo', subtitle: 'KPIs y balance del mes', icon: 'summarize' },
  { id: 'ventas', title: 'Ventas / Ingresos', subtitle: 'Detalle de ventas POS y despacho', icon: 'point_of_sale' },
  { id: 'gastos', title: 'Egresos / Gastos', subtitle: 'Gastos operativos por categoría', icon: 'money_off' },
  { id: 'produccion', title: 'Producción', subtitle: 'Órdenes del periodo', icon: 'precision_manufacturing' },
  { id: 'transferencias', title: 'Transferencias', subtitle: 'Movimientos entre almacenes', icon: 'swap_horiz' },
  { id: 'compras', title: 'Compras / Ingresos insumos', subtitle: 'Entradas por compra', icon: 'shopping_cart' },
  { id: 'ajustes', title: 'Ajustes inventario', subtitle: 'Conteos y correcciones', icon: 'tune' },
  { id: 'movimientos', title: 'Movimientos inventario', subtitle: 'Historial del mes', icon: 'history' },
  { id: 'inventario', title: 'Inventario actual (hoy)', subtitle: 'Snapshot de stock ahora — no filtra por mes', icon: 'inventory_2' },
];

function fmtFecha(v: string | null | undefined): string {
  if (!v) return '';
  return v.split('T')[0];
}

function rowsVentas(ventas: Awaited<ReturnType<typeof getVentasPeriodo>>) {
  return ventas.map((v) => ({
    Fecha: fmtFecha(v.fecha),
    'N° Venta': v.nro_venta || v.id.slice(0, 8),
    Ubicación: v.cat_ubicacion?.nombre || '',
    Canal: v.canal || '',
    Tipo: v.tipo || '',
    Cliente: v.ma_cliente?.nombre || '',
    Total: v.total,
    Observaciones: v.observaciones || '',
  }));
}

function rowsGastos(gastos: Awaited<ReturnType<typeof getGastosPeriodo>>) {
  return gastos.map((g) => ({
    Fecha: fmtFecha(g.fecha),
    Categoría: g.gas_categoria?.nombre || '',
    'Centro costo': g.gas_categoria?.centro_costo || '',
    Descripción: g.descripcion || '',
    Monto: g.monto,
  }));
}

function rowsProduccion(ordenes: Awaited<ReturnType<typeof getOrdenesPeriodo>>) {
  return ordenes.map((o) => ({
    'N° Orden': o.nro_orden,
    Producto: o.ma_item?.nombre || '',
    Presentación: o.ma_presentacion?.nombre || '',
    'Plan (bot.)': o.cant_planificada,
    'Real (bot.)': o.cant_real ?? '',
    Estado: o.estado,
    'Fecha inicio': fmtFecha(o.fecha_inicio),
    'Fecha completada': fmtFecha(o.fecha_completada ?? undefined),
    Observaciones: o.observaciones || '',
  }));
}

function rowsTransferencias(trs: Awaited<ReturnType<typeof getTransferenciasPeriodo>>) {
  return trs.map((t) => ({
    'N° Transferencia': t.nro_transferencia || t.id.slice(0, 8),
    Origen: t.origen?.nombre || '',
    Destino: t.destino?.nombre || '',
    Estado: t.estado,
    'Fecha envío': fmtFecha(t.fecha_envio),
    'Fecha recepción': fmtFecha(t.fecha_recepcion ?? undefined),
    Observaciones: t.observaciones || '',
  }));
}

function rowsMovimientos(movs: Awaited<ReturnType<typeof getMovimientosPeriodo>>) {
  return movs.map((m) => ({
    Fecha: fmtFecha(m.fecha),
    Tipo: m.tipo_mov,
    Ítem: m.ma_item?.nombre || '',
    Código: m.ma_item?.codigo || '',
    Cantidad: m.cantidad,
    Ubicación: m.cat_ubicacion?.nombre || '',
    Motivo: m.motivo || '',
    Observación: m.observacion || '',
  }));
}

function rowsInventario(inv: Awaited<ReturnType<typeof getInventarioDetallado>>) {
  return inv.map((r) => ({
    Almacén: r.almacen_nombre,
    Código: r.codigo,
    Ítem: r.nombre,
    Tipo: r.tipo,
    Categoría: r.categoria,
    Stock: r.stock_total,
    Unidad: r.unidad_medida,
    'Stock mínimo': r.stock_minimo,
    'Bajo mínimo': r.bajo_minimo ? 'Sí' : 'No',
    Lotes: r.lotes_count,
  }));
}

async function buildResumenSheet(rango: RangoMes): Promise<ExcelSheet> {
  const { desde, hasta } = rango;
  const [resumenFin, ejecutivo] = await Promise.all([
    getResumenReportes(desde, hasta),
    getDashboardEjecutivoData(desde, hasta),
  ]);
  return {
    name: 'Resumen',
    rows: [
      { Concepto: 'Periodo', Valor: rango.label },
      { Concepto: 'Desde', Valor: rango.desde },
      { Concepto: 'Hasta', Valor: rango.hasta },
      { Concepto: 'Ventas totales (S/)', Valor: resumenFin.totalVentas },
      { Concepto: 'Unidades vendidas', Valor: resumenFin.ventas_unidades },
      { Concepto: 'Gastos totales (S/)', Valor: resumenFin.totalGastos },
      { Concepto: 'Balance operativo (S/)', Valor: resumenFin.balance },
      { Concepto: 'Producción completada (bot.)', Valor: resumenFin.produccion },
      { Concepto: 'Entradas insumo COMPRA (uds)', Valor: resumenFin.entradas_insumo_cantidad },
      { Concepto: 'Cant. ventas', Valor: resumenFin.ventas.length },
      { Concepto: 'Cant. gastos', Valor: resumenFin.gastos.length },
      { Concepto: 'Ajustes inventario (mov.)', Valor: ejecutivo.ajustesCount },
      { Concepto: 'Volumen ajustes (uds)', Valor: ejecutivo.ajustesVolumenAbs },
      { Concepto: 'Delta neto ajustes', Valor: ejecutivo.ajustesDeltaNeto },
      { Concepto: 'Impacto ajustes (% stock PT)', Valor: Number(ejecutivo.impactoAjustesPct.toFixed(2)) },
      { Concepto: 'Merma (mov.)', Valor: ejecutivo.mermaCount },
      { Concepto: 'Merma (uds)', Valor: ejecutivo.mermaVolumen },
      { Concepto: 'Cumplimiento producción (%)', Valor: Math.round(ejecutivo.prodCumplimiento * 100) },
      { Concepto: 'Alertas stock bajo mínimo', Valor: ejecutivo.alertasStock.length },
      { Concepto: 'Transferencias en tránsito', Valor: ejecutivo.transferenciasPendientes },
      { Concepto: 'Órdenes en borrador', Valor: ejecutivo.ordenesBorrador },
    ],
  };
}

/** Consulta y arma una sola hoja Excel — solo el módulo elegido */
export async function buildExportSheet(
  mesKey: string,
  modulo: ExportModuloId,
  rangoOverride?: { desde: string; hasta: string; label?: string },
): Promise<ExcelSheet> {
  const rango = rangoOverride
    ? { ...rangoMes(mesKey), desde: rangoOverride.desde, hasta: rangoOverride.hasta, label: rangoOverride.label ?? `${rangoOverride.desde} → ${rangoOverride.hasta}` }
    : rangoMes(mesKey);
  const { desde, hasta } = rango;

  switch (modulo) {
    case 'resumen':
      return buildResumenSheet(rango);
    case 'ventas':
      return { name: 'Ventas', rows: rowsVentas(await getVentasPeriodo(desde, hasta)) };
    case 'gastos':
      return { name: 'Gastos', rows: rowsGastos(await getGastosPeriodo(desde, hasta)) };
    case 'produccion':
      return { name: 'Producción', rows: rowsProduccion(await getOrdenesPeriodo(desde, hasta)) };
    case 'transferencias':
      return { name: 'Transferencias', rows: rowsTransferencias(await getTransferenciasPeriodo(desde, hasta)) };
    case 'compras':
      return { name: 'Compras', rows: rowsMovimientos(await getMovimientosPeriodo(desde, hasta, { tipo_mov: 'COMPRA' })) };
    case 'ajustes':
      return {
        name: 'Ajustes',
        rows: rowsMovimientos(await getMovimientosPeriodo(desde, hasta, { tipo_mov: ['AJUSTE_ING', 'AJUSTE_SAL'] })),
      };
    case 'movimientos':
      return { name: 'Movimientos', rows: rowsMovimientos(await getMovimientosPeriodo(desde, hasta)) };
    case 'inventario':
      return { name: 'Inventario', rows: rowsInventario(await getInventarioDetallado()) };
    default: {
      const _exhaustive: never = modulo;
      throw new Error(`Módulo desconocido: ${_exhaustive}`);
    }
  }
}

export function exportFilename(mesKey: string, modulo: ExportModuloId): string {
  return `BodegaSM_${mesKey}_${modulo}.xlsx`;
}

export function rangoFromMes(mesKey: string): RangoMes {
  return rangoMes(mesKey);
}

export function getModuloMeta(id: ExportModuloId): ExportModuloMeta | undefined {
  return EXPORT_MODULOS.find((m) => m.id === id);
}
