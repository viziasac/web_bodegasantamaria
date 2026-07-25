-- Auditoría 2026-07-25: anulación compra robusta + assert en reempaque
-- Aplicado en proyecto cztnnkxvwiwpeifqygta

CREATE OR REPLACE FUNCTION public.fn_compra_origen_ids(p_txn uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY(
    SELECT DISTINCT x FROM unnest(
      ARRAY[p_txn] || COALESCE(
        (SELECT array_agg(id) FROM cmp_compra WHERE txn_id = p_txn),
        ARRAY[]::uuid[]
      )
    ) AS t(x)
    WHERE x IS NOT NULL
  );
$$;

-- Ver migración remota: DROP + CREATE fn_compra_anular_desde_gasto
-- y CREATE OR REPLACE fn_reempaque_registrar con fn_assert_item_ubicacion.
-- REVOKE EXECUTE fn_assert_item_ubicacion FROM PUBLIC/anon.
