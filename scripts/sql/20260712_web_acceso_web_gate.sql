-- Gate web: documenta el contrato usado por la SPA.
-- Flags en public.app_user_role:
--   acceso_web   → permite login en la web ERP (si false → "Usuario sin acceso web")
--   acceso_app   → filtra módulos en la app Flutter
--   acceso_ventas→ filtra Ingresos/Egresos/Despacho en Flutter
-- La web NO filtra por acceso_ventas: con acceso_web el usuario usa todos los
-- módulos operativos; Materiales/Reportes siguen siendo adminOnly.

-- Ejemplo: revocar web a un usuario (sigue pudiendo usar la app si acceso_app):
-- UPDATE public.app_user_role SET acceso_web = false WHERE email = 'operario@ejemplo.com';

-- Ejemplo: habilitar web:
-- UPDATE public.app_user_role SET acceso_web = true, activo = true WHERE email = 'operario@ejemplo.com';
