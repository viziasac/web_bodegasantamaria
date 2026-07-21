/** Borrador carrito de egresos (localStorage). */

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

export function loadEgresosCartDraft(): EgresosCartDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EgresosCartDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...parsed, cart: Array.isArray(parsed.cart) ? parsed.cart : [] };
  } catch {
    return null;
  }
}

export function saveEgresosCartDraft(draft: EgresosCartDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch { /* ignore */ }
}

export function clearEgresosCartDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
