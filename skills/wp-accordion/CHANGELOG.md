# Changelog: wp-accordion

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.0] - 2026-10-21

### Agregado
- Primera versión. El diseño sale de Figma (o del HTML de `design-import`) y la skill aporta estructura, comportamiento, accesibilidad, movimiento y auditoría; no trae vistas de ejemplo.
- Motor sobre el `<details>` nativo: `inc/accordions.php` (`_accordion_start()`, `_item_start()`, `_item_end()`, `_end()` y `_accordion($id, $items)` para listas), `src/js/modules/accordion.js` y `src/css/accordion.css` (en `@layer components`, variables `--accordion-*`, pensado para Tailwind).
- Estructura fija y accesible: `<summary>` como botón de 44 px mínimo, foco visible, ícono decorativo (`chevron` o `plus`, al inicio o al final), panel sin alturas fijas. Opciones: `exclusive` (atributo `name` nativo), `heading`, `icon`, `icon_position`, `motion`, ítems abiertos al inicio, `id` por ítem y clases por parte.
- JS mínimo: modo exclusivo de respaldo, abrir el ítem al llegar con un `#ancla` y eventos `accordion:open` / `accordion:close`. Sin él, el acordeón funciona igual.
- Movimiento solo con CSS (`::details-content` + `interpolate-size`), apagado con `prefers-reduced-motion` y con `motion => 'none'`; sin soporte del navegador queda sin animar.
- Sin datos estructurados `FAQPage`: Google solo los muestra a sitios de gobierno y salud (desde 2023), así que no aportan en un sitio normal. Razón en `references/seo.md`.
- `install.mjs` detecta el JS y el CSS principales de Vite (`--entry`, `--css`), conecta `functions.php`, el JS y el CSS sin duplicar, sella la versión del motor y agrega su bloque al `CLAUDE.md` del tema.
- `tests/check.mjs`: auditoría estática del HTML renderizado (resumen, nombre accesible, interactivos dentro del `<summary>`, `h1`, ARIA a mano, paneles ocultos, `name` en modo exclusivo, ids, imágenes e iframes) con `--self-test` y fixtures.
- Referencias: mapeo del diseño, accesibilidad, SEO, movimiento y criterios de aceptación.
