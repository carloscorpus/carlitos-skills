<?php
// Réplica mínima de las funciones de WordPress que usan los helpers. Solo para tests/check.mjs.

define('ABSPATH', __DIR__ . '/');

class WP_Post
{
    public $ID = 0;
    public $post_type = 'post';
}

$GLOBALS['wph_attachments'] = [];
$GLOBALS['wph_theme'] = '';

function wph_attachment($id)
{
    return $GLOBALS['wph_attachments'][(string) $id] ?? null;
}

function get_theme_file_path($path = '')
{
    return $GLOBALS['wph_theme'] . $path;
}

function esc_html($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES);
}

function esc_attr($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES);
}

function esc_url_raw($url)
{
    $url = trim((string) $url);
    if (preg_match('#^([a-z][a-z0-9+.\-]*):#i', $url, $m)) {
        // Como wp_allowed_protocols(): más amplio que lo que aceptan los helpers.
        $allowed = ['http', 'https', 'ftp', 'ftps', 'mailto', 'news', 'irc', 'sms', 'tel', 'fax', 'xmpp', 'webcal', 'urn'];
        return in_array(strtolower($m[1]), $allowed, true) ? $url : '';
    }
    return $url;
}

function home_url($path = '')
{
    return 'https://site.test' . $path;
}

function wp_parse_url($url, $component = -1)
{
    return parse_url($url, $component);
}

function is_email($email)
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function __($text, $domain = 'default')
{
    return $text;
}

function esc_url($url)
{
    return esc_html(esc_url_raw($url));
}

function wp_attachment_is_image($id)
{
    $a = wph_attachment($id);
    return $a && strpos($a['mime'], 'image/') === 0;
}

function wp_get_attachment_image_src($id, $size = 'full')
{
    $a = wph_attachment($id);
    if (!$a) {
        return false;
    }
    if ($size !== 'full' && isset($a[$size])) {
        return [$a[$size]['url'], $a[$size]['w'], $a[$size]['h'], true];
    }
    return [$a['url'], $a['w'], $a['h'], false];
}

function get_post_meta($id, $key, $single = false)
{
    $a = wph_attachment($id);
    return $a && $key === '_wp_attachment_image_alt' ? $a['alt'] : '';
}

function wp_get_attachment_image($id, $size = 'full', $icon = false, $attr = '')
{
    $src = wp_get_attachment_image_src($id, $size);
    if (!$src) {
        return '';
    }
    $attr = array_merge(['class' => "attachment-$size size-$size"], (array) $attr);
    $html = '<img';
    if ($src[1] && $src[2]) {
        $html .= ' width="' . $src[1] . '" height="' . $src[2] . '"';
    }
    $html .= ' src="' . esc_attr($src[0]) . '"';
    foreach ($attr as $name => $value) {
        $html .= ' ' . $name . '="' . esc_attr($value) . '"';
    }
    return $html . '>';
}
