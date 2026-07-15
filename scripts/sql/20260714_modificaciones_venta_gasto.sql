-- Migración aplicada en cztnnkxvwiwpeifqygta: modificaciones_venta_gasto
-- RPCs:
--   fn_gasto_actualizar(p_gasto_id, p_payload, p_usuario_id)
--   fn_gasto_eliminar(p_gasto_id, p_usuario_id) — bloquea origen COMPRA
--   fn_venta_actualizar(p_venta_id, p_payload, p_usuario_id) — cabecera + precios de líneas
--   fn_venta_anular(p_venta_id, p_motivo, p_usuario_id) — ANULADA + restock AJUSTE_ING
-- ven_venta.estado: ACTIVA | ANULADA (+ anulado_at/por/motivo)

-- Ver historial MCP / código web: ModificacionesPage + apiProvider.
