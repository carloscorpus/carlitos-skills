<?php
defined('ABSPATH') || exit;

/*
 * Base de WooCommerce del tema (skill wp-woocommerce).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Solo lo que el tema debe declarar para que WooCommerce use su diseño:
 *   - soporte de WooCommerce y de la galería del producto;
 *   - sin los estilos clásicos de WooCommerce (el diseño pone todo el CSS de las plantillas PHP);
 *   - sin lo que WooCommerce imprime por defecto en los ganchos de sus plantillas (enlace, imagen, título, precio,
 *     botón…): las plantillas del tema ya lo imprimen donde el diseño lo pide. Los ganchos (do_action) se conservan
 *     en las plantillas, así que plugins y pasarelas siguen enganchando su contenido ahí.
 * No toca nada de los bloques de Carrito y Checkout, ni pedidos, pagos o envíos: eso va en un plugin, no en el tema.
 * Si el plugin WooCommerce no está activo, este archivo no hace nada.
 */

if (!class_exists('WooCommerce')) {
    return;
}

function {{PREFIX}}_woo_setup(): void
{
    add_theme_support('woocommerce');
    add_theme_support('wc-product-gallery-zoom');
    add_theme_support('wc-product-gallery-lightbox');
    add_theme_support('wc-product-gallery-slider');
}
add_action('after_setup_theme', '{{PREFIX}}_woo_setup');

// Solo los estilos clásicos (tienda, ficha, carrito y checkout por shortcode). Los de los bloques no pasan por
// este filtro y no se quitan: cada bloque carga el suyo y quitarlos rompe los bloques.
add_filter('woocommerce_enqueue_styles', '__return_empty_array');

// Lo que WooCommerce engancha por defecto en los ganchos de sus plantillas (includes/wc-template-hooks.php) y
// que el diseño reemplaza con llamadas explícitas en las plantillas del tema: [gancho, función, prioridad].
// Se quedan los avisos (woocommerce_output_all_notices) y el mensaje de "sin productos". Un proyecto agrega o quita filas con el filtro `{{PREFIX}}_woo_default_callbacks`.
function {{PREFIX}}_woo_default_callbacks(): array
{
    return [
        // Envoltorio, migas y barra lateral: la plantilla del tema trae su <main>.
        ['woocommerce_before_main_content', 'woocommerce_output_content_wrapper', 10],
        ['woocommerce_before_main_content', 'woocommerce_breadcrumb', 20],
        ['woocommerce_after_main_content', 'woocommerce_output_content_wrapper_end', 10],
        ['woocommerce_sidebar', 'woocommerce_get_sidebar', 10],
        // Tienda: encabezado (trae su propio <h1>), total de resultados, orden y paginación.
        ['woocommerce_shop_loop_header', 'woocommerce_product_taxonomy_archive_header', 10],
        ['woocommerce_before_shop_loop', 'woocommerce_result_count', 20],
        ['woocommerce_before_shop_loop', 'woocommerce_catalog_ordering', 30],
        ['woocommerce_after_shop_loop', 'woocommerce_pagination', 10],
        // Tarjeta de producto.
        ['woocommerce_before_shop_loop_item', 'woocommerce_template_loop_product_link_open', 10],
        ['woocommerce_before_shop_loop_item_title', 'woocommerce_show_product_loop_sale_flash', 10],
        ['woocommerce_before_shop_loop_item_title', 'woocommerce_template_loop_product_thumbnail', 10],
        ['woocommerce_shop_loop_item_title', 'woocommerce_template_loop_product_title', 10],
        ['woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_rating', 5],
        ['woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_price', 10],
        ['woocommerce_after_shop_loop_item', 'woocommerce_template_loop_product_link_close', 5],
        ['woocommerce_after_shop_loop_item', 'woocommerce_template_loop_add_to_cart', 10],
        // Ficha de producto.
        ['woocommerce_before_single_product_summary', 'woocommerce_show_product_sale_flash', 10],
        ['woocommerce_before_single_product_summary', 'woocommerce_show_product_images', 20],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_title', 5],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_rating', 10],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_price', 10],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_excerpt', 20],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_meta', 40],
        ['woocommerce_single_product_summary', 'woocommerce_template_single_sharing', 50],
        ['woocommerce_after_single_product_summary', 'woocommerce_output_product_data_tabs', 10],
        ['woocommerce_after_single_product_summary', 'woocommerce_upsell_display', 15],
        ['woocommerce_after_single_product_summary', 'woocommerce_output_related_products', 20],
    ];
}

function {{PREFIX}}_woo_clear_defaults(): void
{
    $callbacks = apply_filters('{{PREFIX}}_woo_default_callbacks', {{PREFIX}}_woo_default_callbacks());
    foreach ($callbacks as [$hook, $callback, $priority]) {
        remove_action($hook, $callback, $priority);
    }
}
add_action('init', '{{PREFIX}}_woo_clear_defaults', 20);

// Mini-carrito: contador y total que se actualizan solos (solo si el diseño tiene mini-carrito clásico).
$woo_fragments = get_theme_file_path('inc/woocommerce/fragments.php');
if (file_exists($woo_fragments)) {
    require_once $woo_fragments;
}
unset($woo_fragments);
