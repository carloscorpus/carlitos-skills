---
name: wp-query
description: 'Make the lists of a WordPress theme work from the specs written by design-import: the real loop of posts and custom post types, combined filters (taxonomies, ACF option fields, numeric ranges, dates, search and sort), counts per option, pagination, related items and SEO-safe filtered pages, on the main query (pre_get_posts). The design is kept: the engine gives the data and the theme''s HTML paints it. One generic engine, one generated definition per list, one subagent per list for the templates. Use when the user says "conecta los listados", "haz funcionar los filtros", "filtros combinados", "buscador", "paginación", "relacionados", "blog con filtros", "catálogo con filtros", or a spec says `skill: wp-query`. Runs after wp-acf. WooCommerce is another skill.'
metadata:
  version: "1.0.0"
---

# wp-query

`design-import` leaves each list (`Tipo: listado`) with a **Filtros** table, the labels `Al filtrar`, `Paginación`, `Por página` and `Filtros en móvil`, and a template with the design's sample items. `wp-acf` registers the content types, taxonomies and fields. This skill makes the list real: the main query of the archive is filtered, sorted and paginated from the URL, the counts come from the content, and the template loops the real items through the same card component.

The design rules the look. The engine never prints filter markup: it returns data (options, counts, checked, disabled, URLs) and the template keeps the design's HTML around it.

## What it does and does not do

- **Does:** posts (`post`: the posts page, categories, tags) and custom post types with their taxonomies; every filter type of the table (taxonomía, opciones, rango, fecha, búsqueda, orden) combined with "and" between filters and "or"/"and" inside one; counts `fijo` or `dinámico`; pagination `números`, `cargar más`, `infinito` or `ninguna`; related items on the detail; `noindex` and canonical on filtered pages.
- **Does not:** register content types, taxonomies or fields (`wp-acf`), WooCommerce (another skill), multilanguage, or a design of its own. Updating without reload is the engine's JS (wp-query 1.1); until then the filters are a normal GET form.

## Flow

1. **Read the context.** From the theme root run `node <skill>/scripts/status.mjs`: whether the engine is installed and up to date, each list's definition (`falta`, `al día`, `distinta`), each list's table and how many sections are `Query: conectado`, and `next`. Skip what it shows as done. A list without the "Filtros" table is completed first: run design-import for it, or fill it with the user following design-import's `references/formato-spec.md` ("Filters"). Only `aplicado` lists are connected; ask before touching one that is only `aprobado`.

2. **Install the engine.** `node <skill>/scripts/install.mjs --dry-run`, show `conflicts` and ask, then without `--dry-run` (with `--overwrite` / `--skip`). It copies `inc/query/motor.php` (generic, never edited per project), adds the `require_once` to `functions.php` and a short block to `CLAUDE.md`. `--check` verifies it. Exit codes: `0` ok, `1` invalid input, `2` unresolved conflicts, `3` leftover placeholders, `4` `--check` found something missing.

3. **Generate the definitions.** `node <skill>/scripts/generate.mjs --dry-run`, then without it. It writes `inc/query/<contenido>.php` for each list from its table, its labels, its detail spec (field types and options) and its row of "Contenido dinámico". An existing file that differs is a conflict: ask, then `--overwrite` or `--skip`. Exit code `4` means the specs have errors (a missing table, a source that is not in the detail spec, a field of the wrong type, options without "Opciones:", a WooCommerce content): fix the spec, never the definition.

4. **Connect each list.** For every `aplicado` list, change its template from sample items to the real query, following [references/vista.md](references/vista.md) and [references/filtros.md](references/filtros.md): the loop feeds the same card component, the filter form paints `<prefix>_query_filters()` with the design's markup, plus the active chips, the total, the pagination and the empty state. Keep the `data-query` zones. Then set `**Query:** conectado` in each section of the spec that now shows the real query. With more than one list, give each list to a subagent; it writes only that list's template, its section files and its spec (the rules of `wp-acf/references/paralelo.md`). Shared files (`functions.php`, `inc/query/`, the card used by several lists, the main CSS) stay in the main thread.

5. **Detail pages.** When the detail spec shows related items or previous/next, use `<prefix>_query_related()` (then `wp_reset_postdata()`) and `get_previous_post_link()` / `get_next_post_link()`, and mark that section `Query: conectado`.

6. **Check.** `node <skill>/scripts/check.mjs` (add `--php <path>` when `php` is not in the PATH): engine, definitions equal to the specs, zones, the `name` of every filter, no `query_posts`, no `new WP_Query` replacing the archive, escaped output, `php -l`. Then `pnpm build` and design-import's `check.mjs`. When `php` is not available, say so instead of claiming it passed.

7. **Tell the user how to try it.** In Local WP: open the list, combine filters and check the URL (`?categoria=sillas,mesas&precio_min=100`), the counts, the pagination with filters, a category archive with more filters, the view source (`noindex` on filtered pages), and the same with JavaScript disabled.

## Rules

- The specs are the source of truth. A definition is never edited by hand: change the spec and generate again.
- The engine `inc/query/motor.php` is never edited per project; it is updated with `install.mjs --overwrite inc/query/motor.php`.
- Filters always act on the main query. Never `query_posts`, never a `new WP_Query` that replaces the archive's loop. A secondary loop (related items) ends with `wp_reset_postdata()`.
- The URL names are the table's: `categoria[]` (several values), `precio_min` / `precio_max`, `q`, `orden`. Never WordPress's own query vars (`s`, `p`, `cat`, `year`…).
- Escape all output (`esc_html`, `esc_attr`, `esc_url`), start files with `defined('ABSPATH') || exit;` and use the theme prefix.
- The design decides counts, views and the mobile panel: follow the table, do not add filters the design does not show.

## Do not

- Do not register content types, taxonomies or fields, and do not touch WooCommerce templates.
- Do not connect a list that is not `aplicado`, and do not mark `Query: conectado` before the template loops the real query.
- Do not let a subagent edit `functions.php`, `inc/query/`, another list's files or the main CSS.
- Do not overwrite a definition that differs without asking.

## Reference

- [references/filtros.md](references/filtros.md): each filter type, how ACF stores it, how it is queried and its URL.
- [references/vista.md](references/vista.md): the view contract: zones, helpers and their data, empty state, pagination.
