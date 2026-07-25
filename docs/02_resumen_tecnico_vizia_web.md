# Resumen técnico — Web ERP Bodega Santa María

**VIZIA S.A.C.** · Bodega Santa María · 2026  
**Versión del sistema web:** 1.0.0  
**Backend:** Supabase · proyecto `cztnnkxvwiwpeifqygta`  
**Repo:** `github.com/viziasac/web_bodegasantamaria`  
**Última actualización:** 25 julio 2026

Arquitectura del cliente web y contrato con Supabase. Diccionario completo de tablas/triggers: documentación BD del repo de la app móvil.

---

## 1. Arquitectura

```mermaid
flowchart TD
  A[UI React pages/modules] --> B[AuthContext + CatalogContext]
  B --> C[apiProvider / bodegaService]
  C --> D[supabase-js Auth PostgREST RPC]
  D --> E[PostgreSQL mismos esquemas que app]
```

| Capa | Rol |
|------|-----|
| `src/pages/modules/**` | Pantallas |
| `src/config/moduleRegistry.ts` | Menú / adminOnly |
| `src/config/erpContract.ts` | RPC y códigos de error |
| `src/services/api/*` | PostgREST + RPC |
| `src/services/bodegaService.ts` | Orquestación de flujos |
| `src/utils/skuVenta.ts` | 1 SKU = 1 `item_id` PT |
| `src/utils/cantidadEmpaque.ts` | Pack × N → botellas |
| `src/utils/ubicacionItemPolicy.ts` | Matriz almacén ↔ tipo |
| `src/utils/uiFeedback.ts` | Mensajes de éxito unificados |
| `src/components/CantidadEmpaqueToggle.tsx` | Botellas / Packs ×N |
| `src/components/CatalogGate.tsx` | Gate de catálogo + reintento si falla la carga |
| `src/context/AuthContext.tsx` | Sesión + `acceso_web` |
| `src/context/CatalogContext.tsx` | Carga parcial de maestros (núcleo + opcionales) |

---

## 2. Stack

| Componente | Tecnología |
|------------|------------|
| Cliente | React 19 + TypeScript + Vite 6 |
| Routing | React Router (`BrowserRouter`) |
| Backend | Supabase (PostgreSQL, PostgREST, Auth) |
| Escrituras | RPC `fn_*` |
| Stock | `inv_movimiento` → trigger → `inv_stock_saldo` |
| Hosting | Cloudflare Pages |

---

## 3. Stock en botellas

`inv_stock_saldo`: `(ubicacion_id, item_id, lote_id, cantidad)` — **sin** `presentacion_id`.

```mermaid
flowchart TD
  A[UI botellas o packs] --> B[cantidadBaseDesdeEntrada]
  B --> C[RPC cantidad en botellas + item_id]
  C --> D[inv_movimiento]
  D --> E[inv_stock_saldo]
```

Presentaciones (`cant_unidades`) son metadata comercial. Venta/despacho/ajuste PT: una fila por SKU.

---

## 4. Política almacén ↔ tipo

| Ubicación | Tipos permitidos |
|-----------|------------------|
| `ALM_GR` | `GRANEL` |
| `ALM_MP` | `INSUMO`, `EMPAQUE`, `MATERIAL` |
| `ALM_PT` / `PV_*` | `PT` |
| `TRANSIT` | Sin movimientos manuales |

### Web

`ubicacionItemPolicy.ts` filtra:

| Flujo | Ubicaciones | Ítems |
|-------|-------------|-------|
| Ingreso insumos | ALM_MP, ALM_GR | Según destino |
| Ajuste | Almacenes + PV (no TRANSIT) | Según ubicación + filtro tipo |
| Producción destino | Solo ALM_PT | SKU PT |
| Transferencias | Operativas (no TRANSIT) | Según origen; valida destino |
| Reempaque | ALM_MP, ALM_GR, ALM_PT | Ítem→ítem |
| Granel | Implícito ALM_GR | Solo GRANEL |

### Supabase

`fn_assert_item_ubicacion(item_id, ubicacion_id)` — script `scripts/sql/20260725_assert_item_ubicacion.sql`.

Integrada en:

- `fn_ajuste_registrar`
- `fn_compra_registrar`
- `fn_compra_registrar_doc`
- `fn_reempaque_registrar` (origen y destino)

(`fn_compra_registrar_con_gasto` delega en `fn_compra_registrar`.)

Anulación de compra: `fn_compra_origen_ids` resuelve movimientos con `origen_id = txn` **o** `cmp_compra.id` (script `scripts/sql/20260725_audit_compra_anular_reempaque.sql`).

Error típico: `DATOS_INVALIDOS: En ALM_MP solo INSUMO, EMPAQUE o MATERIAL…`

---

## 5. UX de confirmación (post-escritura)

Constantes en `src/utils/uiFeedback.ts`. Patrón en módulos de escritura:

1. `await` RPC / PostgREST  
2. Si OK → limpiar inputs de captura → `setSuccess(MSG_*)`  
3. Si error → `setError(...)` **sin** limpiar el formulario  

| Constante | Texto |
|-----------|-------|
| `MSG_REGISTRADO` | Registrado correctamente |
| `MSG_RECIBIDO` | Recibido correctamente |
| `MSG_GUARDADO` / `MSG_ACTUALIZADO` | Guardado / Actualizado correctamente |
| `MSG_ANULADO` / `MSG_ELIMINADO` | Anulado / Eliminado correctamente |

---

## 5. Auth y sesión

| Tema | Comportamiento |
|------|----------------|
| Persistencia | `localStorage` + auto refresh |
| Gate | `acceso_web` |
| Refresh | Fallo de red no fuerza `signOut` |
| Cierre | Explícito o sesión inválida |

Flags: `acceso_web`, `acceso_app`, `acceso_ventas`, admin.

---

## 6. RPC principales

| RPC | Uso |
|-----|-----|
| `fn_compra_registrar*` | Compras (+ assert ubicación) |
| `fn_compra_anular_desde_gasto` | Anular compra desde egreso |
| `fn_gasto_*` | Egresos |
| `fn_granel_registrar` | Granel → ALM_GR |
| `fn_orden_completar` / `fn_anular_orden` | Envasado |
| `fn_ajuste_registrar` | Ajuste (+ assert) |
| `fn_venta_registrar` / actualizar / anular | Ventas |
| `fn_transferencia_registrar` + recepción | Traslados |
| `fn_reempaque_registrar` | Reempaque |
| `fn_assert_item_ubicacion` | Validación tipo↔almacén |

Trigger venta: movimiento `VENTA` por `item_id` / cantidad (botellas).

---

## 7. Módulos ↔ escritura

| Módulo | Escritura |
|--------|-----------|
| Ingreso / Granel / Producción / Reempaque | RPC |
| Inventario ajuste | `fn_ajuste_registrar` |
| Ingresos / Despacho | `fn_venta_registrar` |
| Egresos / Modificaciones | gasto + venta anular/actualizar |
| Transferencias | registrar + recibir |
| Materiales / Maestros / Partners | PostgREST + RLS (admin) |
| Panel / Auditoría / Descargas / Reportes | Lectura |

---

## 8. Despliegue

| Campo | Valor |
|-------|--------|
| Build | `npm run build` |
| Output | `dist` |
| SPA | `public/_redirects` → `/* /index.html 200` |
| Env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

## 9. Documentación

| Artefacto | Generación |
|-----------|------------|
| MD en `docs/` | Fuente |
| PDF en `docs/pdf/` | `python docs/build_pdf.py` |

Mermaid → cajas de flujo en PDF.

---

## 10. Relacionados

Manual de uso · Resumen general · Documentación BD (repo app).

Soporte: **VIZIA S.A.C.**

---

*VIZIA S.A.C. · Bodega Santa María · Resumen técnico Web v1.0.0 · Julio 2026*
