# Bodega Santa María — Web ERP

Panel web operativo para el ERP de Bodega Santa María. Conecta con **Supabase** (mismo backend que la app INPUT Flutter) y expone los módulos operativos vía RPC transaccional.

## Stack

- React 19 + TypeScript + Vite 6
- Supabase Auth + PostgREST + RPC (`fn_*`)
- Despliegue: **Cloudflare Pages** (SPA estático, `BrowserRouter`)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Opcional: editar .env.local (si no, usa supabaseConfig.ts embebido)
npm run dev
```

Abre `http://localhost:3000`

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública |

En Cloudflare Pages configúralas en **Settings → Environment variables**. Si faltan, la app usa los valores por defecto de `src/config/supabaseConfig.ts`.

## Build

```bash
npm run build
npm run preview
```

Salida en `dist/`

## Despliegue en Cloudflare Pages

1. Repo conectado: [github.com/viziasac/web_bodegasantamaria](https://github.com/viziasac/web_bodegasantamaria)
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Connect to Git**
3. Configuración de build:

| Campo | Valor |
|-------|--------|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 20 |

4. Variables de entorno (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Deploy — la SPA usa `BrowserRouter` (`/inventory`, `/privacidad`). Cloudflare Pages necesita `public/_redirects` (`/* /index.html 200`) para rutas profundas. El `base` de Vite debe ser `/` (no relativo) para que los assets carguen en rutas anidadas.

Headers de seguridad y caché de assets: `public/_headers`.

## Módulos

| Ruta | Módulo |
|------|--------|
| `/login` | Acceso |
| `/privacidad` | Política de privacidad (pública) |
| `/` | Dashboard gerencial (selector por mes) |
| `/inventory` | Inventario |
| `/inventory/adjust` | Ajuste manual |
| `/purchases` | Ingreso insumos |
| `/production` | Producción envasado |
| `/production/bulk` | Granel |
| `/repack` | Reempaque |
| `/sales/dispatch` | Despacho |
| `/sales/income` | Ingresos POS |
| `/transfers` | Transferencias |
| `/expenses` | Egresos |
| `/recipes` | Recetas (consulta; admin puede crear/editar) |
| `/materials` | Materiales / SKUs (solo admin: ver + crear, sin eliminar) |
| `/audit` | Auditoría / trazabilidad |
| `/downloads` | Descargas Excel por módulo |
| `/reporting` | Reportes (solo admin) |
| `/settings` | Configuración |

## Referencia

Lógica alineada con la app INPUT Flutter (`bodega_santa_maria`). Contrato RPC: `erp_contract.dart` / `src/config/erpContract.ts`.
