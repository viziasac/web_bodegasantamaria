/**
 * Escrituras RPC: compras, ajustes, granel, reempaque, ventas, gastos, órdenes.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { ErpRpc } from '../../config/erpContract';
import { friendlyDbError } from '../../utils/erpErrors';
import { newTxnId } from '../../utils/txnId';
import { callRpc, getUserId } from './core';
import { resolveItemId, resolveLoteAllocationsFifo } from './inventory';
import type { CompraLinea, VentaLinea } from '../../types';

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
  const data = await callRpc<string | { compra_id?: string }>(ErpRpc.compraRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_item_id: opts.itemId,
    p_ubicacion_id: opts.ubicacionId,
    p_cantidad: Math.abs(opts.cantidad),
    p_precio_unitario: opts.precioUnitario ?? null,
    p_motivo: opts.motivo ?? null,
    p_observacion: opts.observacion ?? null,
    p_fecha_vencimiento: opts.fechaVencimiento ?? null,
    p_usuario_id: uid ?? null,
  }, 'No se pudo registrar la compra.');
  return typeof data === 'string' ? data : String(data);
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
  const data = await callRpc<string | { compra_id?: string }>(ErpRpc.compraRegistrarConGasto, {
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
  }, 'No se pudo registrar la compra con egreso.');
  return typeof data === 'string' ? data : String(data);
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
  const data = await callRpc<string | { venta_id?: string }>(ErpRpc.ventaRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_ubicacion_id: opts.ubicacionId,
    p_canal: opts.canal,
    p_tipo: opts.tipo ?? 'VENTA',
    p_cliente_id: opts.clienteId ?? null,
    p_observaciones: opts.observaciones ?? null,
    p_usuario_id: uid ?? null,
    p_lineas: opts.lineas,
  }, 'No se pudo registrar la venta.');
  return typeof data === 'string' ? data : String(data);
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
