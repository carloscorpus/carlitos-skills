## Listados y filtros (wp-query {{ENGINE_VERSION}})
- `inc/query/motor.php` y `src/js/modules/query.js` son el motor: no los edites (se actualizan desde la skill). El JS cambia los resultados sin recargar reemplazando solo las zonas `data-query`; sin JS, el listado funciona igual recargando.
- El motor PHP trabaja sobre la consulta principal de cada listado con `pre_get_posts`: nunca `query_posts` ni un `new WP_Query` que la reemplace en un archivo.
- Cada listado se define en `inc/query/<contenido>.php`, generado por `wp-query` (`generate.mjs`) desde la tabla "Filtros" de su spec: no lo edites a mano; cambia el spec y vuelve a generar.
- La vista pinta los datos de `{{PREFIX}}_query_filters()`, `{{PREFIX}}_query_active()`, `{{PREFIX}}_query_total()` y `{{PREFIX}}_query_pagination()` con el HTML del diseño. Las zonas que cambian al filtrar llevan `data-query="filtros|resultados|paginacion|total"`.
- Los filtros son un `<form method="get">` normal: el `name` de cada control es el del spec (`categoria[]`, `precio_min`, `q`, `orden`).
- Relacionados: `{{PREFIX}}_query_related()` devuelve un `WP_Query`; después del loop va `wp_reset_postdata()`.
- Las páginas filtradas salen con `noindex` y su canonical apunta al listado sin filtros.
