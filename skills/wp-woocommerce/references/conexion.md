# Connecting the templates

`design-import` writes the design's markup in `woocommerce/` and leaves `// woo: <what>` where WooCommerce's own logic goes. This is how to replace each marker and keep the template safe when WooCommerce updates.

## The method (every template)

1. **Start from the original.** Open the plugin's template of the same path (`wp-content/plugins/woocommerce/templates/<path>`). `status.mjs` and `check.mjs` find it next to the theme, or with `--woo <plugin root>`.
2. **Keep the hooks.** Every `do_action( 'woocommerce_…' )` of the original must be in our file, in the same order, even when the design draws nothing there. Plugins and payment gateways print their content in those hooks; `check.mjs` fails when one is missing. `apply_filters()` of the original are kept when they wrap output we print.
   - **Why the hooks do not print twice.** WooCommerce itself hooks its default output into those `do_action()` (link, image, title, price, button in the card; title, price, button, tabs in the single product…, see `includes/wc-template-hooks.php`). `inc/woocommerce/base.php` removes those default callbacks (`<prefix>_woo_default_callbacks()`), so the hook stays for plugins and the template prints each piece once, where the design puts it. If a piece is missing on the page, the template is not printing it: add the call. If the project wants one of WooCommerce's defaults back, remove its row with the filter `<prefix>_woo_default_callbacks`, never by editing the base.
   - Notices (`woocommerce_output_all_notices`) are **not** removed: they are hooked in `woocommerce_before_shop_loop` and `woocommerce_before_single_product`, so those two `do_action()` must stay. The cart and checkout templates print theirs through their own hooks.
3. **Keep what WooCommerce's JavaScript and PHP look for.** The original's guards stay too (`content-product.php` returns early when the product is not a visible `WC_Product`; the archive branches on `woocommerce_product_loop()`). Forms keep their `name`, `method` and nonce fields (`wp_nonce_field`); the checkout keeps `form.checkout`, `#order_review` and `#payment`; the cart form keeps `.woocommerce-cart-form`; products in a loop keep `wc_product_class()`. Change the classes you need for the design, but add ours next to these, do not replace them.
4. **Change only the markup around.** The design's HTML, classes and tokens go around the original's calls. Where a function prints WooCommerce's HTML and the design needs different markup, prefer a filter of that function (in `inc/woocommerce/`, never a copy of the function) before rewriting it in the template.
5. **Copy the original's `@version`** into the header comment, once the code was compared. It is the release in which that file last changed, not the WooCommerce version you run.

If a marker has no row below, ask: do not invent the call.

## Markers to functions

All of this goes inside the shop loop (`global $product;`, set up by `the_post()` / `wc_get_template_part`) unless said otherwise. These are WooCommerce's public template functions and product methods; confirm the name in the installed version (they live in `includes/wc-template-functions.php`) before using one that is not here.

| Marker | Call |
|---|---|
| `titulo del archivo` (shop) | `woocommerce_page_title();` (the default header with its own `<h1>` is removed by the base) |
| `descripcion del archivo` | `do_action('woocommerce_archive_description');` |
| `titulo` | `get_the_title()` (loop) or `woocommerce_template_single_title()` (single) |
| `imagen` | `echo $product->get_image('woocommerce_thumbnail');` (card), `woocommerce_show_product_images();` (single gallery) |
| `galeria` | `$product->get_gallery_image_ids()` and `wp_get_attachment_image()` for a custom gallery |
| `precio` | `echo wp_kses_post($product->get_price_html());` |
| `oferta` | `if ($product->is_on_sale()) { … }` |
| `stock` | `$product->is_in_stock()`, `wc_get_stock_html($product)` |
| `rating` | `echo wc_get_rating_html($product->get_average_rating());` |
| `categorias` | `echo wp_kses_post(wc_get_product_category_list($product->get_id()));` |
| `descripcion corta` | `woocommerce_template_single_excerpt();` |
| `boton` (card) | `woocommerce_template_loop_add_to_cart();`; to change its markup use the filters `woocommerce_loop_add_to_cart_link` and `woocommerce_loop_add_to_cart_args`, so it keeps the classes WooCommerce's AJAX add-to-cart needs |
| `boton` (single) | `woocommerce_template_single_add_to_cart();` (it also draws quantity and, later, variations) |
| `meta` | `woocommerce_template_single_meta();` |
| `tabs` | `woocommerce_output_product_data_tabs();` |
| `relacionados` | `woocommerce_output_related_products();` |
| `orden` (shop) | `woocommerce_catalog_ordering();` |
| `total de resultados` | `woocommerce_result_count();` |
| `paginacion` (shop) | `woocommerce_pagination();` |
| `migas` | `woocommerce_breadcrumb();` |
| `sin productos` | `do_action('woocommerce_no_products_found');` |
| `avisos` | Nothing to call on the shop and the single product: their notices come from `woocommerce_before_shop_loop` / `woocommerce_before_single_product`, which stay. Cart and checkout print theirs in their own hooks. |
| `lineas del carrito`, `totales`, `cupon` | copy the original's loop over `WC()->cart->get_cart()` and its hooks; change the markup only |
| `contador del carrito` (header) | `echo wp_kses_post(<prefix>_woo_cart_count_html());` (from `fragments.php`) |
| `total del carrito` (header) | `echo wp_kses_post(<prefix>_woo_cart_total_html());` |
| `mini carrito` | `woocommerce_mini_cart();` inside the container the design shows |

The shop archive keeps the loop the original uses (`woocommerce_product_loop()`, `woocommerce_product_loop_start()` / `_end()`, `wc_get_template_part('content', 'product')`) and the hooks `woocommerce_before_shop_loop`, `woocommerce_after_shop_loop`.

## Mini cart that updates itself (classic)

With `Mini-carrito: clásico`, `fragments.php` replaces `span[data-woo-cart-count]` and `span[data-woo-cart-total]` after every cart change. The template prints the two helpers where the design shows the number and the total.

- **The counter is a bare `<span>`.** A fragment replaces the whole element, so the badge's classes go on a parent (`<span class="badge …"><?= wp_kses_post(<prefix>_woo_cart_count_html()) ?></span>`); the helper only prints the number. Give the link an accessible name with a `sr-only` text, not an `aria-label` with a fixed number.
- **The script is not loaded by WooCommerce.** `wc-cart-fragments` is registered but, in WooCommerce 11.2.2, only the cart widget enqueues it; `fragments.php` enqueues it. Verified live: the `?wc-ajax=add_to_cart` response carries both fragments. The script also asks WooCommerce for the fragments on every page load, which is the usual cost of a classic mini cart; with page caching, leave the counter out of the cached page or accept the extra request.

## Not in the theme

Payment gateways, shipping methods, order hooks (`woocommerce_new_order`, `woocommerce_payment_complete`…), taxes and extra checkout fields are a plugin of the project, so a change of theme does not remove them. That plugin is also where the compatibility with HPOS and with the cart/checkout blocks is declared. With the checkout in blocks the old filters (`woocommerce_checkout_fields`, `woocommerce_billing_fields`) do nothing: extra fields use WooCommerce's additional-checkout-fields API, in that plugin.

## Brief for a subagent (one per group of templates)

> Connect the WooCommerce templates `<files>` of the theme.
> Read `<skill>/references/conexion.md`, the spec of the page (`specs/<slug>.md`) and, for each file, the original in `<woocommerce root>/templates/<same path>`. Keep the design's HTML and classes exactly; for each `// woo:` marker use the call of the table (ask in your answer if there is none). Add to the file every `do_action()` of the original that is missing, in its order, and the form names, ids and nonce fields WooCommerce needs. When the code was compared, put the original's `@version` in the header comment.
> Write only these files. Never `functions.php`, `inc/woocommerce/`, the main CSS, `specs/_shared.md` or another group's templates; if one needs a change, report it. Run `node <skill>/scripts/check.mjs` and `php -l` on every file you wrote (say so if `php` is not available).
> Answer with: the markers connected, the hooks added, the check result, and anything you could not decide.
