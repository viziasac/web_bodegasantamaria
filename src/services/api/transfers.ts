/**
 * Transferencias entre ubicaciones.
 */
import { supabase } from '../supabaseClient';
import { Tables } from '../../config/supabaseTables';
import { ErpRpc } from '../../config/erpContract';
import { newTxnId } from '../../utils/txnId';
import { callRpc, getUserId } from './core';
import { getLotesDisponibles } from './inventory';
import type { TrnTransferencia, TransferLinea } from '../../types';

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
  const data = await callRpc<string | { transferencia_id?: string }>(ErpRpc.transferenciaRegistrar, {
    p_txn_id: opts.txnId ?? newTxnId(),
    p_origen_id: opts.origenId,
    p_destino_id: opts.destinoId,
    p_observaciones: opts.observaciones ?? null,
    p_usuario_id: uid ?? null,
    p_lineas: lineasExpandidas.map((l) => ({
      item_id: l.presentacion_id ? null : (l.item_id ?? null),
      presentacion_id: l.presentacion_id ?? null,
      lote_id: l.lote_id,
      cantidad: l.cantidad,
    })),
  }, 'No se pudo registrar la transferencia.');
  return typeof data === 'string' ? data : String(data);
}

export async function confirmarRecepcionTransferencia(transferenciaId: string) {
  const uid = await getUserId();
  await callRpc(ErpRpc.transferenciaRecibir, {
    p_transferencia_id: transferenciaId,
    p_usuario_id: uid ?? null,
  }, 'No se pudo confirmar la recepción.');
}
