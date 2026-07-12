-- Migraciones aplicadas en Supabase (proyecto cztnnkxvwiwpeifqygta)
-- 2026-07-12 — Maestros web admin: is_admin + INSERT/UPDATE sin DELETE en materiales/SKUs
-- Recetas: INSERT/UPDATE/DELETE (solo líneas BOM) para admin.
-- Actualización: ver 20260712_is_admin_app_user_role.sql (JWT O app_user_role).

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

-- ma_item / ma_presentacion / ma_empaque_tipo: INSERT+UPDATE only (no DELETE)
-- rec_receta: INSERT+UPDATE+DELETE for admin
-- Ver historial MCP: web_admin_maestros_no_delete, web_admin_receta_allow_delete_line, is_admin_app_user_role
