<?php
defined('ABSPATH') || exit;

function {{PREFIX}}_setup()
{
    load_theme_textdomain('{{THEME_SLUG}}', get_template_directory() . '/languages');

    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script']);

    register_nav_menus([
        'primary' => __('Menú principal', '{{THEME_SLUG}}'),
    ]);
}
add_action('after_setup_theme', '{{PREFIX}}_setup');
