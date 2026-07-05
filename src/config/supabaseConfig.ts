/**
 * Supabase — misma configuración que lib/config/supabase_config.dart (app INPUT).
 * Las variables VITE_* en .env.local pueden sobreescribir estos valores.
 */
export const SupabaseConfig = {
  /** Project ID: cztnnkxvwiwpeifqygta */
  url: 'https://cztnnkxvwiwpeifqygta.supabase.co',
  /** JWT anon key — idéntica a SupabaseConfig.supabaseAnonKey en Flutter */
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6dG5ua3h2d2l3cGVpZnF5Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MzA0MDUsImV4cCI6MjA5MTUwNjQwNX0.t-4WSXhkbeauHw-VBvjfkBO-D2LOe0J2Vw64-qnkaiA',
  sessionTimeoutMinutes: 60,
} as const;

export function getSupabaseUrl(): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_URL?.trim();
  return fromEnv || SupabaseConfig.url;
}

export function getSupabaseAnonKey(): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const key = fromEnv || SupabaseConfig.anonKey;
  // Rechazar placeholders que causan "Invalid API key"
  if (
    !key ||
    key === 'your-anon-key-here' ||
    key === 'placeholder' ||
    key === 'placeholder-key-for-ci-build'
  ) {
    return SupabaseConfig.anonKey;
  }
  return key;
}
