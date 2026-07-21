/**
 * Listado de usuarios (admin) — consulta vía RPC.
 * La actualización de permisos permanece en API por compatibilidad, pero la UI es solo lectura.
 */
import { ErpRpc } from '../../config/erpContract';
import { callRpc } from './core';
import type { AppUserRoleRow } from '../../types';

export async function listarUsuariosAdmin(): Promise<AppUserRoleRow[]> {
  const data = await callRpc<AppUserRoleRow[]>(
    ErpRpc.usuariosListar,
    {},
    'No se pudo listar usuarios.',
  );
  return Array.isArray(data) ? data : [];
}

/** @deprecated Preferir gestión fuera de la web; la UI de Usuarios es solo lectura. */
export async function actualizarPermisosUsuario(opts: {
  userId: string;
  role?: string;
  activo?: boolean;
  accesoWeb?: boolean;
  accesoApp?: boolean;
  accesoVentas?: boolean;
  nombre?: string | null;
}): Promise<AppUserRoleRow> {
  return callRpc<AppUserRoleRow>(
    ErpRpc.usuarioActualizarPermisos,
    {
      p_user_id: opts.userId,
      p_role: opts.role ?? null,
      p_activo: opts.activo ?? null,
      p_acceso_web: opts.accesoWeb ?? null,
      p_acceso_app: opts.accesoApp ?? null,
      p_acceso_ventas: opts.accesoVentas ?? null,
      p_nombre: opts.nombre === undefined ? null : opts.nombre,
    },
    'No se pudieron actualizar los permisos.',
  );
}
