/** Política alineada con Supabase Auth (scripts/configure-supabase-auth-security.ps1) */
export const AUTH_PASSWORD_MIN_LENGTH = 8;

export function validateLoginEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return 'Ingrese un correo electrónico válido.';
  }
  return null;
}

export function validateLoginPassword(password: string): string | null {
  if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres (política Supabase).`;
  }
  if (password.length > 128) {
    return 'La contraseña es demasiado larga.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir letras y números (política Supabase).';
  }
  return null;
}

export function mapSupabaseAuthError(error: { message?: string; status?: number; code?: string }): string {
  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();

  if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Demasiados intentos. Espere unos minutos e intente de nuevo.';
  }
  if (msg.includes('invalid api key') || code === 'invalid_api_key') {
    return 'Error de conexión con Supabase. Verifique VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Cloudflare (debe ser la clave anon JWT, no sb_publishable_).';
  }
  if (msg.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Debe confirmar su correo antes de ingresar. En Supabase Dashboard marque "Auto Confirm User" al crear usuarios.';
  }
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    code === 'invalid_credentials'
  ) {
    return 'Correo o contraseña incorrectos. Si creó el usuario en Supabase, verifique la contraseña (mín. 8 caracteres, letras y números) o restablézcala en Authentication → Users.';
  }
  if (msg.includes('user banned')) {
    return 'Usuario bloqueado. Contacte al administrador.';
  }
  return 'No se pudo iniciar sesión. Verifique correo y contraseña.';
}
