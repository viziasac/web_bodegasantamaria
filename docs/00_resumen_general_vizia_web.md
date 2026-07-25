# Resumen general — Web ERP Bodega Santa María

**VIZIA S.A.C.** · Bodega Santa María · 2026  
**Versión del sistema web:** 1.0.0  
**Público:** dirección, gerencia y personal operativo  
**Última actualización:** Julio 2026

---

## 1. ¿Qué es el sistema web?

El **ERP web de Bodega Santa María** es el panel operativo en el navegador para inventario, producción, ventas, egresos y consulta gerencial. Comparte la **misma base de datos en la nube** que la aplicación móvil, de modo que lo registrado en un canal se refleja en el otro.

Desarrollado y entregado por **VIZIA S.A.C.** para el cliente Bodega Santa María. Acceso por correo y contraseña; despliegue en **Cloudflare Pages**.

---

## 2. Qué resuelve

| Necesidad del negocio | Cómo lo cubre el web |
|-----------------------|----------------------|
| Ver el mes de un vistazo | Panel de control con pestañas (Ejecutivo, Financiero, Comercial, etc.) |
| Saber cuánto hay y dónde | Inventario por almacén; ajustes de conteo; auditoría por lote |
| Comprar insumos sin perder el gasto | Ingreso de insumos; egreso opcional; corrección en Modificaciones |
| Producir granel y embotellar | Granel, órdenes de envasado y recetas (BOM por botella) |
| No duplicar productos al vender | Un producto por ítem; stock en **botellas**; luego botella o pack |
| Vender en tienda | Ingresos (POS) y Despacho; cliente opcional |
| Corregir errores de captura | Módulo **Modificaciones** (ventas y egresos, incluida anulación de compra) |
| Mover stock entre bodegas | Transferencias con envío y recepción |
| Exportar para Excel | Descargas por módulo y mes |
| Administrar catálogos | Materiales/SKUs, maestros, clientes y proveedores (admin) |

---

## 3. Flujo operativo (de punta a punta)

```
Comprar materiales (+ egreso opcional)
        ↓
Producir granel (litros)          ← opcional según campaña
        ↓
Envasar (órdenes → botellas)
        ↓
Transferir a puntos de venta
        ↓
Vender (Ingresos o Despacho)
        ↓
Registrar egresos / corregir en Modificaciones
        ↓
Consultar Panel, Reportes o Descargas
```

**Menú web (secciones):** Panel → Inventario → Producción → Comercial → Consulta → Administración.

---

## 4. Módulos en una mirada

| Módulo | Para qué sirve |
|--------|----------------|
| **Panel de control** | Resumen del mes por pestañas |
| **Inventario** | Stock y ajustes de conteo |
| **Ingreso Insumos** | Compras / entradas; egreso opcional |
| **Transferencias** | Entre ubicaciones |
| **Recetas** | Fórmula por 1 botella (admin escribe) |
| **Granel** | Alta de litros a ALM_GR |
| **Producción** | Órdenes de envasado |
| **Reempaque** | Cambio de formato ítem→ítem |
| **Ingresos** | POS multi-línea o venta rápida |
| **Despacho** | Venta de una línea |
| **Egresos** | Gastos operativos del día |
| **Modificaciones** | Corregir o anular ventas y egresos |
| **Clientes y proveedores** | Catálogo (admin; baja lógica) |
| **Auditoría** | Historial y trazabilidad |
| **Descargas** | Excel por mes |
| **Materiales / SKUs** | Catálogo de ítems y presentaciones (admin) |
| **Maestros** | Canales, empaques, categorías de gasto (admin) |
| **Usuarios** | Consulta de cuentas (solo lectura) |
| **Reportes** | Resumen operativo del periodo (admin) |
| **Configuración** | Cuenta, preferencias, caché, cerrar sesión |

---

## 5. Beneficios para la operación

1. **Una sola verdad de stock** — misma BD que la app móvil.
2. **Unidades claras** — producto terminado siempre en botellas.
3. **Listados claros en venta** — un producto por ítem; el empaque se elige después.
4. **Corrección segura** — Modificaciones anula ventas (restituye stock) y compras (revierte ingreso).
5. **Menos doble carga** — compra con precio puede generar el egreso al mismo tiempo.
6. **Trazabilidad** — lotes, auditoría y descargas.
7. **Visión gerencial** — panel mensual y reportes.
8. **Cliente opcional** en ventas.
9. **Roles simples** — acceso web, acceso ventas y admin.
10. **Sesión en el navegador** — no pide login a cada pocos minutos; se mantiene mientras la pestaña esté abierta.

---

## 6. Unidades y almacenes

| Qué | Unidad en inventario |
|-----|----------------------|
| Producto terminado | **Botellas** |
| Insumos / empaque | Su unidad (und, kg, etc.) |
| Granel | **Litros** |

**Ejemplo:** 10 packs de 6 botellas → **60 botellas**.

Almacenes habituales: materias primas (ALM_MP), granel (ALM_GR), productos terminados (ALM_PT) y puntos de venta.

---

## 7. Quién usa qué

| Perfil | Acceso típico |
|--------|---------------|
| Sin **acceso web** | No puede iniciar sesión en el ERP web |
| Acceso web, sin ventas | Bodega/producción/consulta; sin Ingresos, Despacho, Egresos ni Modificaciones |
| Acceso web + ventas | También módulos comerciales |
| Administrador | Además Materiales/SKUs, Maestros, Usuarios, Reportes, Clientes y proveedores |

Credenciales entregadas por el administrador. Los permisos se gestionan en Supabase / rol de usuario (la pantalla Usuarios es de consulta).

---

## 8. Relación con la app móvil

| Tema | Web | App móvil |
|------|-----|-----------|
| Datos | Misma Supabase | Misma Supabase |
| Uso típico | Oficina, gerencia, correcciones, catálogos | Planta, PV, operación en campo |
| Offline | Requiere conexión | Cola local ante cortes de red |
| Modificaciones | Módulo dedicado | Corrección limitada según versión |

Use ambos según el contexto; **no duplique** la misma venta o compra en ambos canales.

---

## 9. Plataforma

- Cliente: **React 19 + TypeScript + Vite**
- Backend: **Supabase** (PostgreSQL, Auth, RPC)
- Hosting: **Cloudflare Pages**
- Documentación de usuario y técnica entregada por **VIZIA S.A.C.**

---

## 10. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| Manual de uso web detallado | Paso a paso por módulo, con ejemplos |
| Resumen técnico web | Arquitectura, stack, RPC y despliegue |

Para soporte: anote el módulo, la hora y el mensaje de error, y contacte a Bodega Santa María / **VIZIA S.A.C.**

---

*VIZIA S.A.C. · Bodega Santa María · Resumen general Web v1.0.0 · 2026*
