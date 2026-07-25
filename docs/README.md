# Documentación — Bodega Santa María (Web ERP)

**VIZIA S.A.C.** · Web ERP `1.0.0` · Julio 2026 (actualizado 25/07)  
**Repo:** `web_bodegasantamaria` · **Supabase:** `cztnnkxvwiwpeifqygta`  
**Despliegue:** Cloudflare Pages (SPA)

Misma base de datos y reglas de negocio que la app móvil. Esta carpeta documenta **solo el sistema web**.

---

## Para el cliente (operación) — listos para compartir

| Documento | Formato | Descripción |
|-----------|---------|-------------|
| [01_manual_usuario_cliente_web.md](01_manual_usuario_cliente_web.md) | MD | **Manual paso a paso** — módulos, SKU, packs, PV, diagramas |
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

Los PDF incluyen:

- Portada VIZIA, tablas formateadas, encabezado/pie y numeración
- **Diagramas mermaid** convertidos a flujo visual (cajas + flechas)
- Bloques ASCII / `flow` resaltados en caja

---

## Novedades documentadas (Web 1.0.0 · Julio 2026)

- **Stock PT unificado en botellas** — pack ×6 / ×12 solo convierte cantidad; se puede vender en botellas siempre
- **SKU único** en Ingresos, Despacho, Transferencias, Producción y Ajustes
- **Ajuste de inventario en PV** — conteo físico en puntos de venta; filtro por tipo de material
- Multi-pack en UI (Botellas / Packs ×N)
- **Panel de control** gerencial por mes
- **Cliente opcional** en ventas
- **Modificaciones:** corregir ventas/egresos; anular compra (revierte stock)
- **Clientes y proveedores**, **Materiales / SKUs**, **Maestros** (admin)
- **Descargas** Excel; **Auditoría** de movimientos
- Sesión persistente (no cierra por timeouts de red al renovar token)
- Misma base Supabase que la app móvil

---

## Paquete recomendado para el usuario final

1. **Manual de uso web (PDF)** — operación día a día  
2. **Resumen general web (PDF)** — visión para gerencia  

Para el equipo técnico, agregar el **Resumen técnico web**.

---

*VIZIA S.A.C. · Bodega Santa María · Documentación Web v1.0.0 · Julio 2026*
