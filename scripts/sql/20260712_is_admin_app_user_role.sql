-- is_admin: JWT app_metadata.role OR fila activa en app_user_role
-- Proyecto: cztnnkxvwiwpeifqygta
-- Aplicada vía MCP: is_admin_app_user_role (2026-07-12)
-- No cambia firmas de RPC write. Compatible con Flutter (sigue aceptando JWT).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'administrador')
    OR EXISTS (
      SELECT 1
      FROM public.app_user_role r
      WHERE r.user_id = auth.uid()
        AND COALESCE(r.activo, true) = true
        AND lower(COALESCE(r.role, '')) IN ('admin', 'administrador')
    ),
    false
  );
$function$;

COMMENT ON FUNCTION public.is_admin() IS
  'Admin si JWT app_metadata.role IN (admin,administrador) O app_user_role activa con ese role.';
