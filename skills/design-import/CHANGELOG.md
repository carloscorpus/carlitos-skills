# Changelog: design-import

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.6.0] - 2026-10-22

### Agregado
- Tabla **Filtros** en el spec de cada listado: el nombre de cada filtro en la URL, su tipo (`taxonomía`, `rango`, `opciones`, `fecha`, `búsqueda`, `orden`), de dónde sale (la taxonomía del contenido o un campo ACF del detalle), si admite varios valores (`sí (o)` / `sí (y)`), su conteo (`ninguno`, `fijo`, `dinámico`) y cómo se ve en el diseño. Más las etiquetas `Al filtrar`, `Paginación`, `Por página` y `Filtros en móvil`. Es lo que lee wp-query para conectar filtros combinados.
- `init.mjs --type listado` agrega la tabla vacía y las etiquetas con sus valores por defecto.
- `check.mjs` valida la tabla: la taxonomía existe en su fila de "Contenido dinámico", el campo existe en el detalle con un tipo compatible, los nombres no chocan con variables de WordPress, y "Varios" y "Conteo" solo van en taxonomías y opciones. Un listado sin tabla solo avisa.
- El maquetado de filtros usa los nombres de la tabla y marca con `data-query` las partes que se actualizan (`filtros`, `resultados`, `paginacion`, `total`).

### Corregido
- `init.mjs` deja el spec con un solo tipo de salto de línea aunque la plantilla venga con `\r\n` (Windows).

## [1.5.0] - 2026-10-22

### Agregado
- Etiqueta `Padre` en el resumen de la página (`ninguno` por defecto; los specs sin ella siguen pasando): el slug de otra página estática de la que cuelga. `init.mjs --page … --parent <slug>` la escribe y `check.mjs` rechaza un padre que no existe o no es estático, la página de inicio con padre y los ciclos. `wp-acf` 1.3.0 la crea como página hija.

## [1.4.1] - 2026-10-22

### Agregado
- `status.mjs`: una sola lectura del tema (solo lee) que dice si tiene la estructura de `wp-vite-theme` (`askStructure`), su prefijo y los helpers de `wp-helper`, si hay specs y cuántas páginas hay por estado, si el motor de `wp-acf` está instalado y el siguiente paso. El paso 1 de `SKILL.md` lo corre primero, para no explorar el tema a mano ni preguntar una estructura que ya se conoce.

## [1.4.0] - 2026-10-21

### Agregado
- Etiqueta opcional `ACF: pendiente | conectado` en cada sección (la escribe `wp-acf`). Con `conectado`, `check.mjs` no compara el "valor actual" con la plantilla, porque el texto ya salió del PHP y vive en la carga inicial de ACF. Los specs anteriores siguen pasando.

### Corregido
- `check.mjs` exige la fila del repetidor antes de sus subcampos (`home_hero_slides` antes de `home_hero_slides.imagen`); sin ella `wp-acf` no puede armar el campo.

### Cambiado
- El lector de specs (etiquetas, tablas, índice, contenido dinámico, páginas) vive en `shared/specs.mjs` y se copia a `scripts/lib/specs.mjs`; `check.mjs` lo usa y comparte con `wp-acf`.

## [1.3.1] - 2026-10-21

### Corregido
- `check.mjs`: el "valor actual" también se busca en los textos entre comillas de los bloques PHP (una variable o arreglo al inicio de la plantilla) y en los atributos `alt`, `title`, `aria-label` y `placeholder`. Antes solo miraba el texto entre etiquetas y daba falsos errores en las plantillas que guardan el texto fijo en variables (56 en la portada de un tema real). Los marcadores de resaltado `|` y `*` se ignoran al comparar.

## [1.3.0] - 2026-10-21

### Cambiado
- Los criterios de aceptación comunes se escriben una sola vez, en la sección "Criterios comunes" de `_shared.md` (todas las secciones, según lo que tenga la sección y cada página). Cada sección dice "Cumple los criterios comunes de `_shared.md`" y lista solo los suyos; un spec ya no repite el mismo bloque en cada sección.
- Las notas de página son una lista (una nota por línea) y ya no llevan los criterios de página.
- `references/acceptance.md` y `formato-spec.md` describen el formato nuevo.

### Agregado
- `check.mjs` avisa cuando una sección repite tres o más criterios comunes, cuando remite a "Criterios comunes" sin que `_shared.md` los tenga, y cuando las notas de página son un párrafo largo o traen criterios de página. Los specs anteriores a la 1.3.0 siguen pasando.

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
