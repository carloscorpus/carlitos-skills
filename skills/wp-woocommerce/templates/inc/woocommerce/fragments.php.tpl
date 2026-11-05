<?php
defined('ABSPATH') || exit;

/*
 * Mini-carrito clásico: contador y total que se actualizan al agregar al carrito (skill wp-woocommerce).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * La plantilla imprime {{PREFIX}}_woo_cart_count_html() y {{PREFIX}}_woo_cart_total_html() donde el diseño muestra
 * el número y el total; el filtro de fragmentos de WooCommerce los reemplaza después de cada cambio del carrito,
 * sin recargar. Los selectores son los atributos data-woo-cart-count y data-woo-cart-total.
 */

function {{PREFIX}}_woo_cart_count_html(): string
{
    $count = (function_exists('WC') && WC()->cart) ? WC()->cart->get_cart_contents_count() : 0;
    return '<span data-woo-cart-count>' . esc_html((string) $count) . '</span>';
}

function {{PREFIX}}_woo_cart_total_html(): string
{
    $total = (function_exists('WC') && WC()->cart) ? WC()->cart->get_cart_subtotal() : '';
    return '<span data-woo-cart-total>' . wp_kses_post($total) . '</span>';
}

// WooCommerce registra el script que aplica los fragmentos (wc-cart-fragments) pero solo lo carga el widget del
// carrito: sin él, el contador no se actualiza. Comprobado en WooCommerce 11.2.2 (includes/widgets/class-wc-widget-cart.php).
add_action('wp_enqueue_scripts', static function (): void {
    wp_enqueue_script('wc-cart-fragments');
}, 20);

add_filter('woocommerce_add_to_cart_fragments', static function (array $fragments): array {
    $fragments['span[data-woo-cart-count]'] = {{PREFIX}}_woo_cart_count_html();
    $fragments['span[data-woo-cart-total]'] = {{PREFIX}}_woo_cart_total_html();
    return $fragments;
});
