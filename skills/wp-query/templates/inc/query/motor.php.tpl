<?php
defined('ABSPATH') || exit;

/*
 * Listados, filtros combinados, orden, conteos y paginación (skill wp-query).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Lo propio de cada listado vive en inc/query/<contenido>.php (lo genera
 * wp-query desde los specs). El motor:
 *   - trabaja sobre la consulta principal (pre_get_posts) del archivo del contenido, sus taxonomías y, para
 *     el blog, la página de entradas: nunca query_posts ni una segunda consulta que la reemplace;
 *   - acepta solo los filtros definidos y solo valores conocidos (lista blanca);
 *   - combina filtros distintos con Y; dentro de un filtro con varios valores, O o Y según el spec;
 *   - cuenta resultados por opción (fijo o dinámico) con caché que se invalida al editar contenido;
 *   - entrega datos a la vista ({{PREFIX}}_query_filters, _active, _total, _pagination, _related): el HTML
 *     es del diseño;
 *   - marca noindex las páginas filtradas y apunta su canonical a la página sin filtros.
 */

// ---------- Definiciones ----------

function {{PREFIX}}_query_defs(): array
{
    static $defs = null;
    if ($defs === null) {
        $defs = [];
        foreach (glob(get_theme_file_path('inc/query/*.php')) ?: [] as $file) {
            if (basename($file) === 'motor.php') {
                continue;
            }
            $def = require $file;
            if (is_array($def) && !empty($def['contenido'])) {
                $defs[(string) $def['contenido']] = $def;
            }
        }
    }
    return $defs;
}

function {{PREFIX}}_query_def(string $contenido): ?array
{
    return {{PREFIX}}_query_defs()[$contenido] ?? null;
}

// La definición que aplica a una consulta: el archivo del contenido, el de una de sus taxonomías o, para
// `post`, la página de entradas. null fuera de un listado.
function {{PREFIX}}_query_def_for(WP_Query $query): ?array
{
    foreach ({{PREFIX}}_query_defs() as $def) {
        $taxonomias = (array) ($def['taxonomias'] ?? []);
        if ($def['post_type'] === 'post') {
            if ($query->is_home()
                || ($query->is_category() && in_array('category', $taxonomias, true))
                || ($query->is_tag() && in_array('post_tag', $taxonomias, true))) {
                return $def;
            }
        } elseif ($query->is_post_type_archive($def['post_type'])) {
            return $def;
        }
        $custom = array_values(array_diff($taxonomias, ['category', 'post_tag']));
        if ($custom && $query->is_tax($custom)) {
            return $def;
        }
    }
    return null;
}

// La definición del listado que se está viendo (consulta principal).
function {{PREFIX}}_query_current(): ?array
{
    global $wp_query;
    return $wp_query instanceof WP_Query ? {{PREFIX}}_query_def_for($wp_query) : null;
}

// ---------- Leer el pedido (lista blanca) ----------

// Un valor de la URL a lista: `a[]=x&a[]=y` o `a=x,y`. Texto limpio, sin vacíos ni repetidos.
function {{PREFIX}}_query_list($raw): array
{
    $items = is_array($raw) ? $raw : explode(',', (string) $raw);
    $out = [];
    foreach ($items as $item) {
        if (!is_scalar($item)) {
            continue;
        }
        $item = trim(sanitize_text_field(wp_unslash((string) $item)));
        if ($item !== '' && !in_array($item, $out, true)) {
            $out[] = $item;
        }
    }
    return array_slice($out, 0, 50);
}

function {{PREFIX}}_query_number($raw): ?float
{
    if (!is_scalar($raw)) {
        return null;
    }
    $raw = trim((string) $raw);
    return $raw !== '' && is_numeric($raw) ? (float) $raw : null;
}

function {{PREFIX}}_query_date($raw): ?string
{
    if (!is_scalar($raw) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string) $raw, $m)) {
        return null;
    }
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? $m[0] : null;
}

/*
 * Valores activos de un listado a partir de $get (normalmente $_GET). Solo pasa lo que el spec define:
 *   taxonomia  slugs de términos que existen               ['sillas', 'mesas']
 *   opciones   claves de las opciones del campo ACF         ['madera']
 *   rango      números, limitados al mínimo y máximo reales ['min' => 100.0, 'max' => 300.0]
 *   fecha      año, año-mes o desde/hasta                   ['anio' => 2024, 'mes' => 5] | ['desde' => '2024-01-01', 'hasta' => null]
 *   busqueda   texto de hasta 100 caracteres
 *   orden      una clave de sus opciones
 * $term_ok($taxonomia, $slug) y $bounds($nombre, $filtro) se pueden reemplazar (pruebas).
 */
function {{PREFIX}}_query_request(array $def, array $get, ?callable $term_ok = null, ?callable $bounds = null): array
{
    $term_ok = $term_ok ?? static function ($taxonomy, $slug) {
        return (bool) get_term_by('slug', $slug, $taxonomy);
    };
    $activos = [];

    foreach ((array) ($def['filtros'] ?? []) as $name => $filtro) {
        $name = (string) $name;
        switch ($filtro['tipo']) {
            case 'taxonomia':
            case 'opciones':
                $values = {{PREFIX}}_query_list($get[$name] ?? []);
                if ($filtro['tipo'] === 'taxonomia') {
                    $values = array_values(array_filter($values, static function ($slug) use ($term_ok, $filtro) {
                        return $term_ok($filtro['fuente'], $slug);
                    }));
                } else {
                    $keys = array_map('strval', array_keys((array) $filtro['opciones']));
                    $values = array_values(array_intersect($values, $keys));
                }
                if (($filtro['varios'] ?? 'no') === 'no') {
                    $values = array_slice($values, 0, 1);
                }
                if ($values) {
                    $activos[$name] = $values;
                }
                break;

            case 'rango':
                $min = {{PREFIX}}_query_number($get[$name . '_min'] ?? null);
                $max = {{PREFIX}}_query_number($get[$name . '_max'] ?? null);
                if ($min === null && $max === null && isset($get[$name]) && is_scalar($get[$name])
                    && preg_match('/^\s*([\d.]*)\s*-\s*([\d.]*)\s*$/', (string) $get[$name], $m)) {
                    $min = {{PREFIX}}_query_number($m[1]);
                    $max = {{PREFIX}}_query_number($m[2]);
                }
                if ($min !== null && $max !== null && $min > $max) {
                    [$min, $max] = [$max, $min];
                }
                $limits = $bounds ? $bounds($name, $filtro) : null;
                if ($limits && $limits['min'] !== null && $limits['max'] !== null) {
                    // Un extremo igual al límite real no filtra nada: se descarta para no marcar la página como filtrada.
                    $min = $min === null || $min <= $limits['min'] ? null : min($min, $limits['max']);
                    $max = $max === null || $max >= $limits['max'] ? null : max($max, $limits['min']);
                }
                if ($min !== null || $max !== null) {
                    $activos[$name] = ['min' => $min, 'max' => $max];
                }
                break;

            case 'fecha':
                $raw = isset($get[$name]) && is_scalar($get[$name]) ? trim((string) $get[$name]) : '';
                if (preg_match('/^(\d{4})(?:-(\d{2}))?$/', $raw, $m) && (int) $m[1] >= 1900 && (int) $m[1] <= 2100
                    && (!isset($m[2]) || ((int) $m[2] >= 1 && (int) $m[2] <= 12))) {
                    $activos[$name] = ['anio' => (int) $m[1], 'mes' => isset($m[2]) ? (int) $m[2] : null];
                    break;
                }
                $desde = {{PREFIX}}_query_date($get[$name . '_desde'] ?? null);
                $hasta = {{PREFIX}}_query_date($get[$name . '_hasta'] ?? null);
                if ($desde && $hasta && $desde > $hasta) {
                    [$desde, $hasta] = [$hasta, $desde];
                }
                if ($desde || $hasta) {
                    $activos[$name] = ['desde' => $desde, 'hasta' => $hasta];
                }
                break;

            case 'busqueda':
                $text = isset($get[$name]) && is_scalar($get[$name]) ? trim(sanitize_text_field(wp_unslash((string) $get[$name]))) : '';
                $text = function_exists('mb_substr') ? mb_substr($text, 0, 100) : substr($text, 0, 100);
                if ($text !== '') {
                    $activos[$name] = $text;
                }
                break;

            case 'orden':
                $key = isset($get[$name]) && is_scalar($get[$name]) ? (string) $get[$name] : '';
                if ($key !== '' && isset($filtro['opciones'][$key])) {
                    $activos[$name] = $key;
                }
                break;
        }
    }

    // Relevancia solo tiene sentido con una búsqueda.
    foreach ((array) ($def['filtros'] ?? []) as $name => $filtro) {
        if ($filtro['tipo'] === 'orden' && isset($activos[$name])
            && ($filtro['opciones'][$activos[$name]]['orderby'] ?? '') === 'relevance'
            && !{{PREFIX}}_query_search($def, $activos)) {
            unset($activos[$name]);
        }
    }
    return $activos;
}

// Texto buscado entre los activos, o ''.
function {{PREFIX}}_query_search(array $def, array $activos): string
{
    foreach ((array) ($def['filtros'] ?? []) as $name => $filtro) {
        if ($filtro['tipo'] === 'busqueda' && isset($activos[$name])) {
            return (string) $activos[$name];
        }
    }
    return '';
}

// Valores activos del listado que se está viendo (de $_GET, una vez por petición).
function {{PREFIX}}_query_active_values(?array $def = null): array
{
    static $cache = [];
    $def = $def ?? {{PREFIX}}_query_current();
    if (!$def) {
        return [];
    }
    $key = (string) $def['contenido'];
    if (!isset($cache[$key])) {
        $cache[$key] = {{PREFIX}}_query_request($def, $_GET, null, static function ($name, $filtro) use ($def) {
            return {{PREFIX}}_query_bounds($def, (string) $name);
        });
    }
    return $cache[$key];
}

// ---------- Armar la consulta ----------

/*
 * Argumentos de WP_Query para los valores activos. Entre filtros: Y. $except deja fuera un filtro (los
 * conteos dinámicos cuentan cada filtro con los demás activos). No toca post_type ni la paginación.
 */
function {{PREFIX}}_query_args(array $def, array $activos, ?string $except = null): array
{
    $tax = [];
    $meta = [];
    $date = [];
    $args = [];

    foreach ((array) ($def['filtros'] ?? []) as $name => $filtro) {
        $name = (string) $name;
        if ($name === $except || !isset($activos[$name])) {
            continue;
        }
        $value = $activos[$name];
        $and = ($filtro['varios'] ?? 'no') === 'y';

        switch ($filtro['tipo']) {
            case 'taxonomia':
                $tax[] = [
                    'taxonomy' => $filtro['fuente'],
                    'field'    => 'slug',
                    'terms'    => array_values($value),
                    'operator' => $and ? 'AND' : 'IN',
                ];
                break;

            case 'opciones':
                $key = $filtro['fuente'];
                if (($filtro['acf'] ?? '') === 'true_false') {
                    $meta[] = ['key' => $key, 'value' => '1', 'compare' => '='];
                } elseif (($filtro['acf'] ?? '') === 'checkbox') {
                    // ACF guarda el checkbox como arreglo serializado: a:2:{i:0;s:6:"madera";...}
                    $clauses = ['relation' => $and ? 'AND' : 'OR'];
                    foreach ($value as $item) {
                        $clauses[] = ['key' => $key, 'value' => '"' . $item . '"', 'compare' => 'LIKE'];
                    }
                    $meta[] = $clauses;
                } elseif ($and && count($value) > 1) {
                    // Un select de un solo valor no puede tener dos a la vez: no hay resultados.
                    $meta[] = ['key' => $key, 'value' => array_values($value), 'compare' => 'IN'];
                    $args['post__in'] = [0];
                } else {
                    $meta[] = count($value) > 1
                        ? ['key' => $key, 'value' => array_values($value), 'compare' => 'IN']
                        : ['key' => $key, 'value' => $value[0], 'compare' => '='];
                }
                break;

            case 'rango':
                $key = $filtro['fuente'];
                if ($value['min'] !== null && $value['max'] !== null) {
                    $meta[] = ['key' => $key, 'value' => [$value['min'], $value['max']], 'compare' => 'BETWEEN', 'type' => 'DECIMAL(20,4)'];
                } elseif ($value['min'] !== null) {
                    $meta[] = ['key' => $key, 'value' => $value['min'], 'compare' => '>=', 'type' => 'DECIMAL(20,4)'];
                } else {
                    $meta[] = ['key' => $key, 'value' => $value['max'], 'compare' => '<=', 'type' => 'DECIMAL(20,4)'];
                }
                break;

            case 'fecha':
                [$desde, $hasta] = {{PREFIX}}_query_date_span($value);
                if ($filtro['fuente'] === 'post_date') {
                    $clause = ['inclusive' => true];
                    if ($desde) {
                        $clause['after'] = $desde;
                    }
                    if ($hasta) {
                        $clause['before'] = $hasta . ' 23:59:59';
                    }
                    $date[] = $clause;
                } elseif (($filtro['acf'] ?? '') === 'date_time_picker') {
                    // ACF guarda la fecha y hora como Y-m-d H:i:s.
                    if ($desde) {
                        $meta[] = ['key' => $filtro['fuente'], 'value' => $desde . ' 00:00:00', 'compare' => '>=', 'type' => 'DATETIME'];
                    }
                    if ($hasta) {
                        $meta[] = ['key' => $filtro['fuente'], 'value' => $hasta . ' 23:59:59', 'compare' => '<=', 'type' => 'DATETIME'];
                    }
                } else {
                    // ACF guarda la fecha como Ymd.
                    if ($desde) {
                        $meta[] = ['key' => $filtro['fuente'], 'value' => str_replace('-', '', $desde), 'compare' => '>=', 'type' => 'NUMERIC'];
                    }
                    if ($hasta) {
                        $meta[] = ['key' => $filtro['fuente'], 'value' => str_replace('-', '', $hasta), 'compare' => '<=', 'type' => 'NUMERIC'];
                    }
                }
                break;

            case 'busqueda':
                $args['s'] = $value;
                break;
        }
    }

    // Orden: el elegido o el primero del spec.
    foreach ((array) ($def['filtros'] ?? []) as $name => $filtro) {
        if ($filtro['tipo'] !== 'orden' || (string) $name === $except) {
            continue;
        }
        $key = $activos[$name] ?? null;
        if ($key === null) {
            // Por defecto, el primero que no sea relevancia (o relevancia si hay búsqueda).
            foreach ((array) $filtro['opciones'] as $option => $spec) {
                if ($spec['orderby'] !== 'relevance' || isset($args['s'])) {
                    $key = $option;
                    break;
                }
            }
        }
        $orden = $key !== null ? ($filtro['opciones'][$key] ?? null) : null;
        if (!$orden) {
            break;
        }
        if (!empty($orden['campo'])) {
            // Los elementos sin el campo no desaparecen: van al final.
            $meta['orden_campo'] = [
                'relation'    => 'OR',
                'orden_valor' => ['key' => $orden['campo'], 'compare' => 'EXISTS', 'type' => $orden['orderby'] === 'meta_value_num' ? 'DECIMAL(20,4)' : 'CHAR'],
                ['key' => $orden['campo'], 'compare' => 'NOT EXISTS'],
            ];
            $args['orderby'] = ['orden_valor' => $orden['order'], 'date' => 'DESC'];
        } else {
            $args['orderby'] = $orden['orderby'] === 'date' ? ['date' => $orden['order']] : [$orden['orderby'] => $orden['order'], 'date' => 'DESC'];
        }
        break;
    }

    if ($tax) {
        $args['tax_query'] = array_merge(['relation' => 'AND'], $tax);
    }
    if ($meta) {
        $args['meta_query'] = array_merge(['relation' => 'AND'], $meta);
    }
    if ($date) {
        $args['date_query'] = $date;
    }
    return $args;
}

// [desde, hasta] (Y-m-d o null) de un valor de fecha activo.
function {{PREFIX}}_query_date_span(array $value): array
{
    if (isset($value['anio'])) {
        $anio = (int) $value['anio'];
        if (!empty($value['mes'])) {
            $mes = (int) $value['mes'];
            $ultimo = (int) gmdate('t', gmmktime(0, 0, 0, $mes, 1, $anio));
            return [sprintf('%04d-%02d-01', $anio, $mes), sprintf('%04d-%02d-%02d', $anio, $mes, $ultimo)];
        }
        return [sprintf('%04d-01-01', $anio), sprintf('%04d-12-31', $anio)];
    }
    return [$value['desde'] ?? null, $value['hasta'] ?? null];
}

// Une dos grupos de cláusulas (tax_query o meta_query) con Y, sin perder los que ya traía la consulta.
function {{PREFIX}}_query_merge($current, array $extra): array
{
    $current = is_array($current) ? $current : [];
    if (!$current) {
        return $extra;
    }
    return ['relation' => 'AND', $current, $extra];
}

add_action('pre_get_posts', function (WP_Query $query) {
    if (is_admin() || !$query->is_main_query()) {
        return;
    }
    $def = {{PREFIX}}_query_def_for($query);
    if (!$def) {
        return;
    }

    $activos = {{PREFIX}}_query_active_values($def);
    $args = {{PREFIX}}_query_args($def, $activos);

    $query->set('post_type', $def['post_type']);
    $query->set('posts_per_page', ($def['paginacion'] ?? '') === 'ninguna' ? -1 : max(1, (int) $def['por_pagina']));
    if ($activos) {
        $query->set('ignore_sticky_posts', true);
    }
    // En el archivo de un término, WordPress suma ese término a esta tax_query: queda fijo y los filtros se agregan.
    if (isset($args['tax_query'])) {
        $query->set('tax_query', {{PREFIX}}_query_merge($query->get('tax_query'), $args['tax_query']));
    }
    if (isset($args['meta_query'])) {
        $query->set('meta_query', {{PREFIX}}_query_merge($query->get('meta_query'), $args['meta_query']));
    }
    foreach (['date_query', 's', 'orderby', 'post__in'] as $key) {
        if (isset($args[$key])) {
            $query->set($key, $args[$key]);
        }
    }
}, 20);

// ---------- Caché ----------

// Versión del contenido: cambia al guardar, borrar o reasignar un elemento. Las claves de caché la incluyen,
// así lo guardado nunca queda viejo. Se guarda en una opción porque sin caché persistente
// wp_cache_get_last_changed cambia en cada petición.
function {{PREFIX}}_query_version(): string
{
    return (string) get_option('{{PREFIX}}_query_version', '1');
}

function {{PREFIX}}_query_bump(): void
{
    static $done = false;
    if (!$done) {
        $done = true;
        update_option('{{PREFIX}}_query_version', (string) microtime(true), true);
    }
}

foreach (['save_post', 'deleted_post', 'trashed_post', 'untrashed_post', 'set_object_terms', 'edited_term', 'delete_term'] as $hook) {
    add_action($hook, '{{PREFIX}}_query_bump');
}
// Los campos ACF se guardan después de save_post. Las marcas de edición del admin (_edit_lock) no cuentan.
foreach (['added_post_meta', 'updated_post_meta', 'deleted_post_meta'] as $hook) {
    add_action($hook, function ($meta_id, $object_id, $meta_key) {
        if (strpos((string) $meta_key, '_edit_') !== 0) {
            {{PREFIX}}_query_bump();
        }
    }, 10, 3);
}

function {{PREFIX}}_query_cache(string $key, callable $compute)
{
    $key = '{{PREFIX}}_q_' . md5($key . '|' . {{PREFIX}}_query_version());
    $value = wp_cache_get($key, '{{PREFIX}}_query');
    if ($value !== false) {
        return $value;
    }
    $value = get_transient($key);
    if ($value === false) {
        $value = $compute();
        set_transient($key, $value, 12 * HOUR_IN_SECONDS);
    }
    wp_cache_set($key, $value, '{{PREFIX}}_query');
    return $value;
}

// ---------- Límites y conteos ----------

// Mínimo y máximo reales de un filtro de rango entre los publicados: ['min' => float|null, 'max' => float|null].
function {{PREFIX}}_query_bounds(array $def, string $name): array
{
    $filtro = $def['filtros'][$name] ?? null;
    if (!$filtro || $filtro['tipo'] !== 'rango') {
        return ['min' => null, 'max' => null];
    }
    return {{PREFIX}}_query_cache('bounds|' . $def['post_type'] . '|' . $filtro['fuente'], function () use ($def, $filtro) {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT MIN(CAST(pm.meta_value AS DECIMAL(20,4))) AS min_value, MAX(CAST(pm.meta_value AS DECIMAL(20,4))) AS max_value
             FROM {$wpdb->postmeta} pm INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
             WHERE pm.meta_key = %s AND p.post_type = %s AND p.post_status = 'publish' AND pm.meta_value <> ''",
            $filtro['fuente'],
            $def['post_type']
        ), ARRAY_A);
        return [
            'min' => isset($row['min_value']) ? (float) $row['min_value'] : null,
            'max' => isset($row['max_value']) ? (float) $row['max_value'] : null,
        ];
    });
}

// Cláusula del término del archivo que se está viendo (para que los conteos respeten la categoría abierta).
function {{PREFIX}}_query_context_tax(): array
{
    if (!(is_tax() || is_category() || is_tag())) {
        return [];
    }
    $term = get_queried_object();
    return $term instanceof WP_Term ? [['taxonomy' => $term->taxonomy, 'field' => 'term_id', 'terms' => [$term->term_id]]] : [];
}

// IDs publicados del contenido con los filtros activos menos $except.
function {{PREFIX}}_query_ids(array $def, array $activos, ?string $except): array
{
    $args = {{PREFIX}}_query_args($def, $activos, $except);
    $context = {{PREFIX}}_query_context_tax();
    if ($context) {
        $args['tax_query'] = {{PREFIX}}_query_merge($args['tax_query'] ?? [], array_merge(['relation' => 'AND'], $context));
    }
    unset($args['orderby']);
    $query = new WP_Query(array_merge($args, [
        'post_type'              => $def['post_type'],
        'post_status'            => 'publish',
        'posts_per_page'         => -1,
        'fields'                 => 'ids',
        'no_found_rows'          => true,
        'ignore_sticky_posts'    => true,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ]));
    return array_map('intval', $query->posts);
}

/*
 * Conteo por opción de un filtro (taxonomia u opciones): [valor => número]. `fijo` cuenta todo el contenido;
 * `dinamico` cuenta con los demás filtros activos. Un término padre suma a sus hijos (como el filtro, que los incluye).
 */
function {{PREFIX}}_query_counts(array $def, string $name, array $activos): array
{
    $filtro = $def['filtros'][$name] ?? null;
    $modo = $filtro['conteo'] ?? 'ninguno';
    if (!$filtro || $modo === 'ninguno' || !in_array($filtro['tipo'], ['taxonomia', 'opciones'], true)) {
        return [];
    }
    $dinamico = $modo === 'dinamico';
    $context = $dinamico ? {{PREFIX}}_query_context_tax() : [];
    $key = 'counts|' . $def['contenido'] . '|' . $name . '|' . ($dinamico ? wp_json_encode([array_diff_key($activos, [$name => 1]), $context]) : 'fijo');

    return {{PREFIX}}_query_cache($key, function () use ($def, $name, $filtro, $activos, $dinamico) {
        global $wpdb;
        $ids = $dinamico ? {{PREFIX}}_query_ids($def, $activos, $name) : null;
        if ($ids === []) {
            return [];
        }
        $in = $ids === null ? '' : ' AND p.ID IN (' . implode(',', $ids) . ')';

        if ($filtro['tipo'] === 'taxonomia') {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT tt.term_id, tr.object_id FROM {$wpdb->term_relationships} tr
                 INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
                 INNER JOIN {$wpdb->posts} p ON p.ID = tr.object_id
                 WHERE tt.taxonomy = %s AND p.post_type = %s AND p.post_status = 'publish'" . $in,
                $filtro['fuente'],
                $def['post_type']
            ), ARRAY_A);
            $objects = [];
            $parents = [];
            if (is_taxonomy_hierarchical($filtro['fuente'])) {
                foreach (get_terms(['taxonomy' => $filtro['fuente'], 'hide_empty' => false, 'fields' => 'id=>parent']) ?: [] as $id => $parent) {
                    $parents[(int) $id] = (int) $parent;
                }
            }
            foreach ($rows as $row) {
                $term = (int) $row['term_id'];
                $seen = [];
                while ($term && !isset($seen[$term])) {
                    $seen[$term] = true;
                    $objects[$term][(int) $row['object_id']] = true;
                    $term = $parents[$term] ?? 0;
                }
            }
            $counts = [];
            foreach ($objects as $term_id => $set) {
                $term = get_term($term_id, $filtro['fuente']);
                if ($term instanceof WP_Term) {
                    $counts[$term->slug] = count($set);
                }
            }
            return $counts;
        }

        $counts = [];
        $base = "FROM {$wpdb->postmeta} pm INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = %s AND p.post_type = %s AND p.post_status = 'publish'" . $in;
        if (($filtro['acf'] ?? '') === 'checkbox') {
            foreach (array_keys((array) $filtro['opciones']) as $option) {
                $counts[(string) $option] = (int) $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(DISTINCT p.ID) $base AND pm.meta_value LIKE %s",
                    $filtro['fuente'],
                    $def['post_type'],
                    '%' . $wpdb->esc_like('"' . $option . '"') . '%'
                ));
            }
            return $counts;
        }
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT pm.meta_value AS value, COUNT(DISTINCT p.ID) AS total $base GROUP BY pm.meta_value",
            $filtro['fuente'],
            $def['post_type']
        ), ARRAY_A);
        foreach ($rows as $row) {
            $counts[(string) $row['value']] = (int) $row['total'];
        }
        return $counts;
    });
}

// Años (y meses) con contenido, para un filtro de fecha: [2024, 2023, ...].
function {{PREFIX}}_query_years(array $def, array $filtro): array
{
    return {{PREFIX}}_query_cache('years|' . $def['post_type'] . '|' . $filtro['fuente'], function () use ($def, $filtro) {
        global $wpdb;
        if ($filtro['fuente'] === 'post_date') {
            $years = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT YEAR(post_date) FROM {$wpdb->posts} WHERE post_type = %s AND post_status = 'publish' ORDER BY 1 DESC",
                $def['post_type']
            ));
        } else {
            $years = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT LEFT(pm.meta_value, 4) FROM {$wpdb->postmeta} pm INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = %s AND p.post_type = %s AND p.post_status = 'publish' AND pm.meta_value <> '' ORDER BY 1 DESC",
                $filtro['fuente'],
                $def['post_type']
            ));
        }
        return array_values(array_filter(array_map('intval', $years)));
    });
}

// ---------- URLs ----------

// La URL del listado sin filtros ni página.
function {{PREFIX}}_query_reset_url(): string
{
    $def = {{PREFIX}}_query_current();
    $object = get_queried_object();
    if ($object instanceof WP_Term) {
        $url = get_term_link($object);
    } elseif ($def && $def['post_type'] === 'post') {
        $page = (int) get_option('page_for_posts');
        $url = $page ? get_permalink($page) : home_url('/');
    } elseif ($def) {
        $url = get_post_type_archive_link($def['post_type']);
    } else {
        $url = home_url('/');
    }
    return is_string($url) ? strtok($url, '?') : home_url('/');
}

// Parámetros de la URL para unos valores activos: varios valores van separados por coma (?categoria=sillas,mesas).
function {{PREFIX}}_query_url_args(array $def, array $activos): array
{
    $out = [];
    foreach ((array) ($def['filtros'] ?? []) as $name => $filtro) {
        if (!isset($activos[$name])) {
            continue;
        }
        $value = $activos[$name];
        switch ($filtro['tipo']) {
            case 'taxonomia':
            case 'opciones':
                $out[$name] = implode(',', $value);
                break;
            case 'rango':
                if ($value['min'] !== null) {
                    $out[$name . '_min'] = rtrim(rtrim(sprintf('%.4F', $value['min']), '0'), '.');
                }
                if ($value['max'] !== null) {
                    $out[$name . '_max'] = rtrim(rtrim(sprintf('%.4F', $value['max']), '0'), '.');
                }
                break;
            case 'fecha':
                if (isset($value['anio'])) {
                    $out[$name] = $value['mes'] ? sprintf('%04d-%02d', $value['anio'], $value['mes']) : (string) $value['anio'];
                } else {
                    if ($value['desde']) {
                        $out[$name . '_desde'] = $value['desde'];
                    }
                    if ($value['hasta']) {
                        $out[$name . '_hasta'] = $value['hasta'];
                    }
                }
                break;
            default:
                $out[$name] = (string) $value;
        }
    }
    return $out;
}

// URL del listado con unos valores activos (sin página: cambiar un filtro vuelve a la primera).
function {{PREFIX}}_query_url(array $activos, ?array $def = null): string
{
    $def = $def ?? {{PREFIX}}_query_current();
    $url = {{PREFIX}}_query_reset_url();
    if (!$def) {
        return $url;
    }
    $args = array_map(static function ($value) {
        return str_replace('%2C', ',', rawurlencode((string) $value));
    }, {{PREFIX}}_query_url_args($def, $activos));
    return $args ? add_query_arg($args, $url) : $url;
}

// URL que marca o desmarca una opción de un filtro, con los demás filtros como están.
function {{PREFIX}}_query_toggle_url(string $name, string $value): string
{
    $def = {{PREFIX}}_query_current();
    $activos = {{PREFIX}}_query_active_values($def);
    $current = (array) ($activos[$name] ?? []);
    if (in_array($value, $current, true)) {
        $current = array_values(array_diff($current, [$value]));
    } elseif (($def['filtros'][$name]['varios'] ?? 'no') === 'no') {
        $current = [$value];
    } else {
        $current[] = $value;
    }
    if ($current) {
        $activos[$name] = $current;
    } else {
        unset($activos[$name]);
    }
    return {{PREFIX}}_query_url($activos, $def);
}

// ---------- Datos para la vista ----------

function {{PREFIX}}_query_order_label(string $key, array $spec): string
{
    $labels = ['reciente' => 'Más recientes', 'antiguo' => 'Más antiguos', 'az' => 'Nombre (A-Z)', 'za' => 'Nombre (Z-A)', 'relevancia' => 'Relevancia'];
    if (isset($labels[$key])) {
        return $labels[$key];
    }
    $campo = ucfirst(str_replace('-', ' ', preg_replace('/-(asc|desc)$/', '', $key)));
    return $campo . ($spec['order'] === 'ASC' ? ' (menor a mayor)' : ' (mayor a menor)');
}

// Opciones de una taxonomía con su conteo, anidadas si es jerárquica.
function {{PREFIX}}_query_term_options(array $filtro, string $name, array $selected, ?array $counts, int $parent = 0): array
{
    $hierarchical = is_taxonomy_hierarchical($filtro['fuente']);
    $terms = get_terms([
        'taxonomy'   => $filtro['fuente'],
        'hide_empty' => true,
        'parent'     => $hierarchical ? $parent : '',
        'orderby'    => 'name',
    ]);
    $options = [];
    foreach (is_array($terms) ? $terms : [] as $term) {
        $count = $counts === null ? null : (int) ($counts[$term->slug] ?? 0);
        $marked = in_array($term->slug, $selected, true);
        $options[] = [
            'valor'       => $term->slug,
            'etiqueta'    => $term->name,
            'conteo'      => $count,
            'marcada'     => $marked,
            'desactivada' => $count === 0 && !$marked,
            'url'         => {{PREFIX}}_query_toggle_url($name, $term->slug),
            'hijos'       => $hierarchical ? {{PREFIX}}_query_term_options($filtro, $name, $selected, $counts, (int) $term->term_id) : [],
        ];
    }
    return $options;
}

/*
 * Los filtros del listado actual, listos para pintar con el HTML del diseño. Cada uno:
 *   clave, name (el name del control: `categoria[]` si admite varios), tipo, vista, etiqueta, varios,
 *   valor (lo activo), opciones [valor, etiqueta, conteo|null, marcada, desactivada, url, hijos],
 *   y en un rango min/max reales y names [min, max]; en una fecha, names [desde, hasta].
 */
function {{PREFIX}}_query_filters(?string $contenido = null): array
{
    $def = $contenido ? {{PREFIX}}_query_def($contenido) : {{PREFIX}}_query_current();
    if (!$def) {
        return [];
    }
    $activos = {{PREFIX}}_query_active_values($def);
    $out = [];

    foreach ((array) $def['filtros'] as $name => $filtro) {
        $name = (string) $name;
        $multiple = ($filtro['varios'] ?? 'no') !== 'no';
        $item = [
            'clave'    => $name,
            'name'     => $name . ($multiple ? '[]' : ''),
            'tipo'     => $filtro['tipo'],
            'vista'    => $filtro['vista'] ?? '',
            'etiqueta' => $filtro['etiqueta'] ?? '',
            'varios'   => $multiple,
            'valor'    => $activos[$name] ?? null,
            'opciones' => [],
        ];
        $selected = array_map('strval', (array) ($activos[$name] ?? []));

        switch ($filtro['tipo']) {
            case 'taxonomia':
                $counts = ($filtro['conteo'] ?? 'ninguno') === 'ninguno' ? null : {{PREFIX}}_query_counts($def, $name, $activos);
                if ($item['etiqueta'] === '' && ($taxonomy = get_taxonomy($filtro['fuente']))) {
                    $item['etiqueta'] = $taxonomy->labels->singular_name;
                }
                $item['opciones'] = {{PREFIX}}_query_term_options($filtro, $name, $selected, $counts);
                break;

            case 'opciones':
                $counts = ($filtro['conteo'] ?? 'ninguno') === 'ninguno' ? null : {{PREFIX}}_query_counts($def, $name, $activos);
                foreach ((array) $filtro['opciones'] as $value => $label) {
                    $value = (string) $value;
                    $count = $counts === null ? null : (int) ($counts[$value] ?? 0);
                    $marked = in_array($value, $selected, true);
                    $item['opciones'][] = [
                        'valor'       => $value,
                        'etiqueta'    => (string) $label,
                        'conteo'      => $count,
                        'marcada'     => $marked,
                        'desactivada' => $count === 0 && !$marked,
                        'url'         => {{PREFIX}}_query_toggle_url($name, $value),
                        'hijos'       => [],
                    ];
                }
                break;

            case 'rango':
                $bounds = {{PREFIX}}_query_bounds($def, $name);
                $item['min'] = $bounds['min'];
                $item['max'] = $bounds['max'];
                $item['names'] = ['min' => $name . '_min', 'max' => $name . '_max'];
                $item['valor'] = $activos[$name] ?? ['min' => null, 'max' => null];
                break;

            case 'fecha':
                $item['names'] = ['desde' => $name . '_desde', 'hasta' => $name . '_hasta'];
                $current = isset($activos[$name]['anio']) ? (string) $activos[$name]['anio'] : '';
                foreach ({{PREFIX}}_query_years($def, $filtro) as $year) {
                    $item['opciones'][] = [
                        'valor'       => (string) $year,
                        'etiqueta'    => (string) $year,
                        'conteo'      => null,
                        'marcada'     => $current === (string) $year,
                        'desactivada' => false,
                        'url'         => '',
                        'hijos'       => [],
                    ];
                }
                break;

            case 'busqueda':
                $item['valor'] = (string) ($activos[$name] ?? '');
                break;

            case 'orden':
                $current = $activos[$name] ?? null;
                $first = true;
                foreach ((array) $filtro['opciones'] as $key => $spec) {
                    if ($spec['orderby'] === 'relevance' && !{{PREFIX}}_query_search($def, $activos)) {
                        continue;
                    }
                    $item['opciones'][] = [
                        'valor'       => (string) $key,
                        'etiqueta'    => {{PREFIX}}_query_order_label((string) $key, $spec),
                        'conteo'      => null,
                        'marcada'     => $current === null ? $first : $current === (string) $key,
                        'desactivada' => false,
                        'url'         => '',
                        'hijos'       => [],
                    ];
                    $first = false;
                }
                break;
        }
        $out[$name] = $item;
    }
    return $out;
}

// Un filtro del listado actual por su clave (o null).
function {{PREFIX}}_query_filter(string $name): ?array
{
    return {{PREFIX}}_query_filters()[$name] ?? null;
}

// Los filtros activos como chips: [filtro, etiqueta, url para quitarlo]. El orden no es un chip.
function {{PREFIX}}_query_active(): array
{
    $def = {{PREFIX}}_query_current();
    if (!$def) {
        return [];
    }
    $activos = {{PREFIX}}_query_active_values($def);
    $chips = [];
    foreach ((array) $def['filtros'] as $name => $filtro) {
        if (!isset($activos[$name]) || $filtro['tipo'] === 'orden') {
            continue;
        }
        $value = $activos[$name];
        $without = $activos;
        unset($without[$name]);

        if (in_array($filtro['tipo'], ['taxonomia', 'opciones'], true)) {
            foreach ($value as $item) {
                $label = $item;
                if ($filtro['tipo'] === 'taxonomia') {
                    $term = get_term_by('slug', $item, $filtro['fuente']);
                    $label = $term ? $term->name : $item;
                } else {
                    $label = (string) ($filtro['opciones'][$item] ?? $item);
                }
                $chips[] = ['filtro' => (string) $name, 'etiqueta' => $label, 'url' => {{PREFIX}}_query_toggle_url((string) $name, (string) $item)];
            }
            continue;
        }
        if ($filtro['tipo'] === 'rango') {
            $min = $value['min'] !== null ? number_format_i18n($value['min']) : '…';
            $max = $value['max'] !== null ? number_format_i18n($value['max']) : '…';
            $label = $min . ' – ' . $max;
        } elseif ($filtro['tipo'] === 'fecha') {
            [$desde, $hasta] = {{PREFIX}}_query_date_span($value);
            $label = isset($value['anio']) ? ($value['mes'] ? sprintf('%02d/%04d', $value['mes'], $value['anio']) : (string) $value['anio']) : trim(($desde ?? '…') . ' – ' . ($hasta ?? '…'));
        } else {
            $label = '“' . $value . '”';
        }
        $chips[] = ['filtro' => (string) $name, 'etiqueta' => $label, 'url' => {{PREFIX}}_query_url($without, $def)];
    }
    return $chips;
}

// ¿La página tiene algún filtro, búsqueda u orden activo? (la paginación sola no cuenta)
function {{PREFIX}}_query_is_filtered(): bool
{
    return (bool) {{PREFIX}}_query_active_values();
}

// Total de resultados de la consulta principal: ['numero' => 12, 'texto' => '12 resultados'].
function {{PREFIX}}_query_total(): array
{
    global $wp_query;
    $total = $wp_query instanceof WP_Query ? (int) $wp_query->found_posts : 0;
    $text = $total === 0
        ? 'Sin resultados'
        : sprintf(_n('%s resultado', '%s resultados', $total), number_format_i18n($total));
    return ['numero' => $total, 'texto' => $text];
}

/*
 * Paginación de la consulta principal, con los filtros activos en cada enlace. Imprime:
 *   numeros     <nav aria-label="Paginación"> con los enlaces de paginate_links
 *   cargar_mas  un enlace "Cargar más" a la página siguiente (data-query-mas; sin JS, abre esa página)
 *   infinito    igual que cargar_mas (el JS lo carga al llegar al final)
 *   ninguna     nada
 * $args: prev_text, next_text, more_text, class.
 */
function {{PREFIX}}_query_pagination(array $args = []): void
{
    global $wp_query;
    $def = {{PREFIX}}_query_current();
    if (!$def || !($wp_query instanceof WP_Query) || ($def['paginacion'] ?? '') === 'ninguna') {
        return;
    }
    $pages = (int) $wp_query->max_num_pages;
    if ($pages < 2) {
        return;
    }
    $args = wp_parse_args($args, ['prev_text' => 'Anterior', 'next_text' => 'Siguiente', 'more_text' => 'Cargar más', 'class' => 'pagination']);
    $current = max(1, (int) get_query_var('paged'));
    $filters = array_map('rawurlencode', {{PREFIX}}_query_url_args($def, {{PREFIX}}_query_active_values($def)));
    $base = {{PREFIX}}_query_reset_url();
    $pretty = (bool) get_option('permalink_structure');

    if (($def['paginacion'] ?? '') !== 'numeros') {
        if ($current >= $pages) {
            return;
        }
        $next = $pretty ? trailingslashit($base) . user_trailingslashit('page/' . ($current + 1), 'paged') : add_query_arg('paged', $current + 1, $base);
        printf(
            '<nav class="%1$s" aria-label="Paginación"><a href="%2$s" rel="next" data-query-mas>%3$s</a></nav>',
            esc_attr($args['class']),
            esc_url(add_query_arg($filters, $next)),
            esc_html($args['more_text'])
        );
        return;
    }

    $links = paginate_links([
        'base'      => $pretty ? trailingslashit($base) . '%_%' : add_query_arg('paged', '%#%', $base),
        'format'    => $pretty ? user_trailingslashit('page/%#%', 'paged') : '',
        'current'   => $current,
        'total'     => $pages,
        'add_args'  => $filters,
        'prev_text' => esc_html($args['prev_text']),
        'next_text' => esc_html($args['next_text']),
    ]);
    if ($links) {
        printf('<nav class="%1$s" aria-label="Paginación">%2$s</nav>', esc_attr($args['class']), wp_kses_post($links));
    }
}

/*
 * Relacionados de un elemento: mismos términos de la taxonomía de `relacionadas`, sin el actual (los más
 * recientes si no tiene términos). Devuelve un WP_Query: quien lo recorre llama a wp_reset_postdata() al terminar.
 */
function {{PREFIX}}_query_related($post = null, int $count = 3): WP_Query
{
    $post = get_post($post);
    $def = $post ? {{PREFIX}}_query_def($post->post_type === 'post' ? 'post' : $post->post_type) : null;
    $args = [
        'post_type'           => $post ? $post->post_type : 'post',
        'post_status'         => 'publish',
        'posts_per_page'      => max(1, $count),
        'post__not_in'        => $post ? [$post->ID] : [],
        'ignore_sticky_posts' => true,
        'no_found_rows'       => true,
    ];
    $taxonomy = $def['relacionadas'] ?? '';
    if ($post && $taxonomy) {
        $terms = wp_get_post_terms($post->ID, $taxonomy, ['fields' => 'ids']);
        if (is_array($terms) && $terms) {
            $args['tax_query'] = [['taxonomy' => $taxonomy, 'field' => 'term_id', 'terms' => $terms]];
        }
    }
    return new WP_Query($args);
}

// ---------- SEO ----------

// Las combinaciones de filtros no se indexan (serían miles de páginas casi iguales); la paginación sola sí.
add_filter('wp_robots', function (array $robots) {
    if ({{PREFIX}}_query_current() && {{PREFIX}}_query_is_filtered()) {
        $robots['noindex'] = true;
        $robots['follow'] = true;
        unset($robots['index']);
    }
    return $robots;
});

add_filter('wpseo_robots', function ($robots) {
    return {{PREFIX}}_query_current() && {{PREFIX}}_query_is_filtered() ? 'noindex, follow' : $robots;
});

add_filter('rank_math/frontend/robots', function ($robots) {
    if ({{PREFIX}}_query_current() && {{PREFIX}}_query_is_filtered()) {
        $robots['index'] = 'noindex';
        $robots['follow'] = 'follow';
    }
    return $robots;
});

// El canonical de una página filtrada es el listado sin filtros.
function {{PREFIX}}_query_canonical($canonical)
{
    return {{PREFIX}}_query_current() && {{PREFIX}}_query_is_filtered() ? {{PREFIX}}_query_reset_url() : $canonical;
}
add_filter('wpseo_canonical', '{{PREFIX}}_query_canonical');
add_filter('rank_math/frontend/canonical', '{{PREFIX}}_query_canonical');

add_action('wp_head', function () {
    if (defined('WPSEO_VERSION') || class_exists('RankMath')) {
        return; // el plugin de SEO imprime su canonical (con el filtro de arriba)
    }
    if ({{PREFIX}}_query_current() && {{PREFIX}}_query_is_filtered()) {
        printf('<link rel="canonical" href="%s">' . "\n", esc_url({{PREFIX}}_query_reset_url()));
    }
}, 1);
