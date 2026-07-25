-- Amplía origen_tipo permitido en inv_movimiento para anulaciones
-- y asegura fn_compra_anular_desde_gasto / idempotencia correctas.
-- Corrige: check constraint inv_movimiento_origen_tipo_check rechazaba ANULACION_COMPRA.

ALTER TABLE public.inv_movimiento
  DROP CONSTRAINT IF EXISTS inv_movimiento_origen_tipo_check;

ALTER TABLE public.inv_movimiento
  ADD CONSTRAINT inv_movimiento_origen_tipo_check
  CHECK (
    (origen_tipo)::text = ANY (
      ARRAY[
        'ORDEN'::text,
        'VENTA'::text,
        'TRANSFERENCIA'::text,
        'AJUSTE'::text,
        'REEMPAQUE'::text,
        'COMPRA'::text,
        'GRANEL'::text,
        'ANULACION_VENTA'::text,
        'ANULACION_COMPRA'::text
      ]
    )
  );

COMMENT ON CONSTRAINT inv_movimiento_origen_tipo_check ON public.inv_movimiento IS
  'Orígenes de movimiento incl. anulaciones de venta/compra desde Modificaciones.';

-- Reaplica anulación de compra (origen_tipo ANULACION_COMPRA ya válido)
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
    DELETE FROM public.gas_gasto
     WHERE origen_tipo = 'COMPRA' AND origen_txn_id = v_txn::text;
    RETURN jsonb_build_object(
      'ok', true,
      'mensaje', 'Egreso de compra eliminado (sin movimiento de inventario)',
      'data', jsonb_build_object('txn_id', v_txn, 'lineas_reverso', 0)
    );
  END IF;

  FOR v_mov IN
    SELECT m.*
      FROM public.inv_movimiento m
     WHERE m.origen_id = v_txn AND m.tipo_mov = 'COMPRA'
     ORDER BY m.fecha, m.id
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
      'lineas_reverso', v_lineas
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'DESCONOCIDO', 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_compra_anular_desde_gasto(uuid, text, uuid) TO authenticated;
