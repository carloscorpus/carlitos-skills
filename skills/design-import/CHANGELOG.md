# Changelog: design-import

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.2.0] - 2026-10-21

### Agregado
- Contenido de todo el sitio: `_shared.md` trae la sección "Sitio" (identidad, menús) y el spec `opciones` (`init.mjs --page opciones --type global`) documenta lo que se repite en todas las páginas: logo alternativo, contacto, redes, textos del pie, aviso superior. Campos `opciones_<área>_<campo>` en una página de opciones de ACF.
- El logo principal y el ícono del sitio se documentan como Personalizar (Identidad del sitio) y los menús como menús de WordPress; ninguno es un campo ACF.
- `analyze.mjs`: `siteWide` (cabecera, menú, pie y bloques repetidos entre páginas, con las imágenes que parecen logo).
- `check.mjs`: tipo `global`, el slug `opciones` y la tabla de menús.
- `references/sitio-global.md`.

### Cambiado
- El número de WhatsApp global de los catálogos sale de `opciones_contacto_whatsapp`.

## [1.1.0] - 2026-10-21

### Agregado
- Alcance del diseño: `_shared.md` trae las tablas "Alcance" y "Contenido dinámico". La skill pregunta una sola vez qué es cada página candidata (estática, blog, catálogo con tipo de contenido propio, WooCommerce u otro) y anota tipo de contenido, taxonomías, filtros, plantillas y la acción del botón de cada elemento (WhatsApp, formulario, contacto, carrito de Woo, ninguna). No adivina.
- `analyze.mjs`: `dynamicCandidates` (páginas que parecen listado, catálogo o tienda, con los motivos) y los formularios que solo filtran se marcan `kind: filter` sin skill sugerida, para que no vayan a `wp-form`.
- Páginas `listado` y `detalle` (`init.mjs --page … --type --content`, más `--group` y `--location`) y `references/contenido-dinamico.md`: qué se documenta, cómo se maqueta (tarjeta como componente con `$args`, filtros y paginación solo como marcado) y WooCommerce solo maquetado en `woocommerce/`.
- Grupos de ACF: cada página es un grupo de campos (`Grupo ACF` y `Ubicación` en el resumen) y cada sección un campo `group` (`Grupo: home_hero`). Los nombres de los campos no cambian (`home_hero_titulo` es como ACF guarda el subcampo `titulo`).
- `check.mjs` valida tipo, contenido, grupos y las dos tablas de `_shared.md`.

### Cambiado
- Un spec de la 1.0 sin los datos nuevos sigue pasando, con un aviso.
- Ya no se dice "sin campos group": reemplazado por el grupo por sección.

No incluye consultas, filtrado real, paginación, registro de tipos de contenido ni taxonomías, ni lógica de WooCommerce.

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
