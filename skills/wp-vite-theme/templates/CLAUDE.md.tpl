# {{THEME_NAME}} — tema WordPress

Stack: WordPress (Local WP) + Vite + JS + Tailwind + ACF (campos creados desde el admin).

## Reglas
- Gestor de paquetes: **pnpm** únicamente. Nunca npm/yarn/npx (usar `pnpm dlx`).
- Prefijo PHP: `{{PREFIX}}_`. Text domain: `{{THEME_SLUG}}`.
- `functions.php` solo carga archivos de `inc/`. Lógica nueva → nuevo archivo en `inc/`.
- Archivos de `inc/` empiezan con `defined('ABSPATH') || exit;`.
- Escapar toda salida: `esc_html`, `esc_url`, `esc_attr`.
- Partes reutilizables en `template-parts/`.
- Dev = entorno local (`wp_get_environment_type`) + archivo `hot` (lo crea `pnpm dev`, HMR en `localhost:5173`). Si no, producción vía `dist/manifest.json`.
- Scripts siempre con `type="module"` (dev y prod).
- No crear `acf.php` ni field groups en código salvo que se pida.

## Tailwind
- Detección automática de clases; no agregar `@source` salvo que una ruta no se detecte.

## Seguridad pnpm
- La configuración vive en `pnpm-workspace.yaml` (`minimumReleaseAge`, `trustPolicy`, `blockExoticSubdeps`, `strictDepBuilds`).
- `minimumReleaseAge: 1440` es el valor decidido; no modificarlo sin preguntar.
- Nunca aprobar builds (`allowBuilds`) sin revisar el paquete.
- Nunca usar npm/yarn/npx.

## Comandos
- `pnpm dev` — servidor Vite con HMR (crea `hot`; se borra al detenerlo)
- `pnpm build` — genera `dist/` + `manifest.json`

## Estructura
- `inc/` — `setup.php`, `enqueue.php`, `cleanup.php`
- `template-parts/` — partes reutilizables
- `src/css/input.css` — Tailwind
- `src/js/main.js`

## Entradas Vite
- `src/css/input.css` (Tailwind)
- `src/js/main.js`

## Deploy
- El repo guarda solo código fuente; `dist/` está en `.gitignore` y no se commitea.
- Para publicar: `pnpm build` con el dev server detenido, y subir `dist/` más los PHP modificados.
- Nunca subir al servidor: `hot`, `node_modules/`, `src/`, ni archivos de config (`package.json`, `pnpm-*`, `vite.config.ts`, `CLAUDE.md`).
