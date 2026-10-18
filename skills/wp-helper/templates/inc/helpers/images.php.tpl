<?php
defined('ABSPATH') || exit;

/*
 * Helpers de imágenes (skill wp-helper).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Acepta lo que entregue un campo de imagen de ACF (array, ID,
 * URL), un adjunto (WP_Post) o un valor vacío, y nunca rompe la vista:
 *
 *   {{PREFIX}}_image_data($campo, 'large')   ['id', 'url', 'alt', 'width', 'height'] o null
 *   {{PREFIX}}_image($campo, ['class' => 'w-full', 'loading' => 'eager'])   <img> listo o ''
 *
 * No llama funciones de ACF: sirve igual si ACF no está activo.
 */

// Normaliza cualquier valor de imagen. null si no hay una imagen utilizable: valor vacío, adjunto
// borrado, adjunto que no es imagen (PDF) o URL con protocolo no permitido.
function {{PREFIX}}_image_data($img, string $size = 'full'): ?array
{
    $id = 0;
    $url = '';
    $alt = '';
    $width = 0;
    $height = 0;

    if ($img instanceof WP_Post) {
        $id = $img->post_type === 'attachment' ? (int) $img->ID : 0;
    } elseif (is_array($img)) {
        $id = (int) ($img['ID'] ?? $img['id'] ?? 0);
        $alt = (string) ($img['alt'] ?? '');
        if (isset($img['sizes'][$size])) {
            $url = (string) $img['sizes'][$size];
            $width = (int) ($img['sizes'][$size . '-width'] ?? 0);
            $height = (int) ($img['sizes'][$size . '-height'] ?? 0);
        } else {
            $url = (string) ($img['url'] ?? '');
            $width = (int) ($img['width'] ?? 0);
            $height = (int) ($img['height'] ?? 0);
        }
    } elseif (is_int($img) || (is_string($img) && ctype_digit(trim($img)))) {
        $id = (int) $img;
    } elseif (is_string($img)) {
        $url = trim($img);
    }

    // Con ID, WordPress decide: si el adjunto ya no existe o no es una imagen, no hay imagen.
    if ($id > 0) {
        if (!wp_attachment_is_image($id)) {
            return null;
        }
        $src = wp_get_attachment_image_src($id, $size);
        if (!$src || empty($src[0])) {
            return null;
        }
        $url = (string) $src[0];
        $width = (int) ($src[1] ?? 0);
        $height = (int) ($src[2] ?? 0);
        if ($alt === '') {
            $alt = trim((string) get_post_meta($id, '_wp_attachment_image_alt', true));
        }
    }

    $url = esc_url_raw($url);
    if ($url === '') {
        return null;
    }

    return [
        'id' => $id,
        'url' => $url,
        'alt' => $alt,
        'width' => $width ?: null,
        'height' => $height ?: null,
    ];
}

// <img> escapado y listo para imprimir, o '' si no hay imagen. alt vacío = decorativa.
// $args: size, class, alt, loading (lazy|eager), fetchpriority (high|low|auto), sizes, fallback (URL).
function {{PREFIX}}_image($img, array $args = []): string
{
    $args += [
        'size' => 'full',
        'class' => '',
        'alt' => null,
        'loading' => 'lazy',
        'fetchpriority' => '',
        'sizes' => '',
        'fallback' => '',
    ];

    $size = (string) $args['size'];
    $data = {{PREFIX}}_image_data($img, $size);
    if (!$data && $args['fallback'] !== '') {
        $data = {{PREFIX}}_image_data((string) $args['fallback'], $size);
    }
    if (!$data) {
        return '';
    }

    $alt = $args['alt'] !== null ? (string) $args['alt'] : $data['alt'];
    $loading = $args['loading'] === 'eager' ? 'eager' : 'lazy';
    $priority = in_array($args['fetchpriority'], ['high', 'low', 'auto'], true) ? $args['fetchpriority'] : '';

    // Con ID: wp_get_attachment_image agrega srcset, sizes y width/height.
    if ($data['id'] > 0) {
        $attr = ['alt' => $alt, 'loading' => $loading];
        if ($args['class'] !== '') {
            $attr['class'] = (string) $args['class'];
        }
        if ($priority !== '') {
            $attr['fetchpriority'] = $priority;
        }
        if ($args['sizes'] !== '') {
            $attr['sizes'] = (string) $args['sizes'];
        }
        $html = wp_get_attachment_image($data['id'], $size, false, $attr);
        if ($html !== '') {
            return $html;
        }
    }

    $html = '<img src="' . esc_url($data['url']) . '" alt="' . esc_attr($alt) . '"';
    if ($data['width'] && $data['height']) {
        $html .= ' width="' . (int) $data['width'] . '" height="' . (int) $data['height'] . '"';
    }
    if ($args['class'] !== '') {
        $html .= ' class="' . esc_attr((string) $args['class']) . '"';
    }
    $html .= ' loading="' . $loading . '" decoding="async"';
    if ($priority !== '') {
        $html .= ' fetchpriority="' . $priority . '"';
    }

    return $html . '>';
}
