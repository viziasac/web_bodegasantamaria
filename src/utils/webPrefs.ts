/** Preferencias locales de la web ERP. */

const STORAGE_KEY = 'bodega_web_prefs_v1';

export interface WebPrefs {
  defaultPvId?: string;
  defaultCanal?: string;
}

export function loadWebPrefs(): WebPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WebPrefs;
  } catch {
    return {};
  }
}

export function saveWebPrefs(prefs: WebPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
