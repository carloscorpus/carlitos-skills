<?php
// Prueba de la base de WooCommerce con funciones de WordPress simuladas: carga inc/woocommerce/base.php (ya con el
// prefijo del tema), siembra los ganchos por defecto de WooCommerce y comprueba lo que queda después de `init`.
// Uso: php base.php <ruta a base.php> <prefijo>   -> imprime JSON.

define('ABSPATH', __DIR__ . '/');
class WooCommerce {}

$GLOBALS['hooks'] = [];
$GLOBALS['supports'] = [];

function add_action($hook, $callback, $priority = 10, $args = 1) { $GLOBALS['hooks'][$hook][$priority][] = $callback; return true; }
function add_filter($hook, $callback, $priority = 10, $args = 1) { return add_action($hook, $callback, $priority, $args); }
function remove_action($hook, $callback, $priority = 10)
{
    foreach ($GLOBALS['hooks'][$hook][$priority] ?? [] as $i => $registered) {
        if ($registered === $callback) {
            unset($GLOBALS['hooks'][$hook][$priority][$i]);
            return true;
        }
    }
    return false;
}
function apply_filters($hook, $value) { return $value; }
function add_theme_support($feature) { $GLOBALS['supports'][] = $feature; }
function get_theme_file_path($path = '') { return __DIR__ . '/no-existe' . $path; }
function __return_empty_array() { return []; }

// Lo que WooCommerce engancha por defecto (includes/wc-template-hooks.php de WooCommerce 11.2.2, los ganchos de las plantillas).
$defaults = [
    ['woocommerce_before_main_content', 'woocommerce_output_content_wrapper', 10],
    ['woocommerce_after_main_content', 'woocommerce_output_content_wrapper_end', 10],
    ['woocommerce_before_shop_loop_item_title', 'woocommerce_show_product_loop_sale_flash', 10],
    ['woocommerce_before_single_product_summary', 'woocommerce_show_product_sale_flash', 10],
    ['woocommerce_before_main_content', 'woocommerce_breadcrumb', 20],
    ['woocommerce_sidebar', 'woocommerce_get_sidebar', 10],
    ['woocommerce_shop_loop_header', 'woocommerce_product_taxonomy_archive_header', 10],
    ['woocommerce_before_shop_loop', 'woocommerce_result_count', 20],
    ['woocommerce_before_shop_loop', 'woocommerce_catalog_ordering', 30],
    ['woocommerce_no_products_found', 'wc_no_products_found', 10],
    ['woocommerce_before_shop_loop_item', 'woocommerce_template_loop_product_link_open', 10],
    ['woocommerce_after_shop_loop_item', 'woocommerce_template_loop_product_link_close', 5],
    ['woocommerce_after_shop_loop_item', 'woocommerce_template_loop_add_to_cart', 10],
    ['woocommerce_before_shop_loop_item_title', 'woocommerce_template_loop_product_thumbnail', 10],
    ['woocommerce_shop_loop_item_title', 'woocommerce_template_loop_product_title', 10],
    ['woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_price', 10],
    ['woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_rating', 5],
    ['woocommerce_before_single_product_summary', 'woocommerce_show_product_images', 20],
    ['woocommerce_after_single_product_summary', 'woocommerce_output_product_data_tabs', 10],
    ['woocommerce_after_single_product_summary', 'woocommerce_upsell_display', 15],
    ['woocommerce_after_single_product_summary', 'woocommerce_output_related_products', 20],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_title', 5],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_rating', 10],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_price', 10],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_excerpt', 20],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_meta', 40],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_sharing', 50],
    ['woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30],
    ['woocommerce_after_shop_loop', 'woocommerce_pagination', 10],
    ['woocommerce_before_shop_loop', 'woocommerce_output_all_notices', 10],
    ['woocommerce_before_single_product', 'woocommerce_output_all_notices', 10],
];
foreach ($defaults as [$hook, $callback, $priority]) {
    add_action($hook, $callback, $priority);
}

require $argv[1];

// Lo que WordPress ejecuta: after_setup_theme y init (en orden de prioridad).
foreach (['after_setup_theme', 'init'] as $hook) {
    $priorities = $GLOBALS['hooks'][$hook] ?? [];
    ksort($priorities);
    foreach ($priorities as $callbacks) {
        foreach ($callbacks as $callback) {
            if (is_string($callback) && function_exists($callback)) {
                $callback();
            }
        }
    }
}

$left = [];
foreach ($GLOBALS['hooks'] as $hook => $priorities) {
    if (!str_starts_with($hook, 'woocommerce_') || $hook === 'woocommerce_enqueue_styles') {
        continue;
    }
    foreach ($priorities as $callbacks) {
        foreach ($callbacks as $callback) {
            $left[] = $hook . ' > ' . (is_string($callback) ? $callback : 'closure');
        }
    }
}
sort($left);

echo json_encode([
    'left' => $left,
    'supports' => $GLOBALS['supports'],
    'styles' => in_array('__return_empty_array', $GLOBALS['hooks']['woocommerce_enqueue_styles'][10] ?? [], true),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
