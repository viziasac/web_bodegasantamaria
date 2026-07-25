# Resumen general — Web ERP Bodega Santa María

**VIZIA S.A.C.** · Bodega Santa María · 2026  
**Versión del sistema web:** 1.0.0  
**Público:** dirección, gerencia y personal operativo  
**Última actualización:** 25 julio 2026

---

## 1. ¿Qué es el sistema web?

El **ERP web de Bodega Santa María** es el panel operativo en el navegador para inventario, producción, ventas, egresos y consulta gerencial. Comparte la **misma base de datos en la nube** que la aplicación móvil: lo registrado en un canal se refleja en el otro.

Desarrollado y entregado por **VIZIA S.A.C.** Acceso por correo y contraseña; despliegue en **Cloudflare Pages**.

---

## 2. Principio clave: un SKU = botellas

Todo el producto terminado se inventaría en **botellas físicas** (`item_id`). Pack ×6, ×12 u otros empaques son solo **formas de contar o vender**; no crean stock separado.

```mermaid
flowchart TD
  A[Compra / Producción / Ajuste] --> B[Stock unificado en botellas]
  B --> C[Venta en botellas o packs]
  C --> D[Descuenta botellas del mismo pool]
  B --> E[Transferencia / PV]
  E --> D
```

| Entrada en pantalla | Qué queda en inventario |
|---------------------|-------------------------|
| 10 packs ×6 | **60 botellas** |
| 5 packs ×12 | **60 botellas** |
| 60 botellas | **60 botellas** |

Puede **vender por botellas** aunque el stock haya entrado contado como pack.

---

## 3. Qué resuelve

| Necesidad del negocio | Cómo lo cubre el web |
|-----------------------|----------------------|
| Ver el mes de un vistazo | Panel de control con pestañas (Ejecutivo, Financiero, Comercial, etc.) |
| Saber cuánto hay y dónde | Inventario por almacén **y PV**; ajustes de conteo; auditoría |
| Comprar insumos sin perder el gasto | Ingreso de insumos; egreso opcional; corrección en Modificaciones |
| Producir granel y embotellar | Granel, órdenes de envasado y recetas (BOM por botella) |
| No duplicar productos al vender | Un producto (SKU) por ítem; stock en botellas; luego botella o pack ×N |
| Vender en tienda | Ingresos (POS) y Despacho; cliente opcional |
| Ajustar stock en el PV | Inventario → Ajuste: almacenes y puntos de venta |
| Corregir errores de captura | Módulo **Modificaciones** (ventas, egresos, anulación de compra) |
| Mover stock entre bodegas | Transferencias por SKU (envío + recepción) |
| Exportar para Excel | Descargas por módulo y mes |
| Administrar catálogos | Materiales/SKUs, maestros, clientes y proveedores (admin) |

---

## 4. Flujo operativo (de punta a punta)

```mermaid
flowchart TD
  A[Comprar materiales] --> B[Producir granel opcional]
  B --> C[Envasar órdenes a botellas]
  C --> D[Transferir a puntos de venta]
  D --> E[Vender Ingresos o Despacho]
  E --> F[Egresos y Modificaciones]
  F --> G[Panel Reportes Descargas]
```

**Menú web:** Panel → Inventario → Producción → Comercial → Consulta → Administración.

---

## 5. Módulos en una mirada

| Módulo | Para qué sirve |
|--------|----------------|
| **Panel de control** | Resumen del mes por pestañas |
| **Inventario** | Stock; ajuste/conteo en almacenes **y PV**; filtro por tipo |
| **Ingreso Insumos** | Compras / entradas; egreso opcional |
| **Transferencias** | Entre ubicaciones por SKU (botellas) |
| **Recetas** | Fórmula por 1 botella (admin escribe) |
| **Granel** | Alta de litros a ALM_GR |
| **Producción** | Órdenes de envasado por SKU |
| **Reempaque** | Cambio de formato ítem→ítem |
| **Ingresos** | POS multi-línea o venta rápida |
| **Despacho** | Venta de una línea |
| **Egresos** | Gastos operativos del día |
| **Modificaciones** | Corregir o anular ventas y egresos |
| **Clientes y proveedores** | Catálogo (admin; baja lógica) |
| **Auditoría** | Historial y trazabilidad |
| **Descargas** | Excel por mes |
| **Materiales / SKUs** | Ítems y presentaciones (admin) |
| **Maestros** | Canales, empaques, categorías de gasto (admin) |
| **Usuarios** | Consulta de cuentas (solo lectura) |
| **Reportes** | Resumen operativo del periodo (admin) |
| **Configuración** | Cuenta, preferencias, caché, cerrar sesión |

---

## 6. Beneficios para la operación

1. **Una sola verdad de stock** — misma BD que la app móvil.
2. **Unidades claras** — PT siempre en botellas; packs solo convierten la cantidad.
3. **Listados claros** — un SKU por producto; empaque después.
4. **Venta flexible** — botellas aunque el ingreso haya sido en packs.
5. **Ajuste en PV** — conteo físico directo en el punto de venta.
6. **Corrección segura** — Modificaciones anula ventas y compras con trazabilidad.
7. **Menos doble carga** — compra con precio puede generar el egreso.
8. **Trazabilidad** — lotes, auditoría y descargas.
9. **Visión gerencial** — panel mensual y reportes.
10. **Sesión estable** — no pide login por timeouts de red al renovar token.

---

## 7. Unidades y almacenes

| Qué | Unidad en inventario |
|-----|----------------------|
| Producto terminado | **Botellas** |
| Insumos / empaque | Su unidad (und, kg, etc.) |
| Granel | **Litros** |

**Almacenes habituales**

| Código | Uso |
|--------|-----|
| ALM_MP | Materias primas / insumos / empaque |
| ALM_GR | Granel (litros) |
| ALM_PT | Productos terminados (botellas) |
| PV_* | Puntos de venta (venta y ajuste) |

---

## 8. Quién usa qué

| Perfil | Acceso típico |
|--------|---------------|
| Sin **acceso web** | No puede iniciar sesión |
| Acceso web, sin ventas | Bodega/producción/consulta; sin Ingresos, Despacho, Egresos ni Modificaciones |
| Acceso web + ventas | También módulos comerciales |
| Administrador | Además Materiales/SKUs, Maestros, Usuarios, Reportes, Clientes y proveedores |

---

## 9. Relación con la app móvil

| Tema | Web | App móvil |
|------|-----|-----------|
| Datos | Misma Supabase | Misma Supabase |
| Uso típico | Oficina, gerencia, correcciones, catálogos | Planta, PV, operación en campo |
| Offline | Requiere conexión | Cola local ante cortes de red |
| Modificaciones | Módulo dedicado | Corrección limitada según versión |

**No duplique** la misma venta o compra en ambos canales.

---

## 10. Plataforma

- Cliente: **React 19 + TypeScript + Vite**
- Backend: **Supabase** (PostgreSQL, Auth, RPC)
- Hosting: **Cloudflare Pages**
- Documentación entregada por **VIZIA S.A.C.**

---

## 11. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| Manual de uso web detallado | Paso a paso por módulo, con ejemplos y diagramas |
| Resumen técnico web | Arquitectura, SKU/botellas, RPC y despliegue |

Para soporte: anote el módulo, la hora y el mensaje de error, y contacte a Bodega Santa María / **VIZIA S.A.C.**

---

*VIZIA S.A.C. · Bodega Santa María · Resumen general Web v1.0.0 · Julio 2026*
