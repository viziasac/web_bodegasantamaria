-- Endurece recetas + materiales/SKUs para go-live
-- Proyecto: cztnnkxvwiwpeifqygta
-- - Constraints BOM (cantidad > 0, componente NOT NULL, no auto-referencia)
-- - RLS INSERT/UPDATE admin en ma_item / ma_presentacion (sin DELETE)
-- - RLS INSERT/UPDATE/DELETE admin en rec_receta
-- - Revoca privilegios excesivos de anon

-- Aplicada vía MCP: harden_recetas_materiales_rls
