# Changelog: carlitos-skills

Cambios del plugin completo. El detalle de cada skill está en `skills/<skill>/CHANGELOG.md`.

## [1.4.0] - 2026-10-17

### Cambiado
- `wp-vite-theme` 1.1.0: el tema nuevo incluye `page-templates/template-inicio.php` ("Página de inicio") y un `CLAUDE.md` más corto.
- `wp-form` 1.2.0: agrega su bloque al `CLAUDE.md` del tema. Convención para las skills nuevas: cada una mantiene su propio bloque corto (`claudeBlock` en `shared/common.mjs`).

## [1.3.0] - 2026-10-17

### Agregado
- `shared/common.mjs`: código común de las skills (un solo original). `scripts/sync-shared.mjs` lo copia a `skills/<skill>/scripts/lib/` para que cada skill funcione aunque se copie sola; `--check` falla si alguna copia no coincide.
- Versión por skill (`metadata.version` en `SKILL.md`) y un `CHANGELOG.md` por skill.

### Cambiado
- `wp-form` 1.1.0: ya no exige un tema creado con `wp-vite-theme`.
- `wp-vite-theme` 1.0.1: usa el código común.

## [1.2.0]
Último estado antes de llevar changelog. Para versiones anteriores, ver `git log`.
