# The view contract

The template keeps the design's HTML. It replaces fixed sample data with the engine's data and keeps the zones that change when filtering.

## Zones

| Zone | Element | Required |
|---|---|---|
| `data-query="filtros"` | the `<form method="get">` with the filters | when the list has filters |
| `data-query="resultados"` | the grid or list of items, including the empty state | always |
| `data-query="paginacion"` | the wrapper of `<prefix>_query_pagination()` | unless `Paginación: ninguna` |
| `data-query="total"` | the "N resultados" text (`aria-live="polite"`) | recommended |

## Helpers (`<prefix>` is the theme prefix)

| Helper | Returns |
|---|---|
| `<prefix>_query_filters()` | `[clave => filter]` of the current list. Each filter has `clave`, `name` (`categoria[]` when it takes several values), `tipo`, `vista`, `etiqueta` (the taxonomy's name if the spec gives none), `varios`, `valor` and `opciones`. Each option has `valor`, `etiqueta`, `conteo` (null without counts), `marcada`, `desactivada`, `url` (toggles it) and `hijos` (nested terms). A range adds `min`, `max` and `names` [`min`, `max`]; a date adds the years with content as `opciones` and `names` [`desde`, `hasta`]. |
| `<prefix>_query_filter('precio')` | one filter of the above, or null |
| `<prefix>_query_active()` | the active filters as chips: `filtro`, `etiqueta`, `url` that removes it |
| `<prefix>_query_reset_url()` | the list without filters (the form's `action` and the "Limpiar" link) |
| `<prefix>_query_total()` | `['numero' => 12, 'texto' => '12 resultados']` |
| `<prefix>_query_pagination($args)` | prints `<nav aria-label="Paginación">`: numbers, or one "Cargar más" link (`data-query-mas`) for `cargar más` / `infinito`. `$args`: `prev_text`, `next_text`, `more_text`, `class` |
| `<prefix>_query_related($post, $n)` | a `WP_Query` with related items; call `wp_reset_postdata()` after the loop |
| `<prefix>_query_is_filtered()` | true when any filter, search or sort is active |

## Pattern

```php
<form method="get" action="<?php echo esc_url(demo_query_reset_url()); ?>" data-query="filtros">
    <?php $categoria = demo_query_filter('categoria'); ?>
    <fieldset>
        <legend><?php echo esc_html($categoria['etiqueta']); ?></legend>
        <?php foreach ($categoria['opciones'] as $opcion) : ?>
            <label class="chip">
                <input type="checkbox" name="<?php echo esc_attr($categoria['name']); ?>" value="<?php echo esc_attr($opcion['valor']); ?>"
                    <?php checked($opcion['marcada']); ?> <?php disabled($opcion['desactivada']); ?>>
                <?php echo esc_html($opcion['etiqueta']); ?>
                <?php if ($opcion['conteo'] !== null) : ?><span>(<?php echo esc_html((string) $opcion['conteo']); ?>)</span><?php endif; ?>
            </label>
        <?php endforeach; ?>
    </fieldset>
    <button type="submit">Aplicar</button>
</form>

<p data-query="total" aria-live="polite"><?php echo esc_html(demo_query_total()['texto']); ?></p>

<div data-query="resultados">
    <?php if (have_posts()) : ?>
        <?php while (have_posts()) : the_post(); ?>
            <?php get_template_part('template-parts/components/producto-card', null, ['id' => get_the_ID()]); ?>
        <?php endwhile; ?>
    <?php else : ?>
        <p>No hay productos con estos filtros. <a href="<?php echo esc_url(demo_query_reset_url()); ?>">Limpiar filtros</a></p>
    <?php endif; ?>
</div>

<div data-query="paginacion"><?php demo_query_pagination(); ?></div>
```

- The card component keeps receiving its data in `$args`: build the same array from the current post (title, link, image, ACF fields) instead of the fixed sample arrays.
- Write each control with the design's classes and the helper's data; a filter the design shows as a select stays a select.
- `Al filtrar: botón aplicar` keeps a submit button. With `sin recargar` the button can be visually hidden, but it stays in the form so the list works without JavaScript.
- `Filtros en móvil: panel`: the form goes inside the `wp-modal` drawer of the spec; it is the same form, not a copy.
- The empty state is inside `resultados`, with a link to `<prefix>_query_reset_url()` when the design has one.

## Without reload (`src/js/modules/query.js`)

The main JS imports the module only on pages with `[data-query="resultados"]`. It needs nothing from the template beyond the zones; the list's settings (`Al filtrar`, `Paginación`) come in `<script id="wp-query-config">`, printed by the engine.

- **Filtering.** With `Al filtrar: sin recargar`, any change in the form loads the new URL; a search, number or range field waits 300 ms after the last key. With `botón aplicar`, only submitting does. Empty values, `paged` and a range end equal to its input's `min`/`max` are left out of the URL; several values become `categoria=sillas,mesas`.
- **The request.** The same URL with the header `X-WP-Query: 1`. The engine renders the page with its normal template and answers JSON with the HTML of every `data-query` zone. The module replaces each zone it receives (any name, not only the four of the table), keeps the focus and the caret of the field being typed in, sets `aria-busy` on `resultados`, updates the title and announces the new total. A response that is HTML (a page cache) is read the same way; any error opens the URL as a normal page.
- **History.** Each filter is a new history entry (typing replaces it). The back button reloads the zones of that URL.
- **Links.** Links inside a zone (chips, "Limpiar", pagination numbers) load without reload; links inside `resultados` (the cards) and links with `data-query-ignorar` are normal links. A pagination number scrolls to the results (instantly with `prefers-reduced-motion`).
- **Load more / infinite.** The `data-query-mas` link of `<prefix>_query_pagination()` appends the next page's items. When the grid is an inner element of the zone, mark it `data-query-items` (the items are its children); otherwise the zone's children are the items. `cargar más` moves the focus to the first new item; `infinito` loads when the link comes into view and keeps the link as a fallback.
- **Event.** After each update `document` receives `wp-query:update` (`detail`: `url`, `total`, `zonas`), for example to close the mobile filters drawer or re-run an animation.
