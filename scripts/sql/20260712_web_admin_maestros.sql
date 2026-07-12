-- Migraciones aplicadas en Supabase (proyecto cztnnkxvwiwpeifqygta)
-- 2026-07-12 — Maestros web admin: is_admin + INSERT/UPDATE sin DELETE en materiales/SKUs
-- Recetas: INSERT/UPDATE/DELETE (solo líneas BOM) para admin.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'administrador'),
    false
  );
$function$;

-- ma_item / ma_presentacion / ma_empaque_tipo: INSERT+UPDATE only (no DELETE)
-- rec_receta: INSERT+UPDATE+DELETE for admin
-- Ver historial MCP: web_admin_maestros_no_delete, web_admin_receta_allow_delete_line
