# Changelog: wp-modal

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.0] - 2026-10-17

### Agregado
- Primera versión, reescrita de cero. El diseño sale de Figma y la skill aporta estructura, comportamiento, accesibilidad y movimiento; no trae vistas de ejemplo.
- Motor sobre el `<dialog>` nativo: `inc/modals.php` (`_modal_start()`, `_modal_end()`, `_modal_trigger_attrs()`), `src/js/modules/modal.js` y `src/css/modal.css` (en `@layer components`, variables `--modal-*`, pensado para Tailwind).
- Estructura fija y accesible: título con `aria-labelledby`, descripción opcional, botón de cerrar de 44 px, cuerpo con scroll. Opciones: `placement`, `role` (`alertdialog` para confirmaciones), `width` exacto, `mobile` (`center`, `sheet`, `fullscreen`), clases por parte.
- Movimiento: `motion` (`fade`, `scale`, `slide`, `none`), microinteracción `stagger` y `prefers-reduced-motion` (queda solo un fundido). Catálogo y recomendaciones en `references/motion.md`.
- Apertura automática opcional (`load`, `delay`, `scroll`; `always`, `session`, `days:N`; `min_width`), apagada por defecto.
- Formularios: la skill pregunta si el form va con `wp-form` o independiente. Con `wp-form`, `form_success` (`keep` o `close`) usa el evento `wp-form:success`.
- `install.mjs` detecta el JS y el CSS principales de Vite (`--entry`, `--css`), conecta `functions.php`, el JS y el CSS sin duplicar, sella la versión del motor y agrega su bloque al `CLAUDE.md` del tema.
- `tests/check.mjs`: auditoría estática del HTML renderizado (nombre accesible, botón de cerrar, `h1`, `open`, ids, disparadores, imágenes e iframes, alertdialog) con `--self-test` y fixtures.
- Referencias: tipo de panel, mapeo de Figma, accesibilidad, SEO, movimiento, apertura automática, formularios y criterios de aceptación.
