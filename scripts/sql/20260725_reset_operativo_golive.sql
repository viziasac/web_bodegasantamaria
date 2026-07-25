-- Reset operativo go-live: limpia stock + ingresos + egresos + docs de movimiento.
-- CONSERVA: app_user_role / auth, rec_receta, rec_encajado, maestros (ma_*, cat_*, gas_categoria).
-- Proyecto: cztnnkxvwiwpeifqygta · Julio 2026

BEGIN;

-- 1) Comercial: ventas y egresos
DELETE FROM public.ven_detalle;
DELETE FROM public.ven_venta;
DELETE FROM public.gas_gasto;

-- 2) Compras documentadas
DELETE FROM public.cmp_compra_detalle;
DELETE FROM public.cmp_compra;

-- 3) Transferencias y reempaque
DELETE FROM public.trn_transferencia_detalle;
DELETE FROM public.trn_transferencia;
DELETE FROM public.inv_reempaque_detalle;
DELETE FROM public.inv_reempaque;

-- 4) Ledger de inventario
DELETE FROM public.inv_movimiento;
DELETE FROM public.inv_stock_saldo;

-- 5) Órdenes de producción y lotes (stock físico)
UPDATE public.inv_lote SET orden_id = NULL WHERE orden_id IS NOT NULL;
DELETE FROM public.prd_orden;
DELETE FROM public.inv_lote;

-- 6) Auditoría operativa (si hubiera)
DELETE FROM public.audit_log;

COMMIT;
