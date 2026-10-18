<?php
defined('ABSPATH') || exit;

/*
 * Helper de texto con partes de otro color (skill wp-helper).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Los estilos (marcador + clase) viven en
 * inc/helpers/text-styles.php; cada marcador es un solo carácter y encierra el texto:
 *
 *   echo {{PREFIX}}_highlight('Texto normal |texto de color|');
 *   echo {{PREFIX}}_highlight('Negro |naranja| y *rojo*');        // varios estilos en un mismo texto
 *   echo {{PREFIX}}_highlight($texto, 'naranja');                  // solo ese estilo
 *
 * Para campos de texto o textarea de ACF. Devuelve HTML ya escapado (se imprime sin esc_html).
 * El marcador solo vale si no toca letras ni números por fuera: "a|b|c" y "a=b=c" quedan intactos.
 */

// Estilos válidos de inc/helpers/text-styles.php: nombre => ['marker' => '|', 'class' => 'text-x'].
function {{PREFIX}}_text_styles(): array
{
    static $styles = null;
    if ($styles !== null) {
        return $styles;
    }

    $file = get_theme_file_path('/inc/helpers/text-styles.php');
    $loaded = is_readable($file) ? require $file : [];
    $styles = [];
    foreach ((array) $loaded as $name => $style) {
        $marker = is_array($style) ? (string) ($style['marker'] ?? '') : '';
        $class = is_array($style) ? trim((string) ($style['class'] ?? '')) : '';
        if (strlen($marker) === 1 && strpos('*|~^=', $marker) !== false && $class !== '') {
            $styles[(string) $name] = ['marker' => $marker, 'class' => $class];
        }
    }

    return $styles;
}

function {{PREFIX}}_highlight($text, ?string $only = null): string
{
    // Se escapa una sola vez; después solo se envuelve lo ya escapado.
    $html = esc_html((string) $text);
    if ($html === '') {
        return '';
    }

    foreach ({{PREFIX}}_text_styles() as $name => $style) {
        if ($only !== null && $only !== (string) $name) {
            continue;
        }
        $m = preg_quote($style['marker'], '/');
        $open = '<span class="' . esc_attr($style['class']) . '">';
        $html = preg_replace_callback(
            '/(?<![\w' . $m . '])' . $m . '(?=\S)(.+?)(?<=\S)' . $m . '(?![\w' . $m . '])/u',
            static fn(array $match): string => $open . $match[1] . '</span>',
            $html
        ) ?? $html;
    }

    return $html;
}
