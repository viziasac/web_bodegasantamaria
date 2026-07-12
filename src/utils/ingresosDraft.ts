/** Borrador de carrito Ingresos POS (equivalente Hive de Flutter). */

const STORAGE_KEY = 'bodega_ingresos_cart_draft_v1';

export type ModoVentaIngresos = 'agrupada' | 'rapida';

export interface IngresosCartLineDraft {
  presentacionId: string;
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

export function loadIngresosCartDraft(): IngresosCartDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IngresosCartDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
      modo: parsed.modo === 'rapida' ? 'rapida' : 'agrupada',
    };
  } catch {
    return null;
  }
}

export function saveIngresosCartDraft(draft: IngresosCartDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

export function clearIngresosCartDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
