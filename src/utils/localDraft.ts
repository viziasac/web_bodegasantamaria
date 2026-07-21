/**
 * Persistencia genérica de borradores en localStorage.
 * Usar createLocalDraftStorage para drafts de dominio tipados.
 */

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function removeJson(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function createLocalDraftStorage<T extends object>(
  key: string,
  normalize?: (parsed: T) => T,
) {
  return {
    load(): T | null {
      const parsed = loadJson<T>(key);
      if (!parsed) return null;
      return normalize ? normalize(parsed) : parsed;
    },
    save(draft: T): void {
      saveJson(key, draft);
    },
    clear(): void {
      removeJson(key);
    },
  };
}
