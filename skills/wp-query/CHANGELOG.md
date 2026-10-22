# Changelog: wp-query

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.0] - 2026-10-22

### Agregado
- Skill para hacer funcionar los listados de posts y tipos de contenido propios desde los specs de `design-import` (tabla **Filtros**). Va después de `wp-acf`.
- `inc/query/motor.php` (motor genérico, con el prefijo del tema):
  - **La consulta:** trabaja sobre la consulta principal (`pre_get_posts`) del archivo del contenido, sus taxonomías y la página de entradas.
  - **Los valores de la dirección:** solo acepta los filtros del spec y valores conocidos.
  - **Los filtros:** taxonomías, opciones de ACF (select, radio, button_group, checkbox y true_false), rangos numéricos, fechas, búsqueda y orden, combinados con "y" entre filtros y "o" o "y" dentro de uno.
  - **Los conteos:** fijos o dinámicos, con caché que se renueva sola al editar contenido.
  - **La paginación:** de números, "cargar más" o infinita, siempre con los filtros puestos.
  - **Los relacionados:** de la misma categoría.
  - **El SEO:** las páginas filtradas salen con `noindex` y su canonical apunta al listado sin filtros (en WordPress, Yoast y Rank Math).
- Helpers para la vista que entregan datos y no HTML: `_query_filters`, `_query_filter`, `_query_active`, `_query_reset_url`, `_query_total`, `_query_pagination`, `_query_related`, `_query_is_filtered`. El aspecto lo pone el diseño.
- `generate.mjs`: escribe `inc/query/<contenido>.php` desde la tabla Filtros, las etiquetas del listado y el spec de detalle. Las claves de las opciones son las mismas que guarda ACF. Un archivo editado a mano es un conflicto, y un spec con errores sale con 4.
- `install.mjs` (con `--check`), `check.mjs` (zonas `data-query`, el `name` de cada filtro, sin `query_posts`, sin un `WP_Query` que reemplace el archivo, salida escapada, `php -l`) y `status.mjs`.
- Pruebas de los scripts con un tema de ejemplo y del motor en PHP con funciones de WordPress simuladas.

No incluye todavía filtrar sin recargar (el JS del motor): por ahora los filtros funcionan como un formulario normal que recarga la página.
