<?php
defined('ABSPATH') || exit;

// Fallback si el archivo `hot` está vacío.
const {{PREFIX_UPPER}}_VITE_DEV_SERVER = 'http://localhost:5173';
const {{PREFIX_UPPER}}_CSS_ENTRY = 'src/css/input.css';
const {{PREFIX_UPPER}}_JS_ENTRY = 'src/js/main.js';

function {{PREFIX}}_hot_path()
{
    return get_template_directory() . '/hot';
}

function {{PREFIX}}_manifest_path()
{
    return get_template_directory() . '/dist/manifest.json';
}

// Dev = entorno local + archivo `hot` (lo crea `pnpm dev`). Si no, producción.
// El chequeo de entorno evita servir assets de Vite si `hot` llega por error al servidor.
function {{PREFIX}}_is_vite_dev()
{
    return in_array(wp_get_environment_type(), ['local', 'development'], true)
        && file_exists({{PREFIX}}_hot_path());
}

function {{PREFIX}}_vite_dev_server()
{
    $url = trim((string) @file_get_contents({{PREFIX}}_hot_path()));

    return $url !== '' ? untrailingslashit($url) : {{PREFIX_UPPER}}_VITE_DEV_SERVER;
}

function {{PREFIX}}_log($message)
{
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('[{{THEME_SLUG}}] ' . $message);
    }
}

// Devuelve el manifest como array, o null si falta o es inválido.
function {{PREFIX}}_get_manifest()
{
    $path = {{PREFIX}}_manifest_path();

    if (!file_exists($path)) {
        {{PREFIX}}_log('dist/manifest.json no existe. Ejecuta `pnpm build`.');
        return null;
    }

    $manifest = wp_json_file_decode($path, ['associative' => true]);

    if (!is_array($manifest)) {
        {{PREFIX}}_log('dist/manifest.json es inválido.');
        return null;
    }

    return $manifest;
}

function {{PREFIX}}_enqueue_assets()
{
    if ({{PREFIX}}_is_vite_dev()) {
        // DESARROLLO - HMR
        $server = {{PREFIX}}_vite_dev_server();
        wp_enqueue_script('vite-client', $server . '/@vite/client', [], null);
        wp_enqueue_script('{{THEME_SLUG}}-js', $server . '/' . {{PREFIX_UPPER}}_JS_ENTRY, [], null, true);
        wp_enqueue_style('{{THEME_SLUG}}-css', $server . '/' . {{PREFIX_UPPER}}_CSS_ENTRY, [], null);
        return;
    }

    // PRODUCCIÓN
    $manifest = {{PREFIX}}_get_manifest();
    if ($manifest === null) {
        return;
    }

    $dist_uri = get_template_directory_uri() . '/dist/';

    if (isset($manifest[{{PREFIX_UPPER}}_CSS_ENTRY]['file'])) {
        wp_enqueue_style('{{THEME_SLUG}}-css', $dist_uri . $manifest[{{PREFIX_UPPER}}_CSS_ENTRY]['file'], [], null);
    }

    if (isset($manifest[{{PREFIX_UPPER}}_JS_ENTRY]['file'])) {
        wp_enqueue_script('{{THEME_SLUG}}-js', $dist_uri . $manifest[{{PREFIX_UPPER}}_JS_ENTRY]['file'], [], null, true);
    }
}
add_action('wp_enqueue_scripts', '{{PREFIX}}_enqueue_assets');

// Vite emite ES modules: type="module" en dev y producción.
function {{PREFIX}}_add_module_type($tag, $handle)
{
    if ($handle !== 'vite-client' && $handle !== '{{THEME_SLUG}}-js') {
        return $tag;
    }

    // Solo <script src>, y solo si aún no tiene type.
    return preg_replace('/<script(?=\s[^>]*\ssrc=)(?![^>]*\stype=)/', '<script type="module"', $tag);
}
add_filter('script_loader_tag', '{{PREFIX}}_add_module_type', 10, 2);
