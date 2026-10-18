<?php
defined('ABSPATH') || exit;

/*
 * Helpers de enlaces (skill wp-helper).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Acepta lo que entregue un campo Link de ACF
 * (['url', 'title', 'target']), una URL en texto o un valor vacío, y nunca imprime un enlace roto:
 *
 *   <?= {{PREFIX}}_link($campo, ['class' => 'btn']) ?>              el <a> completo (título del campo)
 *   <a<?= {{PREFIX}}_link_attrs($campo, ['class' => 'btn']) ?>>     tus propios hijos (íconos, spans)
 *
 * Qué hace por ti: href solo http, https, mailto, tel, relativo o ancla (nada de javascript:);
 * descarta href vacío o '#'; target="_blank" siempre con rel="noopener" (y noreferrer si es
 * externo); mailto/tel/anclas nunca abren pestaña nueva; normaliza el teléfono; avisa a los
 * lectores de pantalla cuando se abre una pestaña nueva; sin nombre accesible no imprime el <a>.
 */

// Datos del enlace tal como los entrega el campo, o null si no hay un enlace utilizable.
function {{PREFIX}}_link_data($link): ?array
{
    $url = '';
    $title = '';
    $target = '';
    if (is_array($link)) {
        $url = trim((string) ($link['url'] ?? ''));
        $title = trim((string) ($link['title'] ?? ''));
        $target = (string) ($link['target'] ?? '');
    } elseif (is_string($link)) {
        $url = trim($link);
    }
    if ($url === '' || $url === '#') {
        return null;
    }

    $scheme = preg_match('/^([a-z][a-z0-9+.\-]*):/i', $url, $m) ? strtolower($m[1]) : '';
    if ($scheme !== '' && !in_array($scheme, ['http', 'https', 'mailto', 'tel'], true)) {
        return null;
    }

    if ($scheme === 'mailto') {
        $address = rawurldecode((string) strtok(substr($url, 7), '?'));
        if (!is_email($address)) {
            return null;
        }
    } elseif ($scheme === 'tel') {
        // Solo + y dígitos; lo que sigue a ; o , (extensión, pausa) se conserva tal cual.
        [$number, $rest] = array_pad(preg_split('/(?=[;,])/', substr($url, 4), 2), 2, '');
        $digits = preg_replace('/\D/', '', $number);
        if ($digits === '') {
            return null;
        }
        $url = 'tel:' . (strpos(ltrim($number), '+') === 0 ? '+' : '') . $digits . $rest;
    }

    $url = esc_url_raw($url);
    if ($url === '') {
        return null;
    }

    $external = false;
    if ($scheme === 'http' || $scheme === 'https' || strpos($url, '//') === 0) {
        $bare = static fn(string $host): string => preg_replace('/^www\./', '', strtolower($host));
        $host = $bare((string) wp_parse_url($url, PHP_URL_HOST));
        $external = $host !== '' && $host !== $bare((string) wp_parse_url(home_url(), PHP_URL_HOST));
    }

    // mailto, tel y anclas no abren pestaña: target="_blank" no tiene sentido ahí.
    $can_blank = !in_array($scheme, ['mailto', 'tel'], true) && $url[0] !== '#';
    $blank = $can_blank && $target === '_blank';

    return [
        'url' => $url,
        'title' => $title,
        'target' => $blank ? '_blank' : '',
        'rel' => implode(' ', {{PREFIX}}_link_rel_tokens($blank, $external, '')),
        'external' => $external,
        'blank' => $blank,
        'can_blank' => $can_blank,
    ];
}

// Tokens de rel: noopener en toda pestaña nueva, noreferrer si además es externo, más los extra.
function {{PREFIX}}_link_rel_tokens(bool $blank, bool $external, string $extra): array
{
    $tokens = $blank ? ($external ? ['noopener', 'noreferrer'] : ['noopener']) : [];
    foreach (preg_split('/\s+/', strtolower(preg_replace('/[^a-z\s\-]/i', '', $extra)), -1, PREG_SPLIT_NO_EMPTY) as $token) {
        if (!in_array($token, $tokens, true)) {
            $tokens[] = $token;
        }
    }

    return $tokens;
}

// Lo que dicen el campo y los args: ['blank' => bool, 'rel' => string].
function {{PREFIX}}_link_resolve(array $data, array $args): array
{
    $blank = $data['can_blank'] && ($args['blank'] ?? null) !== null ? (bool) $args['blank'] : $data['blank'];

    return [
        'blank' => $blank,
        'rel' => implode(' ', {{PREFIX}}_link_rel_tokens($blank, $data['external'], (string) ($args['rel'] ?? ''))),
    ];
}

// Atributos del <a> ya escapados (con un espacio delante) o '' si no hay enlace. Para usar en un
// <a> o botón propio. $args: blank (null = lo que diga el campo | true | false), rel (nofollow,
// sponsored, ugc…), class, label (aria-label), download, current (aria-current="page" si es esta página).
function {{PREFIX}}_link_attrs($link, array $args = []): string
{
    $data = {{PREFIX}}_link_data($link);
    if (!$data) {
        return '';
    }
    $resolved = {{PREFIX}}_link_resolve($data, $args);

    $html = ' href="' . esc_url($data['url']) . '"';
    if ($resolved['blank']) {
        $html .= ' target="_blank"';
    }
    if ($resolved['rel'] !== '') {
        $html .= ' rel="' . esc_attr($resolved['rel']) . '"';
    }
    if (($args['class'] ?? '') !== '') {
        $html .= ' class="' . esc_attr((string) $args['class']) . '"';
    }
    if (($args['label'] ?? '') !== '') {
        $html .= ' aria-label="' . esc_attr((string) $args['label']) . '"';
    }
    if (!empty($args['current']) && !$data['external'] && $data['url'][0] !== '#' && !preg_match('/^(mailto|tel):/', $data['url'])) {
        $path = rtrim((string) wp_parse_url($data['url'], PHP_URL_PATH), '/');
        $now = rtrim((string) wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH), '/');
        if ($path === $now) {
            $html .= ' aria-current="page"';
        }
    }
    if (!empty($args['download'])) {
        $html .= ' download';
    }

    return $html;
}

// El <a> completo, o '' si no hay enlace o no tendría nombre accesible. El texto es el título del
// campo o $args['text'] (se escapa; para HTML propio usa {{PREFIX}}_link_attrs). Si abre pestaña
// nueva suma un aviso oculto: sr_class (por defecto "sr-only") y new_tab_label ('' lo desactiva).
// Acepta además los args de {{PREFIX}}_link_attrs().
function {{PREFIX}}_link($link, array $args = []): string
{
    $data = {{PREFIX}}_link_data($link);
    if (!$data) {
        return '';
    }

    $text = esc_html($args['text'] ?? $data['title']);
    if ($text === '' && ($args['label'] ?? '') === '') {
        return '';
    }

    if ({{PREFIX}}_link_resolve($data, $args)['blank'] && $text !== '') {
        $notice = (string) ($args['new_tab_label'] ?? __('se abre en una pestaña nueva', '{{THEME_SLUG}}'));
        if ($notice !== '') {
            $text .= ' <span class="' . esc_attr((string) ($args['sr_class'] ?? 'sr-only')) . '">(' . esc_html($notice) . ')</span>';
        }
    }

    return '<a' . {{PREFIX}}_link_attrs($link, $args) . '>' . $text . '</a>';
}
