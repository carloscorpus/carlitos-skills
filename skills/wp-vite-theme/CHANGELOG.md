# Changelog: wp-vite-theme

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

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
