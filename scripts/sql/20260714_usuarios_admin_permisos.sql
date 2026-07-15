-- Usuarios admin: listar y actualizar permisos (app_user_role)
-- Aplicado en cloud: usuarios_admin_permisos + fix_fn_usuario_actualizar_permisos_return

-- SELECT: propia fila OR is_admin()
DROP POLICY IF EXISTS pol_app_user_role_select ON public.app_user_role;
CREATE POLICY pol_app_user_role_select ON public.app_user_role
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.fn_usuarios_listar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO', 'error', 'Solo administradores pueden listar usuarios.');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.role, t.email), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      user_id,
      email,
      nombre,
      role,
      activo,
      acceso_web,
      acceso_app,
      acceso_ventas,
      acceso_completo,
      updated_at
    FROM public.app_user_role
  ) t;

  RETURN jsonb_build_object('ok', true, 'data', v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_usuario_actualizar_permisos(
  p_user_id uuid,
  p_role text DEFAULT NULL,
  p_activo boolean DEFAULT NULL,
  p_acceso_web boolean DEFAULT NULL,
  p_acceso_app boolean DEFAULT NULL,
  p_acceso_ventas boolean DEFAULT NULL,
  p_nombre text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_target public.app_user_role%ROWTYPE;
  v_admin_count int;
  v_new_role text;
  v_new_activo boolean;
  v_new_web boolean;
  v_out jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO', 'error', 'Solo administradores pueden cambiar permisos.');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'user_id obligatorio.');
  END IF;

  SELECT * INTO v_target FROM public.app_user_role WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ENCONTRADO', 'error', 'Usuario no encontrado en app_user_role.');
  END IF;

  v_role := lower(trim(COALESCE(p_role, v_target.role)));
  IF v_role NOT IN ('admin', 'administrador', 'supervisor', 'operario') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Rol no permitido. Use admin, administrador, supervisor u operario.');
  END IF;

  v_new_role := v_role;
  v_new_activo := COALESCE(p_activo, v_target.activo);
  v_new_web := COALESCE(p_acceso_web, v_target.acceso_web);

  IF p_user_id = auth.uid() THEN
    IF v_new_activo IS FALSE THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'No puede desactivar su propia cuenta.');
    END IF;
    IF v_new_web IS FALSE THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'No puede quitarse a sí mismo el acceso web.');
    END IF;
    IF v_new_role NOT IN ('admin', 'administrador') THEN
      SELECT count(*) INTO v_admin_count
      FROM public.app_user_role
      WHERE COALESCE(activo, true) = true
        AND lower(COALESCE(role, '')) IN ('admin', 'administrador')
        AND user_id <> auth.uid();
      IF v_admin_count < 1 THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Debe quedar al menos un administrador activo.');
      END IF;
    END IF;
  END IF;

  IF lower(COALESCE(v_target.role, '')) IN ('admin', 'administrador')
     AND COALESCE(v_target.activo, true) = true
     AND (
       v_new_role NOT IN ('admin', 'administrador')
       OR v_new_activo IS FALSE
     )
  THEN
    SELECT count(*) INTO v_admin_count
    FROM public.app_user_role
    WHERE COALESCE(activo, true) = true
      AND lower(COALESCE(role, '')) IN ('admin', 'administrador')
      AND user_id <> p_user_id;
    IF v_admin_count < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Debe quedar al menos un administrador activo.');
    END IF;
  END IF;

  UPDATE public.app_user_role SET
    role = v_new_role,
    activo = v_new_activo,
    acceso_web = v_new_web,
    acceso_app = COALESCE(p_acceso_app, acceso_app),
    acceso_ventas = COALESCE(p_acceso_ventas, acceso_ventas),
    nombre = CASE
      WHEN p_nombre IS NULL THEN nombre
      ELSE NULLIF(trim(p_nombre), '')
    END,
    updated_at = now()
  WHERE user_id = p_user_id;

  SELECT jsonb_build_object(
    'user_id', user_id,
    'email', email,
    'nombre', nombre,
    'role', role,
    'activo', activo,
    'acceso_web', acceso_web,
    'acceso_app', acceso_app,
    'acceso_ventas', acceso_ventas,
    'acceso_completo', acceso_completo,
    'updated_at', updated_at
  ) INTO v_out
  FROM public.app_user_role WHERE user_id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'data', v_out);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_usuarios_listar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_usuario_actualizar_permisos(uuid, text, boolean, boolean, boolean, boolean, text) TO authenticated;
