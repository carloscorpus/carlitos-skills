<?php
/*
 * Prueba del motor de wp-query con una tienda de WooCommerce, sin WordPress ni WooCommerce: carga inc/query/motor.php con
 * funciones de WP y un WC() simulados, lee la definición generada de una tienda (post_type product, woo) y revisa
 *   - la lista blanca del pedido (precio, categoría, orden de WooCommerce),
 *   - los argumentos de la consulta (el precio y el orden van aparte, no como meta_query),
 *   - el enganche a pre_get_posts (llama a get_catalog_ordering_args de WooCommerce) y
 *   - el filtro posts_clauses del precio (presenta min_price/max_price a WooCommerce y deja $_GET como estaba; sin ese
 *     método usa su propia condición).
 *
 * Uso: php motor-woo.php <motor.php instalado> <definición inc/query/producto.php de la tienda>
 * Imprime JSON { passed, failures } y sale con 1 si algo falla. La corre tests/check.mjs.
 */

define('ABSPATH', __DIR__ . '/');
define('HOUR_IN_SECONDS', 3600);
define('ARRAY_A', 'ARRAY_A');

$GLOBALS['hooks'] = [];
$GLOBALS['removed'] = [];
function add_action($hook, $callback, $priority = 10, $args = 1) { $GLOBALS['hooks'][$hook][] = [$callback, $priority]; return true; }
function add_filter($hook, $callback, $priority = 10, $args = 1) { return add_action($hook, $callback, $priority, $args); }
function remove_filter($hook, $callback, $priority = 10) { $GLOBALS['removed'][] = $hook; return true; }
function get_theme_file_path($path = '') { return $GLOBALS['themeDir'] . '/' . ltrim($path, '/'); }
function wp_unslash($value) { return is_string($value) ? stripslashes($value) : $value; }
function sanitize_text_field($value) { return trim(preg_replace('/[\r\n\t ]+/', ' ', strip_tags((string) $value))); }
function is_admin() { return false; }
function get_option($name, $default = false) { return '1'; }
function wp_cache_get($key, $group = '') { return false; }
function wp_cache_set($key, $value, $group = '') { return true; }
function get_transient($key) { return false; }
function set_transient($key, $value, $expiration = 0) { return true; }
function wp_json_encode($value) { return json_encode($value); }
function get_term_by($field, $slug, $taxonomy) { return in_array($slug, ['cursos', 'servicios'], true) ? (object) ['slug' => $slug] : false; }

class WP_Query
{
    public $vars = [];
    public $posts = [];
    public function __construct(array $vars = []) { $this->vars = $vars; }
    public function get($key) { return $this->vars[$key] ?? ''; }
    public function set($key, $value) { $this->vars[$key] = $value; }
    public function is_main_query() { return true; }
    public function is_post_type_archive($type = '') { return $type === 'product'; }
    public function is_home() { return false; }
    public function is_category() { return false; }
    public function is_tag() { return false; }
    public function is_tax($taxonomy = '') { return false; }
}

// Un WooCommerce mínimo: get_catalog_ordering_args, get_tax_query y, según el caso, price_filter_post_clauses.
$GLOBALS['woo_calls'] = [];
$GLOBALS['woo_price_get'] = null;
class FakeWcQuery
{
    public function get_catalog_ordering_args($orderby, $order)
    {
        $GLOBALS['woo_calls'][] = [$orderby, $order];
        return ['orderby' => $orderby, 'order' => $order, 'meta_key' => ''];
    }
    public function get_tax_query($tax = [], $main = false) { return []; }
    public function price_filter_post_clauses($clauses, $query)
    {
        $GLOBALS['woo_price_get'] = ['min' => $_GET['min_price'] ?? null, 'max' => $_GET['max_price'] ?? null];
        $clauses['where'] .= ' AND woo-precio';
        return $clauses;
    }
}
class FakeWcQueryOld
{
    public function get_catalog_ordering_args($orderby, $order) { return ['orderby' => $orderby, 'order' => $order, 'meta_key' => '']; }
    public function get_tax_query($tax = [], $main = false) { return []; }
}
$GLOBALS['wc_query'] = new FakeWcQuery();
function WC() { return (object) ['query' => $GLOBALS['wc_query']]; }

$wpdb = new class {
    public $prefix = 'wp_';
    public $posts = 'wp_posts';
    public function prepare($sql, ...$args) { return vsprintf(str_replace('%f', '%s', $sql), array_map('strval', $args)); }
    public function get_row($sql, $output = '') { return null; }
};

[, $motorFile, $tiendaFile] = $argv;
$GLOBALS['themeDir'] = dirname($tiendaFile, 3); // <tema>/inc/query/producto.php -> <tema>
require $motorFile;
$tienda = require $tiendaFile;

$failures = [];
$passed = 0;
function check(string $name, $actual, $expected): void
{
    global $failures, $passed;
    if ($actual === $expected) {
        $passed++;
        return;
    }
    $failures[] = ['test' => $name, 'expected' => $expected, 'actual' => $actual];
}
$hook = function (string $name, int $priority = null) {
    foreach ($GLOBALS['hooks'][$name] ?? [] as [$callback, $p]) {
        if ($priority === null || $p === $priority) {
            return $callback;
        }
    }
    return null;
};

$termOk = function ($taxonomy, $slug) {
    return in_array($slug, ['cursos', 'servicios'], true);
};
$request = function (array $get, $bounds = null) use ($tienda, $termOk) {
    return demo_query_request($tienda, $get, $termOk, $bounds);
};

// ---------- La definición ----------

check('la definición es de una tienda', [$tienda['post_type'], $tienda['woo'] ?? false], ['product', true]);

// ---------- Lista blanca ----------

check('categoría de WooCommerce', $request(['categoria' => 'cursos,servicios,otra'])['categoria'] ?? null, ['cursos', 'servicios']);
check('precio min y max', $request(['precio_min' => '100', 'precio_max' => '300'])['precio'] ?? null, ['min' => 100.0, 'max' => 300.0]);
check('precio no numérico no filtra', $request(['precio_min' => 'x', 'precio_max' => '1;DROP']), []);
check('orden de WooCommerce conocido', $request(['orden' => 'precio-desc'])['orden'] ?? null, 'precio-desc');
check('orden popularidad', $request(['orden' => 'popularidad'])['orden'] ?? null, 'popularidad');
check('orden de otra tienda no filtra', $request(['orden' => 'rand']), []);
check('las variables de WooCommerce no son filtros', $request(['min_price' => '10', 'max_price' => '20', 'orderby' => 'price']), []);

// ---------- Consulta ----------

$args = demo_query_args($tienda, $request(['precio_min' => '100', 'precio_max' => '300', 'categoria' => 'cursos']));
check('el precio va aparte, no como meta_query', [$args['demo_precio'] ?? null, isset($args['meta_query'])], [['min' => 100.0, 'max' => 300.0], false]);
check('la categoría va en tax_query', $args['tax_query'][0]['taxonomy'] ?? null, 'categoria_producto');

$args = demo_query_args($tienda, $request(['orden' => 'precio-desc']));
check('orden por precio lo pide a WooCommerce', $args['demo_orden_woo'] ?? null, ['orderby' => 'price', 'order' => 'DESC']);
check('orden por precio no usa orderby de WP_Query', isset($args['orderby']), false);

$args = demo_query_args($tienda, $request(['orden' => 'popularidad']));
check('orden popularidad', $args['demo_orden_woo'] ?? null, ['orderby' => 'popularity', 'order' => 'DESC']);

$args = demo_query_args($tienda, []);
check('sin orden elegido usa el primero del spec (fecha)', [$args['orderby'] ?? null, isset($args['demo_orden_woo'])], [['date' => 'DESC'], false]);

$args = demo_query_args($tienda, $request(['orden' => 'az']));
check('orden az sigue siendo de WordPress', [$args['orderby'] ?? null, isset($args['demo_orden_woo'])], [['title' => 'ASC', 'date' => 'DESC'], false]);

$activos = $request(['precio_min' => '100', 'categoria' => 'cursos']);
$args = demo_query_args($tienda, $activos, 'precio');
check('el conteo deja fuera su propio filtro (el precio)', isset($args['demo_precio']), false);
check('el conteo mantiene los demás', $args['tax_query'][0]['terms'] ?? null, ['cursos']);

check('URL del precio', demo_query_url_args($tienda, $request(['precio' => '10-20'])), ['precio_min' => '10', 'precio_max' => '20']);

// ---------- pre_get_posts ----------

$_GET = ['orden' => 'precio-desc', 'precio_min' => '100', 'precio_max' => '300'];
$preGetPosts = $hook('pre_get_posts', 20);
check('hay un pre_get_posts con prioridad 20', is_callable($preGetPosts), true);
$query = new WP_Query();
$preGetPosts($query);
check('post_type product y por página del spec', [$query->get('post_type'), $query->get('posts_per_page')], ['product', 12]);
check('el precio queda en la consulta', $query->get('demo_precio'), ['min' => 100.0, 'max' => 300.0]);
check('el orden lo calcula WooCommerce', $GLOBALS['woo_calls'], [['price', 'DESC']]);
check('orderby y order de WooCommerce en la consulta', [$query->get('orderby'), $query->get('order')], ['price', 'DESC']);

// ---------- posts_clauses del precio ----------

$clausesFilter = $hook('posts_clauses', 11);
check('hay un posts_clauses con prioridad 11', is_callable($clausesFilter), true);
$base = ['join' => '', 'where' => ' AND base', 'orderby' => ''];

$_GET = ['categoria' => 'cursos', 'min_price' => '5'];
$GLOBALS['woo_price_get'] = null;
$result = $clausesFilter($base, new WP_Query(['demo_precio' => ['min' => 100.0, 'max' => 300.0]]));
check('presenta nuestro precio a WooCommerce', $GLOBALS['woo_price_get'], ['min' => '100', 'max' => '300']);
check('usa la condición de WooCommerce', $result['where'], ' AND base AND woo-precio');
check('deja $_GET como estaba', $_GET, ['categoria' => 'cursos', 'min_price' => '5']);
check('quita el filtro que habilita el filtrado', in_array('woocommerce_enable_post_clause_filtering', $GLOBALS['removed'], true), true);

$_GET = [];
$GLOBALS['woo_price_get'] = null;
$clausesFilter($base, new WP_Query(['demo_precio' => ['min' => null, 'max' => 50.0]]));
check('solo el máximo', $GLOBALS['woo_price_get'], ['min' => null, 'max' => '50']);
check('$_GET vuelve vacío', $_GET, []);

$untouched = $clausesFilter($base, new WP_Query());
check('sin precio no toca nada', $untouched, $base);

$GLOBALS['wc_query'] = new FakeWcQueryOld();
$old = $clausesFilter($base, new WP_Query(['demo_precio' => ['min' => 100.0, 'max' => 300.0]]));
check('sin price_filter_post_clauses une la tabla de búsqueda', strpos($old['join'], 'wp_wc_product_meta_lookup wc_product_meta_lookup') !== false, true);
check('sin price_filter_post_clauses usa su propia condición', strpos($old['where'], 'NOT (300<wc_product_meta_lookup.min_price OR 100>wc_product_meta_lookup.max_price)') !== false, true);

echo json_encode(['passed' => $passed, 'failures' => $failures], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
exit($failures ? 1 : 0);
