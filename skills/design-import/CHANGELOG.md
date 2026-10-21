# Changelog: design-import

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.1] - 2026-10-21

### Cambiado
- Los acordeones se delegan a `wp-accordion` (antes decía "la skill de acordeón"): `analyze.mjs` la sugiere en la interacción `accordion`, y `SKILL.md`, `formato-spec.md`, `malas-practicas.md`, `acceptance.md` y `destino-wp-vite-theme.md` la nombran (destino `template-parts/accordions/`).

## [1.0.0] - 2026-10-21

### Agregado
- Skill para reordenar el diseño que exporta Claude Design (carpeta con HTML + CSS + JS estático, agregada con `/add-dir`) dentro de un tema WordPress: tokens, componentes, secciones y plantillas de página, solo front.
- `scripts/analyze.mjs`: inventario de solo lectura (páginas y secciones, tokens, bloques repetidos, interacciones y malas prácticas con archivo:línea). No ejecuta nada de la carpeta fuente.
- `scripts/init.mjs`: crea `specs/_index.md`, `specs/_shared.md` y un spec por página (`--page`), y mantiene un bloque corto en el `CLAUDE.md` del tema.
- `scripts/check.mjs`: valida los specs (formato, nomenclatura `<página>_<sección>_<campo>`, tipos ACF, criterios, estados) y su coherencia con el PHP aplicado.
- Destino `wp-vite-theme` (`template-parts/pages/<página>/` y `template-parts/components/`) o el que detecte en otro proyecto, confirmado una sola vez.
- Etapas con aprobación: `_shared.md`, luego cada página; solo se aplica lo `aprobado`. Un subagente por página cuando hay más de tres.
- Formularios, modales, acordeones, imágenes y enlaces se delegan a `wp-form`, `wp-modal` y `wp-helper`.
- Los campos ACF se documentan, no se crean; sin límites para el usuario (solo recomendaciones en la descripción).

No incluye comparación visual automática ni crea campos ACF.
