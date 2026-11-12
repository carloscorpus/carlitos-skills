<?php
defined('ABSPATH') || exit;

// Envíos guardados de wp-form (lo que importa al manual: el tipo de contenido).
const DEMO_ENTRY_TYPE = 'demo_envio';

function demo_register_entries()
{
    register_post_type(DEMO_ENTRY_TYPE, ['labels' => ['name' => 'Envíos'], 'public' => false, 'show_ui' => true]);
}
add_action('init', 'demo_register_entries');
