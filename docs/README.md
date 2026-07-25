# Documentación — Bodega Santa María (Web ERP)

**VIZIA S.A.C.** · Web ERP `1.0.0` · Julio 2026  
**Repo:** `web_bodegasantamaria` · **Supabase:** `cztnnkxvwiwpeifqygta`  
**Despliegue:** Cloudflare Pages (SPA)

Misma base de datos y reglas de negocio que la app móvil. Esta carpeta documenta **solo el sistema web**.

---

## Para el cliente (operación) — listos para compartir

| Documento | Formato | Descripción |
|-----------|---------|-------------|
| [01_manual_usuario_cliente_web.md](01_manual_usuario_cliente_web.md) | MD | **Manual paso a paso** — módulos web, ejemplos, correcciones |
| [pdf/Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf](pdf/Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf) | PDF | Manual profesional para personal operativo |
| [00_resumen_general_vizia_web.md](00_resumen_general_vizia_web.md) | MD | Visión ejecutiva del ERP web |
| [pdf/Resumen_General_WEB_VIZIA_Bodega_Santa_Maria.pdf](pdf/Resumen_General_WEB_VIZIA_Bodega_Santa_Maria.pdf) | PDF | Resumen para gerencia / dirección |

---

## Para TI / VIZIA

| Documento | PDF |
|-----------|-----|
| [02_resumen_tecnico_vizia_web.md](02_resumen_tecnico_vizia_web.md) | [Resumen_Tecnico_WEB_VIZIA_Bodega_Santa_Maria.pdf](pdf/Resumen_Tecnico_WEB_VIZIA_Bodega_Santa_Maria.pdf) |

La documentación detallada de tablas, triggers y RPC compartidos con la app móvil está en el repositorio de la app (`docs/DOCUMENTACION_BD_Y_LOGICA.md`).

---

## Regenerar PDFs

Requisito: Python 3 + `reportlab` (`pip install reportlab`).

```bash
python docs/build_pdf.py
```

Un solo PDF:

```bash
python docs/build_pdf.py --only Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf
```

Los PDF incluyen portada VIZIA, tablas formateadas, encabezado/pie de página y numeración.

---

## Novedades documentadas (Web 1.0.0 · Julio 2026)

- **Panel de control** gerencial por mes (pestañas Ejecutivo, Financiero, Operaciones, etc.)
- **SKU único** en Ingresos y Despacho: un producto por ítem PT; stock en botellas; luego botella o pack
- **Cliente opcional** en ventas
- **Modificaciones:** corregir ventas/egresos; anular compra (revierte stock) desde egreso origen COMPRA
- **Clientes y proveedores** (admin): alta, edición y baja lógica
- **Materiales / SKUs** y **Maestros** en web (admin)
- **Descargas** Excel por mes; **Auditoría** de movimientos
- Sesión persistente en el navegador (no cierra por timeouts de red al renovar token)
- Misma base Supabase que la app móvil

---

## Paquete recomendado para el usuario final

1. **Manual de uso web (PDF)** — operación día a día en el navegador  
2. **Resumen general web (PDF)** — visión para gerencia  

Para el equipo técnico, agregar el **Resumen técnico web**.

---

*VIZIA S.A.C. · Bodega Santa María · Documentación Web v1.0.0*
