import { supabase } from './supabaseClient';
import { Tables } from '../config/supabaseTables';
import type { AppUser, UserRole } from '../types';

export const WEB_ACCESS_DENIED_MESSAGE =
  'Usuario sin acceso web. Contacte al administrador para habilitar el permiso acceso_web.';

export interface UserRoleProfile {
  role: UserRole;
  nombre: string | null;
  email: string | null;
  activo: boolean;
  accesoWeb: boolean;
  accesoApp: boolean;
  accesoVentas: boolean;
}

const DEFAULT_PROFILE: UserRoleProfile = {
  role: 'operario',
  nombre: null,
  email: null,
  activo: true,
  accesoWeb: true,
  accesoApp: true,
  accesoVentas: true,
};

function flagFrom(v: unknown, fallback = true): boolean {
  if (v == null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return fallback;
}

function normalizeRole(raw: unknown, fallback: UserRole = 'operario'): UserRole {
  const r = String(raw ?? '').trim().toLowerCase();
  if (r === 'admin' || r === 'administrador' || r === 'supervisor' || r === 'operario') {
    return r;
  }
  return fallback;
}

/**
 * Perfil desde `app_user_role` (uid o email), alineado a Flutter `fetchUserRoleProfile`.
 * Defaults = acceso total si no hay fila (mismo contrato app).
 * Si RLS bloquea la lectura (p.ej. usuario inactivo) → denegar acceso web.
 */
export async function fetchUserRoleProfile(opts: {
  userId: string;
  email?: string | null;
  appMetadataRole?: string | null;
}): Promise<UserRoleProfile> {
  const metaRole = opts.appMetadataRole?.trim();
  const denyProfile = (): UserRoleProfile => ({
    role: metaRole ? normalizeRole(metaRole) : 'operario',
    nombre: null,
    email: opts.email ?? null,
    activo: false,
    accesoWeb: false,
    accesoApp: false,
    accesoVentas: false,
  });

  try {
    let row: Record<string, unknown> | null = null;

    const byId = await supabase
      .from(Tables.appUserRole)
      .select('user_id, email, nombre, role, activo, acceso_web, acceso_app, acceso_ventas')
      .eq('user_id', opts.userId)
      .maybeSingle();

    // Error de lectura (RLS / red): no abrir la web por defecto
    if (byId.error) return denyProfile();
    if (byId.data) row = byId.data as Record<string, unknown>;

    if (!row && opts.email?.trim()) {
      const byEmail = await supabase
        .from(Tables.appUserRole)
        .select('user_id, email, nombre, role, activo, acceso_web, acceso_app, acceso_ventas')
        .eq('email', opts.email.trim())
        .maybeSingle();
      if (byEmail.error) return denyProfile();
      if (byEmail.data) row = byEmail.data as Record<string, unknown>;
    }

    if (!row) {
      return {
        ...DEFAULT_PROFILE,
        email: opts.email ?? null,
        // Prioridad Flutter: app_user_role → app_metadata → operario
        role: metaRole ? normalizeRole(metaRole) : 'operario',
      };
    }

    const profileRole = row.role ? normalizeRole(row.role) : null;
    return {
      role: profileRole ?? (metaRole ? normalizeRole(metaRole) : 'operario'),
      nombre: row.nombre != null ? String(row.nombre) : null,
      email: row.email != null ? String(row.email) : (opts.email ?? null),
      activo: flagFrom(row.activo, true),
      accesoWeb: flagFrom(row.acceso_web, true),
      accesoApp: flagFrom(row.acceso_app, true),
      accesoVentas: flagFrom(row.acceso_ventas, true),
    };
  } catch {
    return denyProfile();
  }
}

/** Gate web: requiere activo + acceso_web. */
export function assertWebAccess(profile: UserRoleProfile): void {
  if (!profile.activo) {
    throw new Error('Usuario inactivo. Contacte al administrador.');
  }
  if (!profile.accesoWeb) {
    throw new Error(WEB_ACCESS_DENIED_MESSAGE);
  }
}

export function profileToAppUser(
  authUser: { id: string; email?: string | null },
  profile: UserRoleProfile,
): AppUser {
  return {
    id: authUser.id,
    email: authUser.email || profile.email || '',
    role: profile.role,
    nombre: profile.nombre,
    accesoWeb: profile.accesoWeb,
    accesoApp: profile.accesoApp,
    accesoVentas: profile.accesoVentas,
  };
}

/**
 * Resuelve perfil post-auth y valida acceso web.
 * Si falla el gate, cierra sesión para no dejar JWT activo.
 */
export async function resolveAuthenticatedWebUser(authUser: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | { role?: string };
}): Promise<AppUser> {
  const profile = await fetchUserRoleProfile({
    userId: authUser.id,
    email: authUser.email,
    appMetadataRole: typeof authUser.app_metadata?.role === 'string'
      ? authUser.app_metadata.role
      : undefined,
  });

  try {
    assertWebAccess(profile);
  } catch (err) {
    await supabase.auth.signOut();
    throw err;
  }

  return profileToAppUser(authUser, profile);
}
