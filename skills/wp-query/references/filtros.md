# Filters: storage, query and URL

`generate.mjs` turns each row of a list's **Filtros** table into an entry of `inc/query/<contenido>.php`. The engine reads the URL, keeps only known values (whitelist) and builds the main query. Different filters always combine with "and".

| Tipo | URL | Whitelist | Query |
|---|---|---|---|
| `taxonomía` | `?categoria=sillas,mesas` or `categoria[]=sillas&categoria[]=mesas` | terms that exist (by slug) | `tax_query`, `IN` for `sí (o)`, `AND` for `sí (y)`; a parent term includes its children |
| `opciones` (select, radio, button_group) | `?material=madera` | the field's option keys | `meta_query` `=` (one) or `IN` (several with "o"); several with "y" give no results (a single-value field cannot have two values) |
| `opciones` (checkbox) | `?colores=negro,blanco` | option keys | ACF stores a serialized array: one `LIKE '"negro"'` per value, joined with OR or AND |
| `opciones` (true_false) | `?destacado=1` | only `1` | `meta_query` `= '1'` |
| `rango` | `?precio_min=100&precio_max=300` (or `?precio=100-300`) | numbers, swapped if reversed; an end equal to the real min/max is dropped | `meta_query` `BETWEEN` / `>=` / `<=`, `DECIMAL` |
| `fecha` (`post_date`) | `?anio=2024`, `?anio=2024-05`, or `anio_desde` / `anio_hasta` (`Y-m-d`) | valid dates | `date_query` |
| `fecha` (date_picker) | same | same | `meta_query` on `Ymd` (`NUMERIC`); date_time_picker on `Y-m-d H:i:s` (`DATETIME`) |
| `búsqueda` | `?q=silla` | text, 100 characters | `s` on the main query |
| `orden` | `?orden=az`, `?orden=precio-asc` | the table's options | `date`, `title`, `relevance` (only with a search), or the field (`meta_value_num` for numbers); items without the field go last |

- The option keys are the ones ACF stores, derived from the field's `Opciones:` (`Café claro` → `cafe_claro`).
- A field order's URL value is the field name without its section group (`producto_ficha_precio` → `precio-asc`).
- On a taxonomy archive (`/categoria-producto/sillas/`) that term stays fixed and the filters are added on top.
- With no `orden` in the URL, the first option of the table is used.
- Changing a filter goes back to page 1; the pagination links keep the active filters.

## Counts

| Conteo | What it counts | Cost |
|---|---|---|
| `ninguno` | nothing (`conteo` is `null`) | none |
| `fijo` | all published items of the content per option | one grouped query, cached |
| `dinámico` | per option, the results with the *other* active filters | one ID query per counted filter plus one grouped query, cached per combination |

The cache key carries a content version stored in an option (`<prefix>_query_version`), bumped when an item, its fields or its terms change. Options with `conteo` 0 come back `desactivada` (unless checked). The design decides whether they are hidden or greyed out.

## SEO

A page with any filter, search or sort is `noindex, follow`, and its canonical is the list without filters: the core `wp_robots`, Yoast (`wpseo_robots`, `wpseo_canonical`) and Rank Math. Pagination alone stays indexable.
