# Documentación — Bodega Santa María (Web ERP)

**VIZIA S.A.C.** · Web ERP `1.0.0` · Julio 2026 (actualizado 25/07)  
**Repo:** `web_bodegasantamaria` · **Supabase:** `cztnnkxvwiwpeifqygta`  
**Despliegue:** Cloudflare Pages (SPA)

Misma base de datos que la app móvil. Esta carpeta documenta **solo el sistema web**.

---

## Para el cliente (operación)

| Documento | Formato | Descripción |
|-----------|---------|-------------|
| [01_manual_usuario_cliente_web.md](01_manual_usuario_cliente_web.md) | MD | Manual paso a paso |
| [pdf/Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf](pdf/Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf) | PDF | Manual operativo |
| [00_resumen_general_vizia_web.md](00_resumen_general_vizia_web.md) | MD | Visión ejecutiva |
| [pdf/Resumen_General_WEB_VIZIA_Bodega_Santa_Maria.pdf](pdf/Resumen_General_WEB_VIZIA_Bodega_Santa_Maria.pdf) | PDF | Resumen gerencia |

---

## Para TI / VIZIA

| Documento | PDF |
|-----------|-----|
| [02_resumen_tecnico_vizia_web.md](02_resumen_tecnico_vizia_web.md) | [Resumen_Tecnico_WEB_VIZIA_Bodega_Santa_Maria.pdf](pdf/Resumen_Tecnico_WEB_VIZIA_Bodega_Santa_Maria.pdf) |

Tablas/triggers compartidos: documentación BD del repo de la app.

---

## Regenerar PDFs

```bash
pip install reportlab
python docs/build_pdf.py
```

Un PDF:

```bash
python docs/build_pdf.py --only Manual_Usuario_WEB_VIZIA_Bodega_Santa_Maria.pdf
```

Incluye portada VIZIA, tablas, diagramas mermaid como flujo visual, encabezado/pie y numeración.

---

## Funcionamiento documentado (estado actual)

- **SKU = botellas** — packs ×6/×12 solo convierten cantidad
- **Almacén ↔ tipo** — ALM_MP (material/insumo/empaque), ALM_GR (granel), ALM_PT/PV (PT)
- Validación en **web** (`ubicacionItemPolicy`) y **Supabase** (`fn_assert_item_ubicacion`)
- Ingreso insumos solo ALM_MP/ALM_GR; producción destino ALM_PT
- Ajuste de inventario: filtro almacén + tipo permitido
- Transferencias sin TRANSIT manual; valida origen/destino
- Ventas/despacho por SKU; cliente opcional
- Modificaciones: ventas y egresos / anular compra
- Panel, descargas, auditoría, catálogos admin
- Sesión persistente en el navegador

---

## Paquete recomendado

1. Manual de uso web (PDF)  
2. Resumen general web (PDF)  
3. (TI) Resumen técnico web (PDF)

---

*VIZIA S.A.C. · Bodega Santa María · Documentación Web v1.0.0 · Julio 2026*
