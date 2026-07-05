/**
 * Supabase — misma configuración que lib/config/supabase_config.dart (app INPUT).
 * Las variables VITE_* en .env.local / Cloudflare Pages pueden sobreescribir estos valores.
 *
 * Cloudflare: use SOLO la clave anon JWT (eyJ...), NO sb_publishable_...
 */
export const SupabaseConfig = {
  /** Project ID: cztnnkxvwiwpeifqygta */
  url: 'https://cztnnkxvwiwpeifqygta.supabase.co',
  /** JWT anon key — idéntica a SupabaseConfig.supabaseAnonKey en Flutter */
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6dG5ua3h2d2l3cGVpZnF5Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MzA0MDUsImV4cCI6MjA5MTUwNjQwNX0.t-4WSXhkbeauHw-VBvjfkBO-D2LOe0J2Vw64-qnkaiA',
  sessionTimeoutMinutes: 60,
} as const;

const PLACEHOLDER_KEYS = new Set([
  '',
  'your-anon-key-here',
  'placeholder',
  'placeholder-key-for-ci-build',
]);

function isLegacyAnonJwt(key: string): boolean {
  return key.startsWith('eyJ') && key.split('.').length === 3;
}

export function getSupabaseUrl(): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_URL?.trim();
  const url = fromEnv || SupabaseConfig.url;
  if (fromEnv && !fromEnv.includes('supabase.co')) {
    console.warn('[Supabase] VITE_SUPABASE_URL no parece válida; usando valor embebido.');
    return SupabaseConfig.url;
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const key = fromEnv || SupabaseConfig.anonKey;

  if (PLACEHOLDER_KEYS.has(key)) {
    return SupabaseConfig.anonKey;
  }

  if (key.startsWith('sb_publishable_')) {
    console.warn(
      '[Supabase] VITE_SUPABASE_ANON_KEY es publishable (sb_publishable_). ' +
      'Auth requiere la clave anon JWT (eyJ...). Usando clave embebida.',
    );
    return SupabaseConfig.anonKey;
  }

  if (fromEnv && !isLegacyAnonJwt(key)) {
    console.warn('[Supabase] VITE_SUPABASE_ANON_KEY no parece JWT anon; usando clave embebida.');
    return SupabaseConfig.anonKey;
  }

  return key;
}

/** Diagnóstico en consola (login / soporte) */
export function logSupabaseConfigHint(): void {
  if (import.meta.env.DEV) {
    console.info('[Supabase]', getSupabaseUrl(), '· anon JWT', isLegacyAnonJwt(getSupabaseAnonKey()) ? 'OK' : 'fallback');
  }
}
