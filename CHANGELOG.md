# Changelog: carlitos-skills

Cambios del plugin completo. El detalle de cada skill está en `skills/<skill>/CHANGELOG.md`.

## [1.6.0] - 2026-10-17

### Cambiado
- `wp-modal` 1.1.0: el diseño sale de Figma. Ancho exacto (`width`), comportamiento en móvil (`mobile`), clases por parte y variables nuevas; los tamaños `sm/md/lg/xl/full` quedan solo como respaldo. Corrige la animación (panel translúcido, salto al cerrar) y el salto de página al bloquear el scroll. Compatible con 1.0.0.

## [1.5.0] - 2026-10-17

### Agregado
- Skill `wp-modal` 1.0.0: modales, drawers, lightbox y confirmaciones con el `<dialog>` nativo.
- `shared/common.mjs`: `detectCssEntry` (detecta el CSS principal de Vite como ya se hacía con el JS). Las copias de las tres skills se actualizaron; `wp-form` y `wp-vite-theme` no cambian de comportamiento.

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
