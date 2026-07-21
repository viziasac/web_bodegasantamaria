/** Borrador carrito de egresos (localStorage). */
import { createLocalDraftStorage } from './localDraft';

const STORAGE_KEY = 'bodega_egresos_cart_draft_v1';

export interface EgresosCartDraft {
  fecha?: string;
  moneda?: string;
  centroCosto?: string;
  cart: Array<{
    id: string;
    descripcion: string;
    monto: number;
    categoriaId: string;
    categoriaNombre?: string;
    proveedorId?: string;
    proveedorNombre?: string;
    tipoDocumento?: string;
    nroDocumento?: string;
  }>;
}

const store = createLocalDraftStorage<EgresosCartDraft>(STORAGE_KEY, (parsed) => ({
  ...parsed,
  cart: Array.isArray(parsed.cart) ? parsed.cart : [],
}));

export const loadEgresosCartDraft = store.load;
export const saveEgresosCartDraft = store.save;
export const clearEgresosCartDraft = store.clear;
