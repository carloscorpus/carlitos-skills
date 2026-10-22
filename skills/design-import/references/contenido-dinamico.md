# Dynamic content: blog, catalog, WooCommerce

A catalog, a blog and a shop can look the same in the design. What they are is a decision of the project, not something to infer from the HTML. This skill asks once, writes the answer in `_shared.md`, and documents the rest. It lays the markup out; it does not wire it.

## The scope question (stage A)

`analyze.mjs` lists `dynamicCandidates`: pages whose name, repeated blocks, filters, prices or pagination suggest a list. They are suggestions. Ask in one message for each candidate (and any page you suspect, such as a "Mi cuenta" or a search page):

| Answer | Origin | Notes |
|---|---|---|
| Static page | — | Normal flow. |
| Blog | `post` | WordPress posts, categories, tags. |
| Catalog | `cpt` | A content type of the project (new or existing), usually no purchase: enquiry by WhatsApp, form or contact. |
| WooCommerce | `woo` | Products, cart, checkout. Only laid out. |
| Other | `cpt` | Describe it; usually a custom content type. |

For each non-static answer, ask the rest of the row: content type and its name (singular, snake_case, no accents), taxonomies (name, hierarchical or not, example terms from the design), what each item stores, the filters the design shows, the templates, and the item's button (below). Record it in the "Alcance" and "Contenido dinámico" tables of `_shared.md`. The user approves it with the rest of `_shared.md`.

## What is documented and what is not

| Documented in the spec | Not done by this skill |
|---|---|
| Content type name and origin (`post`, `cpt`, `woo`), existing or new | Registering the content type or taxonomies |
| Taxonomies, hierarchy, example terms | Creating the terms |
| Fields per item (as an ACF group located on the content type) | Creating the fields |
| Filters the design shows, as markup, and the list's "Filtros" table (type, source, multiple values, counts, view) | Filtering (query vars, updating without reload), search, sort, pagination logic: that is wp-query |
| Templates to use | The query, the loop, `pre_get_posts` |
| The item's button and where its data comes from | Building the real link or the cart behavior |

## Specs

One content type usually needs two specs, named after the content so the field prefix reads well:

- **List** (`productos.md`): `Tipo: listado`, `Contenido: producto`, template `archive-producto.php` (or `home.php` / `archive.php` for posts, the shop template for Woo). Sections: heading/intro, filters, grid, pagination. `Ubicación`: where the page's own fields live; an archive has no editing screen, so the default is `página de opciones: archivo de <contenido>`, or the real page if the project uses one as the shop page. Fields describe the page text (title, intro), never the items.
- **Detail** (`producto.md`): `Tipo: detalle`, same `Contenido`, template `single-producto.php`. `Ubicación: tipo de contenido = producto`. Fields are what each item stores (`producto_ficha_precio`, `producto_galeria_imagenes`). The title, content and featured image are WordPress's own and are not fields.

Taxonomy archives (`taxonomy-categoria_producto.php`) reuse the list sections and need no spec of their own; note them in `Notas de página`.

A blog follows the same shape with `Origen: post`: `home.php` (list), `single.php` (detail), `archive.php` / `category.php`. The title, excerpt, date, author and featured image are WordPress's own; document only extra fields.

## Markup rules

- The item is a component: `template-parts/components/<contenido>-card.php` with its data in `$args`. The list prints the design's sample items by calling it with fixed arrays, so connecting the query later is replacing the array with the loop.
- Filters and sort are one `<form method="get">` with real controls, labelled, keyboard-friendly. Each control's `name` is the filter's name in the "Filtros" table of the list spec (`categoria`, `precio_min`/`precio_max` for a range, `q`, `orden`); options with several values are checkboxes with the same `name` (`categoria[]`). They do nothing yet. **Never `wp-form`**: it is for sending messages, not for filtering. Write the table while laying out the filters: see "Filters (lists only)" in [formato-spec.md](formato-spec.md).
- The parts that change when filtering carry `data-query`: the form `data-query="filtros"`, the grid `data-query="resultados"`, the pagination `data-query="paginacion"` and the "N resultados" text `data-query="total"`. wp-query swaps exactly those, so the layout is not rebuilt.
- Pagination is a `<nav aria-label="Paginación">` with real links; the design's pages are fixed.
- Empty state ("no hay resultados") is part of the list section when the design has one; otherwise ask whether it should exist.
- Categories and tags shown in a card are plain text from the design; they become taxonomy terms later.

## WooCommerce: markup only

Lay out the pieces as the design shows them (shop archive, product card, single product, cart, checkout, account) as the theme's WooCommerce overrides, and say in each spec that the content comes from Woo:

| Design | File |
|---|---|
| Shop / category archive | `woocommerce/archive-product.php` |
| Product card | `woocommerce/content-product.php` |
| Single product | `woocommerce/single-product.php` / `content-single-product.php` |
| Cart, checkout, account | `woocommerce/cart/cart.php`, `woocommerce/checkout/form-checkout.php`, `woocommerce/myaccount/` |

Keep Woo's hooks and function calls out of the markup; mark where they go with a PHP comment (`// woo: precio`). Declare Woo support and the templates' final form in a later step. The product's price, stock and add-to-cart button are Woo's: the spec's "Acción" says `carrito de Woo` and no field is documented for them. If the project also wants a WhatsApp button on a shop, record it as "Otra" in "Acción".

## The item's button ("Acción")

It changes per project, so it is asked and recorded, never assumed.

| Answer | What the spec says |
|---|---|
| WhatsApp | A link `https://wa.me/<number>?text=<message>`. The number comes from a global field (`opciones_contacto_whatsapp`, same for all items, in the `opciones` spec) or a field of the item (`producto_ficha_whatsapp`). The message is a template with `{producto}` and `{url}`. The link goes through the `wp-helper` links helper. |
| Enquiry form | Section with `Skill: wp-form`, the item's name in a hidden field. |
| Contact page | A link to the contact page with the item in the query string, or none. |
| Woo cart | Woo's own button; nothing documented. |
| None | The card only shows. |

Write the chosen option in the "Acción" cell and again in `Comportamiento` of the card's section, with the field names it needs in the field table.
