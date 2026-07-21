/** Borrador de carrito Ingresos POS (equivalente Hive de Flutter). */
import { createLocalDraftStorage } from './localDraft';

const STORAGE_KEY = 'bodega_ingresos_cart_draft_v1';

export type ModoVentaIngresos = 'agrupada' | 'rapida';

export interface IngresosCartLineDraft {
  presentacionId: string;
  /** Ítem PT — stock compartido entre presentaciones del SKU */
  itemId?: string;
  nombre: string;
  cantidadBotellas: number;
  precioUnitarioBotella: number;
}

export interface IngresosCartDraft {
  modo: ModoVentaIngresos;
  ubicacionId?: string;
  ubicacionNombre?: string;
  fecha?: string;
  clienteId?: string;
  clienteTexto?: string;
  nroDoc?: string;
  tipoDoc?: string;
  moneda?: string;
  canal?: string;
  observaciones?: string;
  cart: IngresosCartLineDraft[];
}

const store = createLocalDraftStorage<IngresosCartDraft>(STORAGE_KEY, (parsed) => ({
  ...parsed,
  cart: Array.isArray(parsed.cart) ? parsed.cart : [],
  modo: parsed.modo === 'rapida' ? 'rapida' : 'agrupada',
}));

export const loadIngresosCartDraft = store.load;
export const saveIngresosCartDraft = store.save;
export const clearIngresosCartDraft = store.clear;
