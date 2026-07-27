/**
 * Núcleo compartido de la capa API (Supabase / RPC).
 */
import { supabase } from '../supabaseClient';
import { type RpcResult } from '../../config/erpContract';
import { messageFromRpc, friendlyDbError } from '../../utils/erpErrors';
import type { StockResumenItem } from '../../types';

/** Supabase devuelve numeric como string en muchos campos */
export function parseNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function normalizeStockRow(r: Record<string, unknown>): StockResumenItem {
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

export async function getUserId(): Promise<string | undefined> {
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

/** Extract a usable string ID from an RPC result that may be string or object. */
export function rpcResultId(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (key.endsWith('_id') || key === 'id') {
        return String((data as Record<string, unknown>)[key]);
      }
    }
  }
  return String(data ?? '');
}

export { hoyYmd, inicioMesYmd } from '../../utils/fechaLocal';
