export const TiposItem = ['GRANEL', 'INSUMO', 'EMPAQUE', 'PT', 'MATERIAL'] as const;
export type TipoItem = (typeof TiposItem)[number];

export const TiposMovimiento = [
  'COMPRA', 'PRODUCCION', 'AJUSTE_ING', 'TRF_ENTRADA', 'VENTA',
  'CONSUMO_PROD', 'MERMA', 'AJUSTE_SAL', 'TRF_SALIDA',
] as const;
export type TipoMov = (typeof TiposMovimiento)[number];

export const CanalesVenta = ['DIRECTO', 'TIENDA_PROPIA', 'MAYORISTA', 'DELIVERY', 'OTRO'] as const;
export const EstadosOrden = ['BORRADOR', 'COMPLETADA', 'ANULADA'] as const;
export const EstadosTransferencia = ['EN_TRANSITO', 'RECIBIDA', 'ANULADA'] as const;
export const TiposVenta = ['VENTA', 'MUESTRA', 'CONSIGNACION'] as const;

export const ENTRADA_TIPOS: TipoMov[] = ['COMPRA', 'PRODUCCION', 'AJUSTE_ING', 'TRF_ENTRADA'];
export const SALIDA_TIPOS: TipoMov[] = ['VENTA', 'CONSUMO_PROD', 'MERMA', 'AJUSTE_SAL', 'TRF_SALIDA'];
