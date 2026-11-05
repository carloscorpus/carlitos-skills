---
name: wp-woocommerce
description: 'Connect the WooCommerce pieces that design-import laid out in a WordPress theme (Vite + pnpm) without losing the custom design or breaking on WooCommerce updates: declare the theme support, replace the `// woo:` markers of the theme''s `woocommerce/` templates with the real WooCommerce functions while keeping every original hook, keep each override''s `@version` honest against the installed WooCommerce, mini cart that updates itself, and CSS for the cart/checkout blocks. Cart, checkout, mini cart and account are classic PHP templates or WooCommerce blocks, as decided in the spec; payments, shipping and orders stay out of the theme. Use when a spec has content with `Origen: woo`, or the user says "conecta woocommerce", "tienda con woocommerce", "carrito", "checkout", "mini carrito", "pasarela", or a spec says `skill: wp-woocommerce`. Runs after wp-acf. Shop filters (categories, price, search, sorting, no reload) are wp-query.'
metadata:
  version: "1.1.0"
---

# wp-woocommerce

`design-import` leaves the WooCommerce pieces of the design as templates in the theme's `woocommerce/` (shop, product card, single product, and cart, checkout, mini cart and account only when the spec marks them `clásico`), with a `// woo: precio` comment wherever WooCommerce's own logic goes, and a **WooCommerce** table in `_shared.md` with the decisions of the project. This skill makes the shop real without touching the design and without leaving a theme that breaks when WooCommerce updates.

The rule that makes it update-safe: **hooks and the original templates first, the least markup of our own after**. We never rewrite WooCommerce's logic; we call it.

## What it does and does not do

- **Does:** theme support and the gallery features; WooCommerce's classic styles off (the design owns the CSS of the PHP templates); WooCommerce's default output removed from the hooks of its templates (link, image, title, price, button, tabs…) so the design's own calls do not print twice while the hooks stay for plugins; the markers of each `woocommerce/` template turned into WooCommerce's functions; every override keeps **all** the `do_action()` of the original template and the original's `@version`; the classic mini cart (count and total) updating without reload (it also enqueues WooCommerce's `wc-cart-fragments`, which WooCommerce only loads with its cart widget); a `page.php` when the theme has no page template (cart, checkout and account are pages whose content must be printed, and `index.php` prints only the excerpt); the CSS of the pieces in blocks; an audit against the installed WooCommerce (versions, hooks, business logic in the theme).
- **Does not:** payments, shipping, orders, taxes, or extra checkout fields: that is a plugin of the project (also where the HPOS and blocks compatibility is declared). Shop filters and the shop's no-reload updates (`wp-query` connects them: it accepts `Origen: woo`; this skill only warns when the spec asks for them and `wp-query` is not installed). Variable products (this version covers simple products; the spec's `Variaciones: sí` is only reported). Registering content types or fields (`wp-acf`).

## Flow

1. **Read the context.** From the theme root run `node <skill>/scripts/status.mjs`: the spec's decisions (mode of each piece, variations, shop filters), whether the base is installed and up to date, each `woocommerce/` template (its piece, its `@version` against the original, the `// woo:` markers left) and `next`. Without `Origen: woo` in the spec or without the **WooCommerce** table, stop: the decision is asked with `design-import`, never inferred here. A catalog sold by WhatsApp is not WooCommerce: `wp-acf` + `wp-query`.

2. **Install the base.** `node <skill>/scripts/install.mjs --dry-run`, show `conflicts` and ask, then without `--dry-run` (with `--overwrite` / `--skip`). It reads the spec and copies only what it needs: `inc/woocommerce/base.php` always, `fragments.php` if the mini cart is `clásico`, `page.php` if the theme has neither `page.php` nor `singular.php` and the spec has a cart, checkout or account (created once, then it is the project's), `src/css/woocommerce.css` if any piece is `bloques` (imported in Vite's main CSS, found in `vite.config.*`; if it cannot tell, ask and pass `--css-entry <path>`). Adds the `require_once` to `functions.php` and a block to `CLAUDE.md`. `--check` verifies it. Exit codes: `0` ok, `1` invalid input, `2` unresolved conflicts, `3` leftover placeholders, `4` `--check` found something missing.

3. **Compare with the installed WooCommerce.** The templates of the plugin (`wp-content/plugins/woocommerce/templates/`, found next to the theme or with `--woo <plugin root>`) are the base of every override: for each `woocommerce/` file of the theme, diff it against the original of the same path. The design's markup stays; what the original has and ours lacks (every `do_action()`, the form's `name`, nonce fields, wrapper ids that WooCommerce's JavaScript looks for) is added. Read [references/conexion.md](references/conexion.md).

4. **Connect each template.** Replace each `// woo: <what>` with the function in [references/conexion.md](references/conexion.md), keeping the design's HTML and classes. Then put the original's `@version` in the file's header comment (only after step 3: the number says "this copy has the original's code of that release", it is never edited just to silence WooCommerce → Estado). Shop/product pages are `Tipo: listado` / `detalle` in the spec; cart, checkout, mini cart and account follow the table. With more than three template groups, give each group to a subagent (shop and card; single product; cart; checkout; account): it writes only its templates; `functions.php`, `inc/woocommerce/`, the main CSS and `specs/_shared.md` stay in the main thread.

5. **Style the blocks.** For each piece in `bloques`, write its CSS in `src/css/woocommerce.css` following [references/estilos-y-modos.md](references/estilos-y-modos.md): plain CSS (no `@layer`), scoped to the block, only the stable `wc-block-components-*` classes, with the project's tokens. There is no template for that piece.

6. **Check.** `node <skill>/scripts/check.mjs` (add `--php <path>` when `php` is not in the PATH, `--woo <plugin root>` when WooCommerce is not next to the theme): base installed and loaded, no `// woo:` left, `@version` equal to the original, no missing `do_action()`, pieces in blocks without PHP template, no payment/shipping/order logic in the theme, escaped output, `php -l`. Then `pnpm build` and design-import's `check.mjs`. Without `php` or without the WooCommerce templates, say so instead of claiming it passed.

7. **Tell the user how to try it.** In Local WP with WooCommerce active and the Peruvian gateway of the project in test mode: shop → product → add to cart (the mini cart changes without reload) → cart → coupon → checkout → pay with the test gateway → order received; WooCommerce → Estado → *Plantillas* shows no outdated template; the same with a second user in "Mi cuenta". With blocks, check the cart and checkout at phone and desktop width (the blocks measure their container). Before the first sale, confirm the gateway declares support for the checkout mode of the spec.

## Rules

- The spec is the source of truth for the mode of each piece. A change of mode is a change of the spec first (`design-import`), then this skill again.
- **Keep every hook of the original.** An override that drops a `do_action()` silently breaks plugins and gateways that hook there.
- **`@version` is the original's.** Never edit it to make the warning disappear; compare, incorporate, then copy the original's number.
- Hooks and filters before overriding a template, and an override before copying logic. Never edit WooCommerce's files, never `include` a template outside `woocommerce/`.
- Escape all output (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post` for prices and WooCommerce HTML) and start our files with `defined('ABSPATH') || exit;`.
- The theme has no payment, shipping, order or checkout-field logic. If the project needs it, it goes in a plugin of the project.
- The WooCommerce blocks are not dequeued globally: each block loads its own CSS and removing it breaks the block.

## Do not

- Do not infer classic or blocks, variations or shop filters: they are in the spec or they are asked with `design-import`.
- Do not write a template for a piece in `bloques`, and do not write CSS inside `@layer` for the blocks.
- Do not wire the shop's filter form here: with `Filtros de tienda: sí` it is `wp-query`'s (run it after this skill; it keeps the `do_action()` of `archive-product.php`, so `check.mjs` still passes).
- Do not let a subagent edit `functions.php`, `inc/woocommerce/`, the main CSS, `specs/_shared.md` or another group's templates.
- Do not overwrite `src/css/woocommerce.css` or a base file that differs without asking.

## Reference

- [references/conexion.md](references/conexion.md): from each `// woo:` marker to the WooCommerce function, how to keep an override update-safe, and the brief for a subagent.
- [references/estilos-y-modos.md](references/estilos-y-modos.md): classic or blocks, what each mode changes, the CSS rules for the blocks (cascade, scope, tokens) and what stays out of the theme.
