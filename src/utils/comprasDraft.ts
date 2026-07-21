/** Borrador modo documento de Ingreso Insumos. */
import { createLocalDraftStorage } from './localDraft';

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

const store = createLocalDraftStorage<ComprasDocDraft>(STORAGE_KEY, (parsed) => ({
  ...parsed,
  docLineas: Array.isArray(parsed.docLineas) ? parsed.docLineas : [],
}));

export const loadComprasDocDraft = store.load;
export const saveComprasDocDraft = store.save;
export const clearComprasDocDraft = store.clear;
