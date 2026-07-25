-- Migración: anular/corregir compras desde Modificaciones (egresos origen COMPRA)
-- RPCs:
--   fn_compra_anular_desde_gasto(p_gasto_id, p_motivo, p_usuario_id)
--   fn_gasto_eliminar — si origen COMPRA, anula compra (stock + egreso)
--   fn_gasto_actualizar — permite corregir egreso COMPRA y sincroniza precio_unitario del movimiento

CREATE OR REPLACE FUNCTION public.fn_compra_anular_desde_gasto(
  p_gasto_id uuid,
  p_motivo text DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_gasto public.gas_gasto%ROWTYPE;
  v_txn uuid;
  v_mov RECORD;
  v_saldo numeric;
  v_motivo text := COALESCE(NULLIF(trim(p_motivo), ''), 'Anulación de compra');
  v_anul_txn uuid;
  v_lineas int := 0;
  v_ya int;
BEGIN
  IF NOT public.fn_user_puede_escribir() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PERMISOS', 'error', 'Sin permiso de escritura');
  END IF;
  IF NOT public.fn_user_puede_escribir_ventas() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PERMISOS', 'error', 'Sin permiso de ventas/egresos');
  END IF;
  p_usuario_id := auth.uid();

  SELECT * INTO v_gasto FROM public.gas_gasto WHERE id = p_gasto_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ENCONTRADO', 'error', 'Egreso no encontrado');
  END IF;

  IF COALESCE(v_gasto.origen_tipo, '') <> 'COMPRA' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ESTADO_INVALIDO',
      'error', 'Este egreso no proviene de una compra.');
  END IF;

  IF NULLIF(trim(v_gasto.origen_txn_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS',
      'error', 'El egreso de compra no tiene referencia de transacción.');
  END IF;

  BEGIN
    v_txn := v_gasto.origen_txn_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS',
      'error', 'Referencia de compra inválida.');
  END;

  -- Idempotencia: si ya hay reverso de anulación, solo limpia egresos residuales
  SELECT count(*)::int INTO v_ya
  FROM public.inv_movimiento
  WHERE origen_id = v_txn AND origen_tipo = 'ANULACION_COMPRA';

  IF v_ya > 0 THEN
    DELETE FROM public.gas_gasto
     WHERE origen_tipo = 'COMPRA' AND origen_txn_id = v_txn::text;
    UPDATE public.cmp_compra
       SET estado = 'ANULADA',
           observaciones = trim(both FROM concat_ws(' | ', observaciones, '[ANULADA] ' || v_motivo))
     WHERE txn_id = v_txn AND COALESCE(estado, '') <> 'ANULADA';
    RETURN jsonb_build_object(
      'ok', true,
      'mensaje', 'Compra ya anulada; egreso limpiado',
      'data', jsonb_build_object('txn_id', v_txn, 'lineas_reverso', v_ya, 'idempotent', true)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inv_movimiento
     WHERE origen_id = v_txn AND tipo_mov = 'COMPRA'
  ) THEN
    -- Solo egreso huérfano: eliminar gasto
    DELETE FROM public.gas_gasto
     WHERE origen_tipo = 'COMPRA' AND origen_txn_id = v_txn::text;
    RETURN jsonb_build_object(
      'ok', true,
      'mensaje', 'Egreso de compra eliminado (sin movimiento de inventario)',
      'data', jsonb_build_object('txn_id', v_txn, 'lineas_reverso', 0)
    );
  END IF;

  -- Validar stock disponible por cada línea COMPRA antes de revertir
  FOR v_mov IN
    SELECT m.*
      FROM public.inv_movimiento m
     WHERE m.origen_id = v_txn AND m.tipo_mov = 'COMPRA'
     ORDER BY m.fecha, m.id
     FOR UPDATE OF m
  LOOP
    IF v_mov.lote_id IS NULL OR v_mov.item_id IS NULL OR v_mov.ubicacion_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS',
        'error', 'Movimiento de compra incompleto; no se puede anular automáticamente.');
    END IF;

    SELECT COALESCE(s.cantidad, 0) INTO v_saldo
      FROM public.inv_stock_saldo s
     WHERE s.item_id = v_mov.item_id
       AND s.lote_id = v_mov.lote_id
       AND s.ubicacion_id = v_mov.ubicacion_id
     LIMIT 1;

    IF COALESCE(v_saldo, 0) < COALESCE(v_mov.cantidad, 0) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'STOCK_INSUFICIENTE',
        'error', format(
          'No se puede anular: el lote ya tiene salidas (disponible %s, compra %s). Ajuste inventario primero.',
          COALESCE(v_saldo, 0), COALESCE(v_mov.cantidad, 0)
        )
      );
    END IF;
  END LOOP;

  v_anul_txn := gen_random_uuid();

  FOR v_mov IN
    SELECT m.*
      FROM public.inv_movimiento m
     WHERE m.origen_id = v_txn AND m.tipo_mov = 'COMPRA'
     ORDER BY m.fecha, m.id
  LOOP
    INSERT INTO public.inv_movimiento(
      ubicacion_id, item_id, lote_id, tipo_mov, cantidad,
      origen_tipo, origen_id, motivo, observacion, usuario_id, precio_unitario, moneda
    ) VALUES (
      v_mov.ubicacion_id, v_mov.item_id, v_mov.lote_id, 'AJUSTE_SAL', v_mov.cantidad,
      'ANULACION_COMPRA', v_txn, v_motivo,
      'Reverso compra ' || COALESCE(v_mov.motivo, v_txn::text),
      p_usuario_id, v_mov.precio_unitario, COALESCE(v_mov.moneda, 'PEN')
    );
    v_lineas := v_lineas + 1;

    -- Si el lote queda en 0, marcarlo inactivo/agotado (trigger también ayuda)
    UPDATE public.inv_lote l
       SET activo = false,
           estado = CASE WHEN l.estado = 'LIBERADO' THEN 'AGOTADO' ELSE l.estado END,
           observaciones = trim(both FROM concat_ws(' | ', l.observaciones, '[ANULACION_COMPRA] ' || v_motivo))
     WHERE l.id = v_mov.lote_id
       AND NOT EXISTS (
         SELECT 1 FROM public.inv_stock_saldo s
          WHERE s.lote_id = l.id AND s.cantidad > 0
       );
  END LOOP;

  DELETE FROM public.gas_gasto
   WHERE origen_tipo = 'COMPRA' AND origen_txn_id = v_txn::text;

  UPDATE public.cmp_compra
     SET estado = 'ANULADA',
         observaciones = trim(both FROM concat_ws(' | ', observaciones, '[ANULADA] ' || v_motivo))
   WHERE txn_id = v_txn;

  RETURN jsonb_build_object(
    'ok', true,
    'mensaje', 'Compra anulada: stock revertido y egreso eliminado',
    'data', jsonb_build_object(
      'txn_id', v_txn,
      'anul_ref', v_anul_txn,
      'lineas_reverso', v_lineas
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'DESCONOCIDO', 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_gasto_eliminar(p_gasto_id uuid, p_usuario_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_origen text;
BEGIN
  IF NOT public.fn_user_puede_escribir_ventas() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PERMISOS', 'error', 'Sin permiso de ventas');
  END IF;

  SELECT origen_tipo INTO v_origen FROM public.gas_gasto WHERE id = p_gasto_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ENCONTRADO', 'error', 'Gasto no encontrado');
  END IF;

  IF COALESCE(v_origen, '') = 'COMPRA' THEN
    RETURN public.fn_compra_anular_desde_gasto(p_gasto_id, 'Eliminación desde Modificaciones', p_usuario_id);
  END IF;

  DELETE FROM public.gas_gasto WHERE id = p_gasto_id;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Gasto eliminado');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'DESCONOCIDO', 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_gasto_actualizar(p_gasto_id uuid, p_payload jsonb, p_usuario_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.gas_gasto%ROWTYPE;
  v_monto numeric;
  v_txn uuid;
  v_qty numeric;
  v_pu numeric;
  v_es_compra boolean;
BEGIN
  IF NOT public.fn_user_puede_escribir_ventas() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PERMISOS', 'error', 'Sin permiso de ventas');
  END IF;
  p_usuario_id := auth.uid();

  SELECT * INTO v_row FROM public.gas_gasto WHERE id = p_gasto_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ENCONTRADO', 'error', 'Gasto no encontrado');
  END IF;

  v_es_compra := COALESCE(v_row.origen_tipo, '') = 'COMPRA';
  v_monto := COALESCE((p_payload->>'monto')::numeric, v_row.monto);
  IF v_monto IS NULL OR v_monto <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DATOS_INVALIDOS', 'error', 'Monto debe ser > 0');
  END IF;

  UPDATE public.gas_gasto SET
    fecha = COALESCE((p_payload->>'fecha')::date, fecha),
    monto = v_monto,
    descripcion = COALESCE(NULLIF(trim(p_payload->>'descripcion'), ''), descripcion),
    categoria_id = COALESCE((p_payload->>'categoria_id')::uuid, categoria_id),
    proveedor_id = CASE WHEN p_payload ? 'proveedor_id' THEN
      NULLIF(trim(p_payload->>'proveedor_id'), '')::uuid
    ELSE proveedor_id END,
    proveedor_nombre = CASE WHEN p_payload ? 'proveedor_nombre'
      THEN NULLIF(trim(p_payload->>'proveedor_nombre'), '') ELSE proveedor_nombre END,
    tipo_comprobante = CASE WHEN p_payload ? 'tipo_comprobante'
      THEN NULLIF(trim(p_payload->>'tipo_comprobante'), '') ELSE tipo_comprobante END,
    nro_comprobante = CASE WHEN p_payload ? 'nro_comprobante'
      THEN NULLIF(trim(p_payload->>'nro_comprobante'), '') ELSE nro_comprobante END,
    centro_costo = COALESCE(NULLIF(trim(p_payload->>'centro_costo'), ''), centro_costo),
    moneda = COALESCE(NULLIF(trim(p_payload->>'moneda'), ''), moneda),
    con_comprobante = COALESCE((p_payload->>'con_comprobante')::boolean, con_comprobante)
  WHERE id = p_gasto_id;

  -- Compra: sincronizar precio unitario del movimiento (cantidad fija; no toca stock)
  IF v_es_compra AND NULLIF(trim(v_row.origen_txn_id), '') IS NOT NULL THEN
    BEGIN
      v_txn := v_row.origen_txn_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_txn := NULL;
    END;

    IF v_txn IS NOT NULL THEN
      SELECT COALESCE(SUM(cantidad), 0) INTO v_qty
        FROM public.inv_movimiento
       WHERE origen_id = v_txn AND tipo_mov = 'COMPRA';

      IF v_qty > 0 THEN
        v_pu := round(v_monto / v_qty, 4);
        UPDATE public.inv_movimiento
           SET precio_unitario = v_pu
         WHERE origen_id = v_txn AND tipo_mov = 'COMPRA';

        UPDATE public.cmp_compra_detalle d
           SET precio_unitario = v_pu,
               subtotal = round(v_pu * d.cantidad, 2)
          FROM public.cmp_compra c
         WHERE d.compra_id = c.id AND c.txn_id = v_txn;

        UPDATE public.cmp_compra
           SET total = v_monto
         WHERE txn_id = v_txn;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('gasto_id', p_gasto_id, 'es_compra', v_es_compra),
    'mensaje', CASE WHEN v_es_compra THEN 'Egreso de compra actualizado' ELSE 'Gasto actualizado' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'DESCONOCIDO', 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_compra_anular_desde_gasto(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gasto_eliminar(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_gasto_actualizar(uuid, jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_compra_anular_desde_gasto(uuid, text, uuid) IS
  'Anula compra ligada a un egreso: AJUSTE_SAL por líneas COMPRA, borra gas_gasto, marca cmp_compra ANULADA.';
