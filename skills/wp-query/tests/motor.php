<?php
/*
 * Prueba del motor de wp-query sin WordPress: carga inc/query/motor.php con funciones de WP simuladas y revisa
 * la lectura del pedido (lista blanca) y el armado de la consulta. Sin dependencias.
 *
 * Uso: php motor.php <motor.php instalado> <definición inc/query/producto.php> <definición inc/query/post.php>
 * Imprime JSON { passed, failures } y sale con 1 si algo falla. La corre tests/check.mjs.
 */

define('ABSPATH', __DIR__ . '/');
define('HOUR_IN_SECONDS', 3600);

function add_action(...$args) {}
function add_filter(...$args) {}
function get_theme_file_path($path = '') { return sys_get_temp_dir() . '/wp-query-sin-definiciones/' . ltrim($path, '/'); }
function wp_unslash($value) { return is_string($value) ? stripslashes($value) : $value; }
function sanitize_text_field($value) { return trim(preg_replace('/[\r\n\t ]+/', ' ', strip_tags((string) $value))); }

[, $motorFile, $productoFile, $postFile] = $argv;
require $motorFile;
$producto = require $productoFile;
$post = require $postFile;

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

$terms = ['categoria_producto' => ['sillas', 'mesas'], 'category' => ['noticias']];
$termOk = function ($taxonomy, $slug) use ($terms) {
    return in_array($slug, $terms[$taxonomy] ?? [], true);
};
$request = function (array $def, array $get, $bounds = null) use ($termOk) {
    return demo_query_request($def, $get, $termOk, $bounds);
};

// ---------- Lista blanca ----------

check('sin parámetros no hay filtros activos', $request($producto, []), []);
check('ignora parámetros que no son filtros', $request($producto, ['s' => 'x', 'p' => '3', 'foo' => 'bar']), []);
check('taxonomía con coma', $request($producto, ['categoria' => 'sillas,mesas'])['categoria'] ?? null, ['sillas', 'mesas']);
check('taxonomía con []', $request($producto, ['categoria' => ['sillas', 'mesas', 'sillas']])['categoria'] ?? null, ['sillas', 'mesas']);
check('taxonomía descarta términos que no existen', $request($producto, ['categoria' => 'sillas,<b>x</b>,sofas'])['categoria'] ?? null, ['sillas']);
check('taxonomía sin términos válidos no filtra', array_key_exists('categoria', $request($producto, ['categoria' => 'sofas'])), false);
check('taxonomía de un solo valor se queda con el primero', $request($post, ['tema' => 'noticias,otra'])['tema'] ?? null, ['noticias']);
check('opciones solo claves conocidas', $request($producto, ['material' => 'madera,plastico,metal'])['material'] ?? null, ['madera', 'metal']);
check('checkbox con clave de acento', $request($producto, ['colores' => 'cafe_claro'])['colores'] ?? null, ['cafe_claro']);
check('true_false solo acepta 1', $request($producto, ['destacado' => 'si']), []);
check('true_false con 1', $request($producto, ['destacado' => '1'])['destacado'] ?? null, ['1']);
check('rango min y max', $request($producto, ['precio_min' => '100', 'precio_max' => '300'])['precio'] ?? null, ['min' => 100.0, 'max' => 300.0]);
check('rango invertido se ordena', $request($producto, ['precio_min' => '300', 'precio_max' => '100'])['precio'] ?? null, ['min' => 100.0, 'max' => 300.0]);
check('rango en un solo parámetro', $request($producto, ['precio' => '50-80'])['precio'] ?? null, ['min' => 50.0, 'max' => 80.0]);
check('rango no numérico no filtra', $request($producto, ['precio_min' => 'abc', 'precio_max' => '1;DROP']), []);
$bounds = function () { return ['min' => 20.0, 'max' => 500.0]; };
check('rango igual a los límites no filtra', $request($producto, ['precio_min' => '0', 'precio_max' => '900'], $bounds), []);
check('rango se limita a los reales', $request($producto, ['precio_min' => '50', 'precio_max' => '900'], $bounds)['precio'] ?? null, ['min' => 50.0, 'max' => null]);
check('fecha por año', $request($post, ['anio' => '2024'])['anio'] ?? null, ['anio' => 2024, 'mes' => null]);
check('fecha por año y mes', $request($post, ['anio' => '2024-05'])['anio'] ?? null, ['anio' => 2024, 'mes' => 5]);
check('fecha inválida no filtra', $request($post, ['anio' => '2024-13']), []);
check('fecha desde/hasta', $request($post, ['anio_desde' => '2024-02-30', 'anio_hasta' => '2024-03-10'])['anio'] ?? null, ['desde' => null, 'hasta' => '2024-03-10']);
check('búsqueda limpia y corta', strlen($request($producto, ['q' => '  <script>x</script>' . str_repeat('a', 300)])['q'] ?? ''), 100);
check('búsqueda vacía no filtra', $request($producto, ['q' => '   ']), []);
check('orden conocido', $request($producto, ['orden' => 'precio-desc'])['orden'] ?? null, 'precio-desc');
check('orden desconocido no filtra', $request($producto, ['orden' => 'rand']), []);

// ---------- Consulta ----------

$args = demo_query_args($producto, $request($producto, ['categoria' => 'sillas,mesas', 'material' => 'madera', 'precio_min' => '100', 'precio_max' => '300']));
check('taxonomía con O', $args['tax_query'][0]['operator'] ?? null, 'IN');
check('taxonomía por slug', $args['tax_query'][0]['terms'] ?? null, ['sillas', 'mesas']);
check('select con un valor usa =', $args['meta_query'][1], ['key' => 'producto_ficha_material', 'value' => 'madera', 'compare' => '=']);
check('rango usa BETWEEN', $args['meta_query'][0]['compare'] ?? null, 'BETWEEN');
check('filtros distintos con Y', $args['meta_query']['relation'] ?? null, 'AND');

$args = demo_query_args($producto, $request($producto, ['material' => 'madera,metal']));
check('select con "sí (y)" y dos valores no da resultados', $args['post__in'] ?? null, [0]);

$args = demo_query_args($producto, $request($producto, ['colores' => 'negro,blanco']));
check('checkbox usa LIKE con comillas', $args['meta_query'][0][0], ['key' => 'producto_ficha_colores', 'value' => '"negro"', 'compare' => 'LIKE']);
check('checkbox con "sí (o)" une con OR', $args['meta_query'][0]['relation'] ?? null, 'OR');

$args = demo_query_args($producto, $request($producto, ['destacado' => '1']));
check('true_false = 1', $args['meta_query'][0], ['key' => 'producto_ficha_destacado', 'value' => '1', 'compare' => '=']);

$args = demo_query_args($producto, $request($producto, ['orden' => 'precio-asc']));
check('orden por campo con cláusula con nombre', array_keys($args['orderby']), ['orden_valor', 'date']);
check('orden por campo no excluye los que no lo tienen', $args['meta_query']['orden_campo']['relation'] ?? null, 'OR');

$args = demo_query_args($producto, []);
check('sin orden elegido usa el primero del spec', $args['orderby'] ?? null, ['date' => 'DESC']);

$args = demo_query_args($producto, $request($producto, ['q' => 'silla', 'orden' => 'az']));
check('búsqueda va en s', $args['s'] ?? null, 'silla');
check('orden az', $args['orderby'] ?? null, ['title' => 'ASC', 'date' => 'DESC']);

$args = demo_query_args($post, $request($post, ['anio' => '2024-02']));
check('fecha por mes en date_query', $args['date_query'][0] ?? null, ['inclusive' => true, 'after' => '2024-02-01', 'before' => '2024-02-29 23:59:59']);

$activos = $request($producto, ['categoria' => 'sillas', 'material' => 'madera']);
$args = demo_query_args($producto, $activos, 'categoria');
check('conteo dinámico deja fuera su propio filtro', isset($args['tax_query']), false);
check('conteo dinámico mantiene los demás', $args['meta_query'][0]['key'] ?? null, 'producto_ficha_material');

check('URL con varios valores separados por coma', demo_query_url_args($producto, $activos), ['categoria' => 'sillas', 'material' => 'madera']);
check('URL de rango', demo_query_url_args($producto, $request($producto, ['precio' => '10-20'])), ['precio_min' => '10', 'precio_max' => '20']);

// ---------- Zonas de la respuesta parcial ----------

$html = '<html><body><header><div class="x">menú</div></header>'
    . '<form method="get" data-query="filtros" class="f"><div><div>a</div></div><input name="q"></form>'
    . "<section class='grid' data-query='resultados'><div><article>1</article></div><div><article>2</article></div></section>"
    . '<div data-query="paginacion"><nav aria-label="Paginación"><a href="/p/2/" data-query-mas>Más</a></nav></div>'
    . '<p data-query="total">2 resultados</p><p data-query="total">otra</p></body></html>';
$zones = demo_query_zones($html);
check('zonas encontradas', array_keys($zones), ['filtros', 'resultados', 'paginacion', 'total']);
check('zona con etiquetas iguales anidadas', $zones['filtros'], '<form method="get" data-query="filtros" class="f"><div><div>a</div></div><input name="q"></form>');
check('zona con comillas simples', $zones['resultados'], "<section class='grid' data-query='resultados'><div><article>1</article></div><div><article>2</article></div></section>");
check('zona div con divs dentro', $zones['paginacion'], '<div data-query="paginacion"><nav aria-label="Paginación"><a href="/p/2/" data-query-mas>Más</a></nav></div>');
check('una zona repetida se toma la primera', $zones['total'], '<p data-query="total">2 resultados</p>');
check('data-query-mas no es una zona', isset($zones['mas']), false);
check('sin zonas', demo_query_zones('<div>nada</div>'), []);

echo json_encode(['passed' => $passed, 'failures' => $failures], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
exit($failures ? 1 : 0);
