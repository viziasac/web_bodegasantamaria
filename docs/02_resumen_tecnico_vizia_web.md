# Resumen técnico — Web ERP Bodega Santa María

**VIZIA S.A.C.** · Bodega Santa María · 2026  
**Versión del sistema web:** 1.0.0  
**Backend:** Supabase · proyecto `cztnnkxvwiwpeifqygta`  
**Repo:** `github.com/viziasac/web_bodegasantamaria`  
**Última actualización:** Julio 2026

Este documento resume la arquitectura del cliente web y su contrato con Supabase. El diccionario de tablas, triggers y flujos de stock compartidos con la app móvil está en la documentación BD del repositorio de la app.

---

## 1. Arquitectura

```
UI React (páginas /modules/**)
        ↓
AuthContext + CatalogContext
        ↓
apiProvider / services/api/*  +  bodegaService
        ↓
supabase-js (Auth + PostgREST + RPC fn_*)
        ↓
PostgreSQL (mismos esquemas que la app móvil)
```

| Capa | Rol |
|------|-----|
| `src/pages/modules/**` | Pantallas por módulo |
| `src/config/moduleRegistry.ts` | Menú, secciones, `adminOnly` |
| `src/config/erpContract.ts` | Nombres RPC y códigos de error |
| `src/services/api/*` | Lecturas PostgREST + escrituras RPC |
| `src/services/bodegaService.ts` | Orquestación de compras / flujos compuestos |
| `src/utils/skuVenta.ts` | Agrupa presentaciones por `item_id` (un SKU = un PT) |
| `src/context/AuthContext.tsx` | Sesión, refresh suave, gate `acceso_web` |

---

## 2. Stack

| Componente | Tecnología |
|------------|------------|
| Cliente | React 19 + TypeScript + Vite 6 |
| Routing | React Router (`BrowserRouter`) |
| Backend | Supabase (PostgreSQL 17, PostgREST, Auth) |
| Escrituras críticas | RPC `fn_*` (SECURITY DEFINER donde aplica) |
| Stock | `inv_movimiento` → trigger → `inv_stock_saldo` |
| Hosting | Cloudflare Pages (`dist/`, `_redirects` SPA) |
| Offline | No hay cola local; requiere red |

---

## 3. Principio de stock y UM botellas

El stock físico se guarda por **`item_id` + `lote_id` + `ubicacion_id`**.

| Contexto | Entrada en UI | Persistencia |
|----------|---------------|--------------|
| Producto terminado | Un SKU por `ma_item` PT + empaque | Siempre **botellas** |
| Pack / caja | Factor del empaque | `cantidad × factor` → botellas **antes** del RPC |
| Insumos / empaque | Unidad del ítem | Misma unidad |
| Granel | Litros | Litros en `ALM_GR` |

**UI ventas/despacho:** utilidades `skuVenta` agrupan Botella + Pack del mismo `item_id` en **una fila**. El usuario elige después el modo de empaque.

**Ejemplo:** 10 × Pack×6 → movimiento de **60 botellas**.

---

## 4. Auth y sesión

| Tema | Comportamiento |
|------|----------------|
| Persistencia | `localStorage` + `autoRefreshToken` |
| Gate web | Perfil `app_user_role` / flags → `accesoWeb` |
| Refresh | En `TOKEN_REFRESHED`, fallos de red **no** fuerzan `signOut` |
| Visibilidad | Al volver a la pestaña se llama `refreshSession` de forma suave |
| Cierre | Explícito en Configuración, o sesión inválida definitiva |

Flags relevantes: `acceso_web`, `acceso_app`, `acceso_ventas`, rol admin.

---

## 5. Maestros cliente / proveedor

| Tabla | Uso web | Filtro | Notas |
|-------|---------|--------|-------|
| `ma_cliente` | Ingresos, Despacho | Activos en dropdowns | `cliente_id` nullable |
| `ma_proveedor` | Compras, Egresos | Activos en dropdowns | Soft-delete `activo=false` |

Módulo **Clientes y proveedores** (admin): CRUD con baja lógica; reactivación; ver inactivos.

---

## 6. RPC principales (web)

| RPC | Uso |
|-----|-----|
| `fn_compra_registrar` | Entrada simple + lote |
| `fn_compra_registrar_con_gasto` | Compra + egreso opcional |
| `fn_compra_registrar_doc` | Compra documentada |
| `fn_compra_anular_desde_gasto` | Anula compra desde egreso COMPRA (`AJUSTE_SAL` + borra gasto) |
| `fn_gasto_registrar` / `fn_gasto_actualizar` / `fn_gasto_eliminar` | Egresos; eliminar COMPRA delega en anulación |
| `fn_granel_registrar` | Producción a granel |
| `fn_orden_completar` / `fn_anular_orden` | Órdenes de envasado |
| `fn_ajuste_registrar` | Ajuste / merma |
| `fn_venta_registrar` | Ingresos y Despacho |
| `fn_venta_actualizar` / `fn_venta_anular` | Modificaciones de ventas |
| `fn_transferencia_registrar` / `fn_transferencia_recibir` | Traslado |
| `fn_reempaque_registrar` | Conversión ítem→ítem |
| `fn_resumen_stock_items` / historial / reportes | Consultas |

---

## 7. Módulos ↔ escritura

| Módulo | Escritura | Mecanismo |
|--------|-----------|-----------|
| Ingreso Insumos | Sí | Compra / compra+gasto / doc |
| Granel / Producción / Reempaque | Sí | RPC correspondientes |
| Inventario (ajuste) | Sí | `fn_ajuste_registrar` |
| Ingresos / Despacho | Sí | `fn_venta_registrar` |
| Egresos | Sí | `fn_gasto_registrar` |
| Modificaciones | Sí | venta actualizar/anular; gasto actualizar/eliminar (+ anular compra) |
| Transferencias | Sí | registrar + recibir |
| Materiales / Maestros / Partners | Sí (admin) | PostgREST + RLS |
| Recetas | Lectura / escritura admin | BOM |
| Panel / Auditoría / Descargas / Reportes / Usuarios | Lectura | SELECT / RPC / export XLSX |
| Configuración | Local + auth | Preferencias, signOut, refresh catálogo |

---

## 8. Despliegue (Cloudflare Pages)

| Campo | Valor |
|-------|--------|
| Build | `npm run build` |
| Output | `dist` |
| Node | 20 o 22 |
| SPA | `public/_redirects` → `/* /index.html 200` |
| Env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon JWT) |

Fallback embebido: `src/config/supabaseConfig.ts` si faltan variables.

---

## 9. Diferencias relevantes vs app móvil

| Tema | Web | App |
|------|-----|-----|
| Offline | No | Cola Hive |
| Panel gerencial | Sí | Limitado / reportes |
| Modificaciones | Módulo completo + anular compra | Según versión |
| Catálogos admin | Materiales, maestros, partners | Menos cobertura en UI |
| Package | SPA estático | Flutter Android |

Ambos escriben las mismas tablas vía el mismo contrato RPC.

---

## 10. Errores de negocio

Códigos en `ErpErrorCode` / mensajes `ErpErrorMessages`: `STOCK_INSUFICIENTE`, `ESTADO_INVALIDO`, `NO_ENCONTRADO`, `DATOS_INVALIDOS`, etc. La UI muestra mensajes amigables vía `toUserMessage` / `friendlyDbError`.

---

## 11. Documentos relacionados

| Documento | Uso |
|-----------|-----|
| Manual de uso web | Operación |
| Resumen general web | Gerencia |
| Documentación BD (repo app) | Tablas, triggers, flujos de stock |

Soporte técnico: **VIZIA S.A.C.** · Bodega Santa María.

---

*VIZIA S.A.C. · Bodega Santa María · Resumen técnico Web v1.0.0 · 2026*
