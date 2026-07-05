/** Contrato ERP app ↔ Supabase (port de erp_contract.dart) */

export const ErpErrorCode = {
  stockInsuficiente: 'STOCK_INSUFICIENTE',
  estadoInvalido: 'ESTADO_INVALIDO',
  noEncontrado: 'NO_ENCONTRADO',
  referenciaInvalida: 'REFERENCIA_INVALIDA',
  duplicado: 'DUPLICADO',
  ubicacionNoConfigurada: 'UBICACION_NO_CONFIGURADA',
  datosInvalidos: 'DATOS_INVALIDOS',
  desconocido: 'DESCONOCIDO',
} as const;

export const ErpErrorMessages: Record<string, string> = {
  [ErpErrorCode.stockInsuficiente]: 'Stock insuficiente para completar la operación.',
  [ErpErrorCode.estadoInvalido]: 'La operación no es válida para el estado actual del documento.',
  [ErpErrorCode.noEncontrado]: 'El registro no fue encontrado.',
  [ErpErrorCode.referenciaInvalida]: 'Referencia inválida (ubicación, lote, ítem o presentación).',
  [ErpErrorCode.duplicado]: 'La operación ya fue registrada.',
  [ErpErrorCode.ubicacionNoConfigurada]: 'Falta configurar una ubicación requerida (ALM_MP / ALM_GR / ALM_PT).',
  [ErpErrorCode.datosInvalidos]: 'Datos incompletos o inválidos.',
  [ErpErrorCode.desconocido]: 'Ocurrió un error inesperado.',
};

export const ErpRpc = {
  generarNroOrden: 'fn_generar_nro_orden',
  generarNroVenta: 'fn_generar_nro_venta',
  generarNroTransferencia: 'fn_generar_nro_transferencia',
  generarNroLote: 'fn_generar_nro_lote',
  validarStockDisponible: 'fn_validar_stock_disponible',
  validarInsumosOrden: 'fn_validar_insumos_orden',
  calcularTotalVenta: 'fn_calcular_total_venta',
  resumenStockItems: 'fn_resumen_stock_items',
  itemsBajoStockMinimo: 'fn_items_bajo_stock_minimo',
  ventaRegistrar: 'fn_venta_registrar',
  transferenciaRegistrar: 'fn_transferencia_registrar',
  transferenciaRecibir: 'fn_transferencia_recibir',
  compraRegistrar: 'fn_compra_registrar',
  compraRegistrarDoc: 'fn_compra_registrar_doc',
  ordenCompletar: 'fn_orden_completar',
  anularOrden: 'fn_anular_orden',
  granelRegistrar: 'fn_granel_registrar',
  reempaqueRegistrar: 'fn_reempaque_registrar',
  ajusteRegistrar: 'fn_ajuste_registrar',
  gastoRegistrar: 'fn_gasto_registrar',
  historialMovimientos: 'fn_historial_movimientos',
  trazabilidadLote: 'fn_trazabilidad_lote',
  reporteVentasPeriodo: 'fn_reporte_ventas_periodo',
  reporteGastosPeriodo: 'fn_reporte_gastos_periodo',
} as const;

export interface RpcResult<T = unknown> {
  ok: boolean;
  error_code?: string;
  error?: string;
  data?: T;
}
