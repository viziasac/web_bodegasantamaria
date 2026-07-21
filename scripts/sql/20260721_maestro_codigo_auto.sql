-- Auto-generación de codigo en ma_proveedor / ma_cliente (INSERT, si codigo vacío)
-- Prefijos: PROV-0001, CLI-0001 (secuencia por prefijo numérico)

CREATE OR REPLACE FUNCTION public.fn_maestro_siguiente_codigo(p_tabla text, p_prefijo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_max int := 0;
  v_next int;
  v_codigo text;
  v_pattern text;
BEGIN
  p_prefijo := upper(trim(p_prefijo));
  v_pattern := '^' || p_prefijo || '-([0-9]+)$';

  IF p_tabla = 'ma_proveedor' THEN
    SELECT COALESCE(MAX((regexp_match(upper(codigo), v_pattern))[1]::int), 0)
    INTO v_max
    FROM public.ma_proveedor
    WHERE codigo IS NOT NULL AND upper(codigo) ~ v_pattern;
  ELSIF p_tabla = 'ma_cliente' THEN
    SELECT COALESCE(MAX((regexp_match(upper(codigo), v_pattern))[1]::int), 0)
    INTO v_max
    FROM public.ma_cliente
    WHERE codigo IS NOT NULL AND upper(codigo) ~ v_pattern;
  ELSE
    RAISE EXCEPTION 'Tabla no soportada: %', p_tabla;
  END IF;

  v_next := v_max + 1;
  v_codigo := p_prefijo || '-' || lpad(v_next::text, 4, '0');
  RETURN v_codigo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_ma_proveedor_codigo_auto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := public.fn_maestro_siguiente_codigo('ma_proveedor', 'PROV');
  ELSE
    NEW.codigo := upper(btrim(NEW.codigo));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_ma_cliente_codigo_auto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := public.fn_maestro_siguiente_codigo('ma_cliente', 'CLI');
  ELSE
    NEW.codigo := upper(btrim(NEW.codigo));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_ma_proveedor_codigo_auto ON public.ma_proveedor;
CREATE TRIGGER tg_ma_proveedor_codigo_auto
  BEFORE INSERT ON public.ma_proveedor
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_ma_proveedor_codigo_auto();

DROP TRIGGER IF EXISTS tg_ma_cliente_codigo_auto ON public.ma_cliente;
CREATE TRIGGER tg_ma_cliente_codigo_auto
  BEFORE INSERT ON public.ma_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_ma_cliente_codigo_auto();
