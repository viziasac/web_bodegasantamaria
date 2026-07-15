import { ErpErrorMessages, ErpErrorCode } from '../config/erpContract';
import type { RpcResult } from '../config/erpContract';

export function messageFromRpc(res: RpcResult): string {
  if (res.error) return res.error;
  if (res.error_code && ErpErrorMessages[res.error_code]) {
    return ErpErrorMessages[res.error_code];
  }
  return ErpErrorMessages[ErpErrorCode.desconocido] || 'Ocurrió un error inesperado.';
}

export function friendlyDbError(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: string; constraint?: string };
  const blob = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.constraint ?? ''}`.toLowerCase();
  if (err?.code === '23505') {
    if (blob.includes('uq_receta') || blob.includes('rec_receta') || blob.includes('item_componente')) {
      return 'Ese componente ya está en la receta de este producto.';
    }
    return 'Operación duplicada (ya registrada).';
  }
  if (err?.code === '23503') return 'Referencia inválida (ubicación, lote o ítem).';
  if (err?.code === '42703' && err.message) {
    return 'Error de consulta en base de datos. Recargue la página e intente de nuevo.';
  }
  if (err?.code === 'P0001' && err.message) return err.message;
  if (err?.message) return err.message;
  if (err?.details) return err.details;
  return String(e);
}

/** Normaliza cualquier excepción (PostgrestError, Error, string) para mostrar en UI. */
export function toUserMessage(err: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = friendlyDbError(err);
    if (msg && msg !== '[object Object]') return msg;
  }
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}
