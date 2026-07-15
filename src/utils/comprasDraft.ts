/** Borrador modo documento de Ingreso Insumos. */

const STORAGE_KEY = 'bodega_compras_doc_draft_v1';

export interface ComprasDocDraft {
  ubicacionId?: string;
  proveedorId?: string;
  referencia?: string;
  observaciones?: string;
  docLineas: Array<{
    key: string;
    item_id: string;
    cantidad: number;
    precio_unitario?: number;
    itemLabel?: string;
  }>;
}

export function loadComprasDocDraft(): ComprasDocDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComprasDocDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...parsed, docLineas: Array.isArray(parsed.docLineas) ? parsed.docLineas : [] };
  } catch {
    return null;
  }
}

export function saveComprasDocDraft(draft: ComprasDocDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch { /* ignore */ }
}

export function clearComprasDocDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
