# Changelog: wp-modal

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.0] - 2026-10-17

### Agregado
- Primera versión: motor de modales con el `<dialog>` nativo. `inc/modals.php` (`_modal_start()`, `_modal_end()`, `_modal_trigger_attrs()`), `src/js/modules/modal.js` y `src/css/modal.css`.
- Estructura fija y accesible (título con `aria-labelledby`, botón de cerrar de 44 px con `<form method="dialog">`, cuerpo con scroll) y contenido libre. Opciones de tamaño, posición, modo (`modal` o `non-modal`) y rol (`dialog` o `alertdialog`).
- Se abre sin JavaScript con `command`/`commandfor`; el JS cubre los navegadores sin Invoker Commands, los enlaces `<a href>` y el modo no modal. Clic fuera para cerrar (no en `alertdialog`), Esc en modo no modal y eventos `modal:open` / `modal:close`.
- Apertura automática opcional (`load`, `delay` o `scroll`; `always`, `session` o `days:N`; `min_width`), apagada por defecto.
- `install.mjs` detecta el JS y el CSS principales de Vite (`--entry`, `--css`), conecta `functions.php`, el JS y el CSS sin duplicar, sella la versión del motor y agrega su bloque al `CLAUDE.md` del tema.
- Ejemplos (contenido, confirmación, lightbox, drawer, formulario) y referencias (tipo de panel, accesibilidad y SEO, apertura automática, criterios de aceptación).
- `tests/check.mjs`: auditoría estática del HTML renderizado, con `--self-test` y fixtures.
