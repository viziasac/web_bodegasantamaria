-- Política almacén ↔ tipo de ítem (web + móvil)
-- ALM_GR → GRANEL
-- ALM_MP → INSUMO | EMPAQUE | MATERIAL
-- ALM_PT / PV → PT
-- TRANSIT → sin movimientos manuales (compra/ajuste)

CREATE OR REPLACE FUNCTION public.fn_assert_item_ubicacion(
  p_item_id uuid,
  p_ubicacion_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item_tipo text;
  v_ubi_codigo text;
  v_es_pv boolean;
BEGIN
  IF p_item_id IS NULL OR p_ubicacion_id IS NULL THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: Ítem y ubicación son requeridos' USING ERRCODE = 'P0001';
  END IF;

  SELECT upper(trim(tipo)) INTO v_item_tipo
    FROM ma_item WHERE id = p_item_id;
  SELECT upper(trim(codigo)), COALESCE(es_punto_venta, false)
    INTO v_ubi_codigo, v_es_pv
    FROM cat_ubicacion WHERE id = p_ubicacion_id;

  IF v_item_tipo IS NULL THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: Ítem no encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_ubi_codigo IS NULL THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: Ubicación no encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_ubi_codigo = 'TRANSIT' THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: No se puede registrar stock manual en TRANSIT'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_ubi_codigo = 'ALM_GR' THEN
    IF v_item_tipo <> 'GRANEL' THEN
      RAISE EXCEPTION 'DATOS_INVALIDOS: En ALM_GR solo se permiten ítems GRANEL (recibido: %)', v_item_tipo
        USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;

  IF v_ubi_codigo = 'ALM_MP' THEN
    IF v_item_tipo NOT IN ('INSUMO', 'EMPAQUE', 'MATERIAL') THEN
      RAISE EXCEPTION 'DATOS_INVALIDOS: En ALM_MP solo INSUMO, EMPAQUE o MATERIAL (recibido: %)', v_item_tipo
        USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;

  IF v_ubi_codigo = 'ALM_PT' OR v_es_pv OR v_ubi_codigo LIKE 'PV_%' THEN
    IF v_item_tipo <> 'PT' THEN
      RAISE EXCEPTION 'DATOS_INVALIDOS: En ALM_PT / PV solo producto terminado PT (recibido: %)', v_item_tipo
        USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'DATOS_INVALIDOS: Ubicación % no admite movimientos de tipo %', v_ubi_codigo, v_item_tipo
    USING ERRCODE = 'P0001';
END;
$function$;

-- Ajuste: validar tipo ↔ ubicación
CREATE OR REPLACE FUNCTION public.fn_ajuste_registrar(
  p_txn_id uuid,
  p_ubicacion_id uuid,
  p_item_id uuid,
  p_lote_id uuid,
  p_delta numeric,
  p_motivo text,
  p_observacion text,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lote_id uuid := p_lote_id;
  v_tipo text;
  v_nro text;
BEGIN
  IF NOT public.fn_user_puede_escribir() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SIN_PERMISO', 'error', 'Sin permiso de escritura');
  END IF;
  p_usuario_id := auth.uid();

  IF p_ubicacion_id IS NULL OR p_item_id IS NULL OR COALESCE(p_delta,0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Ubicación, item y delta requeridos');
  END IF;

  BEGIN
    PERFORM public.fn_assert_item_ubicacion(p_item_id, p_ubicacion_id);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', COALESCE(split_part(SQLERRM, ':', 1), 'DATOS_INVALIDOS'),
        'error', SQLERRM
      );
  END;

  IF p_txn_id IS NOT NULL AND p_lote_id IS NOT NULL THEN
    PERFORM 1 FROM inv_movimiento
      WHERE origen_id = p_txn_id AND origen_tipo = 'AJUSTE'
        AND lote_id = p_lote_id AND item_id = p_item_id;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'mensaje', 'Ajuste ya registrado');
    END IF;
  END IF;

  IF v_lote_id IS NULL THEN
    IF p_delta > 0 THEN
      v_nro := fn_generar_nro_lote(p_item_id, CURRENT_DATE);
      INSERT INTO inv_lote(nro_lote, item_id, estado, fecha_produccion, activo)
      VALUES (v_nro, p_item_id, 'LIBERADO', CURRENT_DATE, true)
      RETURNING id INTO v_lote_id;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Se requiere lote para salida');
    END IF;
  END IF;

  v_tipo := CASE WHEN p_delta >= 0 THEN 'AJUSTE_ING' ELSE 'AJUSTE_SAL' END;

  INSERT INTO inv_movimiento(ubicacion_id, item_id, lote_id, tipo_mov, cantidad, origen_tipo, origen_id, motivo, observacion, usuario_id)
  VALUES (p_ubicacion_id, p_item_id, v_lote_id, v_tipo, abs(p_delta), 'AJUSTE', p_txn_id, p_motivo, p_observacion, p_usuario_id);

  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('lote_id', v_lote_id), 'mensaje', 'Ajuste registrado');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error_code', COALESCE(split_part(SQLERRM, ':', 1), 'DESCONOCIDO'), 'error', SQLERRM);
END;
$function$;

-- Compra simple: validar tipo ↔ ubicación
CREATE OR REPLACE FUNCTION public.fn_compra_registrar(
  p_txn_id uuid,
  p_item_id uuid,
  p_ubicacion_id uuid,
  p_cantidad numeric,
  p_precio_unitario numeric,
  p_motivo text,
  p_observacion text,
  p_fecha_vencimiento date,
  p_usuario_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lote_id uuid;
  v_nro text;
BEGIN
  IF NOT public.fn_user_puede_escribir() THEN
    RAISE EXCEPTION 'SIN_PERMISO: Sin permiso de escritura' USING ERRCODE = 'P0001';
  END IF;
  p_usuario_id := auth.uid();

  PERFORM public.fn_assert_item_ubicacion(p_item_id, p_ubicacion_id);

  IF p_txn_id IS NOT NULL THEN
    SELECT lote_id INTO v_lote_id FROM inv_movimiento
     WHERE origen_id = p_txn_id AND tipo_mov = 'COMPRA' LIMIT 1;
    IF v_lote_id IS NOT NULL THEN
      RETURN v_lote_id;
    END IF;
  END IF;

  v_nro := fn_generar_nro_lote(p_item_id, CURRENT_DATE);
  v_lote_id := gen_random_uuid();

  INSERT INTO inv_lote(id, nro_lote, item_id, estado, fecha_produccion, fecha_vencimiento, activo)
  VALUES (v_lote_id, v_nro, p_item_id, 'LIBERADO', CURRENT_DATE, p_fecha_vencimiento, true);

  INSERT INTO inv_movimiento(id, ubicacion_id, item_id, lote_id, tipo_mov, cantidad, origen_tipo, precio_unitario, motivo, observacion, usuario_id, origen_id)
  VALUES (gen_random_uuid(), p_ubicacion_id, p_item_id, v_lote_id, 'COMPRA', abs(p_cantidad), 'COMPRA', p_precio_unitario, p_motivo, p_observacion, p_usuario_id, p_txn_id);

  RETURN v_lote_id;
END;
$function$;

-- Compra documentada: validar cada línea
CREATE OR REPLACE FUNCTION public.fn_compra_registrar_doc(
  p_txn_id uuid,
  p_ubicacion_id uuid,
  p_proveedor_id uuid,
  p_referencia text,
  p_observaciones text,
  p_usuario_id uuid,
  p_lineas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_compra_id uuid;
  v_linea     jsonb;
  v_item_id   uuid;
  v_cant      numeric;
  v_precio    numeric;
  v_venc      date;
  v_lote_id   uuid;
  v_nro       text;
  v_total     numeric := 0;
BEGIN
  IF NOT public.fn_user_puede_escribir() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SIN_PERMISO', 'error', 'Sin permiso de escritura');
  END IF;
  p_usuario_id := auth.uid();

  IF p_ubicacion_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Ubicación requerida');
  END IF;
  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Sin líneas de compra');
  END IF;

  IF p_txn_id IS NOT NULL THEN
    SELECT id INTO v_compra_id FROM cmp_compra WHERE txn_id = p_txn_id;
    IF v_compra_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('compra_id', v_compra_id), 'mensaje', 'Compra ya registrada');
    END IF;
  END IF;

  INSERT INTO cmp_compra(txn_id, ubicacion_id, proveedor_id, referencia, observaciones, usuario_id)
  VALUES (p_txn_id, p_ubicacion_id, p_proveedor_id, p_referencia, p_observaciones, p_usuario_id)
  RETURNING id INTO v_compra_id;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_item_id := (v_linea->>'item_id')::uuid;
    v_cant    := COALESCE((v_linea->>'cantidad')::numeric, 0);
    v_precio  := NULLIF(v_linea->>'precio_unitario','')::numeric;
    v_venc    := NULLIF(v_linea->>'fecha_vencimiento','')::date;

    IF v_item_id IS NULL OR v_cant <= 0 THEN
      RAISE EXCEPTION 'DATOS_INVALIDOS: línea con item o cantidad inválida';
    END IF;

    PERFORM public.fn_assert_item_ubicacion(v_item_id, p_ubicacion_id);

    v_nro := fn_generar_nro_lote(v_item_id, CURRENT_DATE);
    INSERT INTO inv_lote(nro_lote, item_id, estado, fecha_produccion, fecha_vencimiento, activo)
    VALUES (v_nro, v_item_id, 'LIBERADO', CURRENT_DATE, v_venc, true)
    RETURNING id INTO v_lote_id;

    INSERT INTO inv_movimiento(ubicacion_id, item_id, lote_id, tipo_mov, cantidad, origen_tipo, origen_id, precio_unitario, usuario_id)
    VALUES (p_ubicacion_id, v_item_id, v_lote_id, 'COMPRA', v_cant, 'COMPRA', v_compra_id, v_precio, p_usuario_id);

    INSERT INTO cmp_compra_detalle(compra_id, item_id, lote_id, cantidad, precio_unitario, fecha_vencimiento, subtotal)
    VALUES (v_compra_id, v_item_id, v_lote_id, v_cant, v_precio, v_venc, COALESCE(v_precio,0)*v_cant);

    v_total := v_total + COALESCE(v_precio,0)*v_cant;
  END LOOP;

  UPDATE cmp_compra SET total = v_total WHERE id = v_compra_id;
  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('compra_id', v_compra_id), 'mensaje', 'Compra registrada');
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_compra_id FROM cmp_compra WHERE txn_id = p_txn_id;
    RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('compra_id', v_compra_id), 'mensaje', 'Compra ya registrada');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error_code', COALESCE(split_part(SQLERRM, ':', 1), 'DESCONOCIDO'), 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_assert_item_ubicacion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assert_item_ubicacion(uuid, uuid) TO service_role;
