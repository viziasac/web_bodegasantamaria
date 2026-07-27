# Auditoría Web vs App vs Supabase — 2026-07-27

## Resultado general

- Estado global: **alineado y validado (UI + contrato)**
- Build: **OK** (`npm run build`)
- TypeScript: **OK** (`npx tsc --noEmit`)
- Contrato crítico verificado:
  - PT multi-envase con `envase_ml`
  - compras documentadas con egreso opcional (tipo/nro comprobante)
  - producción sin `ma_empaque_material` (solo `rec_receta`)
  - reempaque retirado del flujo operativo

## Smoke checks ejecutados

| Área | Verificación | Resultado |
|---|---|---|
| Build web | `npm run build` | OK |
| Typecheck | `npx tsc --noEmit` | OK |
| Supabase schema | `ma_empaque_material`, `inv_reempaque`, `rec_encajado` | No existen |
| PT multi-envase | `ma_item.envase_ml`, `granel_base_id` | Existen |
| RPC compras | `fn_compra_registrar_doc`, `fn_compra_registrar_con_gasto` | Vigentes |
| RPC PT | `fn_sku_pt_crear`, `fn_sku_pt_bootstrap`, `fn_sku_pt_bootstrap_all` | Vigentes |
| RPC producción | `fn_validar_insumos_orden`, `fn_orden_completar` | Vigentes |
| RPC transferencias | `fn_transferencia_registrar`, `fn_transferencia_recibir` | Vigentes |
| RPC granel | `fn_granel_registrar` | Vigente |

## Cambios aplicados por módulo

### Producción
- Preview alineado a Supabase/app: **solo receta**
- Retirado el uso de `ma_empaque_material`
- Se mantiene pack→botellas solo como factor UI
- Al cambiar filtro de estado se limpia el panel de completar

### Compras
- Compra simple/doc con egreso envía tipo y nro de comprobante
- Se limpia categoría huérfana cuando tipo/ubicación la invalidan

### Despacho / ventas
- Lote elegido pasa a ser **preferencia**, no exclusividad
- Si el lote no alcanza, completa por FEFO/FIFO como el app

### Granel
- Validación UI de cantidad > 0 antes del RPC

### Materiales / SKUs
- PT muestra y edita `envase_ml`
- Alta PT exige `envase_ml` válido
- Alta PT preserva `stock_minimo` tras `fn_sku_pt_crear`
- Pestaña SKUs: **solo edición** nombre/activo (sin CTA de alta manual)

### Inventario / transferencias / maestros
- Cambio de ubicación resetea tipo y categoría
- Transferencias: carrito se limpia al cambiar pestaña PT↔Material; origen ≠ destino
- Maestros / proveedores-clientes: modal y form se resetean al cambiar pestaña

### Recetas
- Tip UX: cartón/pack comercial no entra en la fórmula por botella

### Auditoría
- `REEMPAQUE` solo como histórico en filtros
- Ítem seleccionado se limpia si deja de aparecer en la búsqueda
- Validación `fechaDesde` ≤ `fechaHasta`

### Documentación / scripts
- Docs MD alineados a producción sin BOM empaque
- Scripts SQL locales sin referencias a tablas droppeadas

## Estado por módulo

| Módulo | Estado |
|---|---|
| Login / acceso web | Verificado |
| Dashboard | Verificado (contrato + tipado) |
| Inventario | Ajustado (filtros) y verificado |
| Ajustes | Verificado por contrato |
| Compras | Ajustado y verificado |
| Ingresos POS | Verificado |
| Despacho | Ajustado y verificado |
| Gastos | Verificado |
| Producción | Ajustado y verificado |
| Producción granel | Ajustado y verificado |
| Transferencias | Ajustado y verificado |
| Recetas | Ajustado (copy UX) y verificado |
| Materiales / SKUs | Ajustado y verificado |
| Maestros | Ajustado y verificado |
| Proveedores / clientes | Ajustado y verificado |
| Reportes | Verificado por contrato |
| Modificaciones | Verificado por contrato |
| Auditoría | Ajustado y verificado |
| Usuarios | Verificado por contrato |
| Descargas | Verificado por build/contrato |
| Configuración | Sin cambios requeridos |

## Riesgos residuales

1. Existen advertencias de Security Advisor en Supabase sobre funciones `SECURITY DEFINER` ejecutables por `authenticated`; no bloquean esta web, pero conviene tratarlas en una auditoría de seguridad separada.
2. Los PDF en `docs/pdf/` pueden quedar desfasados respecto a los MD hasta regenerar con `python docs/build_pdf.py`.

## Conclusión

La web quedó alineada con el estado actual del app y Supabase para los cambios operativos de julio 2026. Se validaron módulos, filtros, pestañas y tipado; el riesgo de Producción contra tablas retiradas fue corregido y el proyecto compila correctamente.
