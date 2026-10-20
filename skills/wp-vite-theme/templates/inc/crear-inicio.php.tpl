<?php
defined('ABSPATH') || exit;

/**
 * Al activar el tema, crea la página "Inicio" y la fija como portada.
 * Solo actúa si el sitio aún no tiene una portada estática: nunca pisa una elegida.
 */
function {{PREFIX}}_setup_front_page()
{
    if (get_option('show_on_front') === 'page' && get_post_status((int) get_option('page_on_front')) === 'publish') {
        return;
    }

    $page = get_page_by_path('inicio');
    if ($page && $page->post_status === 'publish') {
        $page_id = $page->ID;
    } else {
        $page_id = wp_insert_post([
            'post_type'   => 'page',
            'post_status' => 'publish',
            'post_title'  => __('Inicio', '{{THEME_SLUG}}'),
            'post_name'   => 'inicio',
        ], true);
    }

    if (is_wp_error($page_id) || !$page_id) {
        return;
    }

    update_option('page_on_front', $page_id);
    update_option('show_on_front', 'page');
}
add_action('after_switch_theme', '{{PREFIX}}_setup_front_page');
