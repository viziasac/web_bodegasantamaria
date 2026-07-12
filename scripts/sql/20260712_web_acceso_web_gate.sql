-- Gate web: documenta el contrato usado por la SPA.
-- Flags en public.app_user_role:
--   acceso_web   → permite login en la web ERP (si false → "Usuario sin acceso web")
--   acceso_app   → filtra módulos / escrituras en la app Flutter
--   acceso_ventas→ filtra Ingresos / Egresos / Despacho en Flutter Y en la web
--                  (alineado a RLS fn_user_puede_escribir_ventas)
-- Materiales/Reportes siguen siendo adminOnly en la web.

-- Ejemplo: revocar web a un usuario (sigue pudiendo usar la app si acceso_app):
-- UPDATE public.app_user_role SET acceso_web = false WHERE email = 'operario@ejemplo.com';

-- Ejemplo: habilitar web sin ventas:
-- UPDATE public.app_user_role SET acceso_web = true, acceso_ventas = false, activo = true WHERE email = 'operario@ejemplo.com';

-- Ejemplo: habilitar web + ventas:
-- UPDATE public.app_user_role SET acceso_web = true, acceso_ventas = true, activo = true WHERE email = 'operario@ejemplo.com';
