# Changelog: wp-vite-theme

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.1.0] - 2026-10-17

### Agregado
- `page-templates/template-inicio.php` con `Template Name: Página de inicio`: la página de inicio ya viene creada, con `get_header()`, `<main id="main-content">` y `get_footer()` una sola vez.
- Regla en `CLAUDE.md` y en la skill: las plantillas de página van en `page-templates/template-<nombre>.php` y no se crea `front-page.php` (WordPress lo usa antes que la plantilla elegida en el admin).

### Cambiado
- `CLAUDE.md` del tema más corto (de unas 45 a 20 líneas): sin las secciones Estructura y Entradas Vite (se ven con un `ls`), sin la repetición de pnpm y con la seguridad pnpm resumida. Quedan solo las reglas que evitan errores. Cada skill que se use después agrega su propio bloque corto.
- El paso final indica crear la página "Inicio" con esa plantilla y fijarla como página de inicio en Ajustes → Lectura.

## [1.0.1] - 2026-10-17

### Cambiado
- `scaffold.mjs` usa el código común de `scripts/lib/common.mjs` (copia generada desde `shared/common.mjs`). Mismo comportamiento y mismas salidas.

## [1.0.0] - 2026-10-14

### Agregado
- Base del tema WordPress con Vite, Tailwind y pnpm (`scaffold.mjs` y plantillas).
- El slug del tema debe empezar con letra (el prefijo PHP sale del slug).

### Corregido
- Vite usa `server.ws.host` en lugar de la opción `server.hmr.host`, que está en desuso.
- Detener `pnpm dev` en Windows sin dejar un Vite huérfano ni el archivo `hot`.
