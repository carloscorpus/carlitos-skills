<?php
/*
 * IP de la visitante detrás de Cloudflare o de un proxy (skill wp-form).
 * Arma inc/forms.php desde la plantilla de la skill con un WordPress simulado (no hace falta un sitio
 * ni la base de datos) y prueba {prefijo}_form_client_ip() con distintos REMOTE_ADDR y cabeceras.
 *
 * Uso: php <skill>/tests/ip.php   (sale con 1 si algo falla)
 */

define('ABSPATH', __DIR__ . '/');
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);

$GLOBALS['wpf_filters'] = [];
function add_action(...$args) {}
function add_filter($hook, $callback)
{
    $GLOBALS['wpf_filters'][$hook][] = $callback;
}
function remove_all_filters($hook)
{
    unset($GLOBALS['wpf_filters'][$hook]);
}
function apply_filters($hook, $value, ...$args)
{
    foreach ($GLOBALS['wpf_filters'][$hook] ?? [] as $callback) {
        $value = $callback($value, ...$args);
    }
    return $value;
}
function get_theme_file_path($path = '')
{
    return __DIR__ . '/no-existe' . $path;
}
function wp_unslash($value)
{
    return is_string($value) ? stripslashes($value) : $value;
}
function sanitize_text_field($value)
{
    return trim(preg_replace('/[\r\n\t ]+/', ' ', strip_tags((string) $value)));
}

$template = file_get_contents(__DIR__ . '/../templates/inc/forms.php.tpl');
$code = strtr($template, ['{{PREFIX_UPPER}}' => 'DEMO', '{{PREFIX}}' => 'demo', '{{ENGINE_VERSION}}' => '0.0.0', '{{THEME_SLUG}}' => 'demo']);
$file = tempnam(sys_get_temp_dir(), 'wpform');
file_put_contents($file, $code);
require $file;
unlink($file);

$passed = 0;
$failed = 0;
function check($name, $got, $want)
{
    global $passed, $failed;
    if ($got === $want) {
        $passed++;
        echo "ok   $name\n";
    } else {
        $failed++;
        echo "FAIL $name\n     esperado: " . var_export($want, true) . "\n     obtenido: " . var_export($got, true) . "\n";
    }
}
// Un pedido con REMOTE_ADDR y cabeceras; devuelve la IP que usa el motor.
function ip($remote, array $headers = [])
{
    $_SERVER = array_filter(['REMOTE_ADDR' => $remote], 'is_string');
    foreach ($headers as $name => $value) {
        $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $name))] = $value;
    }
    return demo_form_client_ip();
}

// ---------- CIDR ----------
check('CIDR IPv4 dentro', demo_form_ip_in('172.71.10.5', ['172.64.0.0/13']), true);
check('CIDR IPv4 fuera', demo_form_ip_in('172.72.0.1', ['172.64.0.0/13']), false);
check('CIDR IPv4 borde', demo_form_ip_in('103.21.247.255', ['103.21.244.0/22']), true);
check('CIDR IPv4 /0', demo_form_ip_in('8.8.8.8', ['0.0.0.0/0']), true);
check('CIDR IP sola (sin /)', demo_form_ip_in('10.0.0.2', ['10.0.0.2']), true);
check('CIDR IPv6 dentro con bits sueltos (/29)', demo_form_ip_in('2a06:98c7:ffff::1', ['2a06:98c0::/29']), true);
check('CIDR IPv6 fuera con bits sueltos (/29)', demo_form_ip_in('2a06:98c8::1', ['2a06:98c0::/29']), false);
check('CIDR IPv4 contra un rango IPv6 no coincide', demo_form_ip_in('10.0.0.1', ['::/0']), false);
check('CIDR rango mal escrito no coincide', demo_form_ip_in('10.0.0.1', ['10.0.0.0/33', 'basura/8', '10.0.0.0/x']), false);
check('CIDR IP inválida no coincide', demo_form_ip_in('999.1.1.1', ['0.0.0.0/0']), false);
check('IPv4 escrita como IPv6 se pasa a IPv4', demo_form_ip('::ffff:1.2.3.4'), '1.2.3.4');

// Los rangos privados y reservados son los que rechaza filter_var con NO_PRIV_RANGE | NO_RES_RANGE.
$flags = FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE;
$distintas = [];
foreach (['0.1.2.3', '10.9.8.7', '100.64.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '172.31.255.255', '172.32.0.1', '192.168.1.1', '192.0.2.1', '224.0.0.1', '240.0.0.1', '255.255.255.255', '8.8.8.8', '::', '::1', 'fc00::1', 'fd12::1', 'fe80::1', 'febf::1', 'fec0::1', '2001:db8::1', '2001:4860::1'] as $sample) {
    $esPrivada = filter_var($sample, FILTER_VALIDATE_IP, $flags) === false;
    $esCloudflare = demo_form_ip_in($sample, demo_form_cloudflare_ips());
    if (demo_form_ip_in($sample, demo_form_default_proxies()) !== ($esPrivada || $esCloudflare)) {
        $distintas[] = $sample;
    }
}
check('privadas y reservadas = las que rechaza filter_var', $distintas, []);

// ---------- Sin proxy: las cabeceras no cuentan ----------
check('REMOTE_ADDR público con cabeceras falsas: usa REMOTE_ADDR', ip('8.8.8.8', ['CF-Connecting-IP' => '1.1.1.1', 'X-Forwarded-For' => '1.1.1.1, 2.2.2.2']), '8.8.8.8');
check('REMOTE_ADDR IPv6 público con cabeceras falsas: usa REMOTE_ADDR', ip('2001:4860::8888', ['CF-Connecting-IP' => '1.1.1.1', 'X-Forwarded-For' => '1.1.1.1']), '2001:4860::8888');
check('REMOTE_ADDR público como ::ffff: no se toma por proxy', ip('::ffff:8.8.8.8', ['X-Forwarded-For' => '1.1.1.1']), '8.8.8.8');
check('sin REMOTE_ADDR', ip(null, ['X-Forwarded-For' => '1.1.1.1']), '');
check('REMOTE_ADDR inválido', ip('no-es-ip', ['X-Forwarded-For' => '1.1.1.1']), '');

// ---------- Cloudflare ----------
check('Cloudflare + CF-Connecting-IP válido: usa CF-Connecting-IP', ip('172.70.1.1', ['CF-Connecting-IP' => '190.12.34.56']), '190.12.34.56');
check('Cloudflare + CF-Connecting-IP IPv6', ip('162.158.0.9', ['CF-Connecting-IP' => '2800:200::1']), '2800:200::1');
check('Cloudflare + CF-Connecting-IP inválido: REMOTE_ADDR', ip('172.70.1.1', ['CF-Connecting-IP' => 'basura']), '172.70.1.1');
check('Cloudflare sin CF-Connecting-IP: X-Forwarded-For', ip('172.70.1.1', ['X-Forwarded-For' => '190.12.34.56']), '190.12.34.56');
check('Cloudflare IPv6 dentro del rango: usa CF-Connecting-IP', ip('2606:4700:10::ac43:1', ['CF-Connecting-IP' => '190.12.34.56']), '190.12.34.56');
check('IPv6 fuera de los rangos de Cloudflare: REMOTE_ADDR', ip('2606:4800::1', ['CF-Connecting-IP' => '190.12.34.56', 'X-Forwarded-For' => '190.12.34.56']), '2606:4800::1');
check('proxy privado no acepta CF-Connecting-IP (solo Cloudflare)', ip('10.0.0.5', ['CF-Connecting-IP' => '190.12.34.56']), '10.0.0.5');

// ---------- Proxy del hosting (X-Forwarded-For) ----------
check('127.0.0.1 + XFF: de derecha a izquierda', ip('127.0.0.1', ['X-Forwarded-For' => '1.2.3.4, 5.6.7.8']), '5.6.7.8');
check('10.x + XFF: de derecha a izquierda', ip('10.1.2.3', ['X-Forwarded-For' => '1.2.3.4, 5.6.7.8']), '5.6.7.8');
check('XFF salta los proxies de confianza', ip('10.0.0.1', ['X-Forwarded-For' => 'falsa, 5.6.7.8, 10.0.0.2']), '5.6.7.8');
check('XFF salta Cloudflare y privadas', ip('10.0.0.1', ['X-Forwarded-For' => '5.6.7.8, 172.70.1.1, 192.168.0.9']), '5.6.7.8');
check('XFF IPv6 detrás de un proxy IPv6 local', ip('::1', ['X-Forwarded-For' => '2800:200::1']), '2800:200::1');
check('XFF con basura: REMOTE_ADDR', ip('10.0.0.1', ['X-Forwarded-For' => 'basura']), '10.0.0.1');
check('XFF con basura a la derecha: REMOTE_ADDR (no se salta)', ip('10.0.0.1', ['X-Forwarded-For' => '5.6.7.8, basura']), '10.0.0.1');
check('XFF vacío: REMOTE_ADDR', ip('10.0.0.1', ['X-Forwarded-For' => '']), '10.0.0.1');
check('XFF solo con comas: REMOTE_ADDR', ip('10.0.0.1', ['X-Forwarded-For' => ' , ,']), '10.0.0.1');
check('XFF todas de confianza: REMOTE_ADDR', ip('10.0.0.1', ['X-Forwarded-For' => '192.168.0.2, 10.0.0.3']), '10.0.0.1');
check('XFF con IP y puerto: REMOTE_ADDR', ip('10.0.0.1', ['X-Forwarded-For' => '5.6.7.8:443']), '10.0.0.1');

// ---------- Filtros ----------
add_filter('demo_form_trusted_proxies', function ($ranges) {
    return array_values(array_diff($ranges, ['10.0.0.0/8']));
});
check('trusted_proxies quita un rango: 10.x ya no es proxy', ip('10.0.0.1', ['X-Forwarded-For' => '5.6.7.8']), '10.0.0.1');
remove_all_filters('demo_form_trusted_proxies');
add_filter('demo_form_trusted_proxies', function ($ranges) {
    return array_merge($ranges, ['203.0.113.0/24']);
});
check('trusted_proxies agrega un rango: proxy propio', ip('203.0.113.7', ['X-Forwarded-For' => '5.6.7.8, 203.0.113.8']), '5.6.7.8');
remove_all_filters('demo_form_trusted_proxies');
check('sin el filtro el rango agregado no es proxy', ip('203.0.113.7', ['X-Forwarded-For' => '5.6.7.8']), '203.0.113.7');

add_filter('demo_form_client_ip', function ($ip) {
    return $ip === '5.6.7.8' ? '9.9.9.9' : $ip;
});
check('el filtro client_ip recibe la IP resuelta y la cambia', ip('10.0.0.1', ['X-Forwarded-For' => '5.6.7.8']), '9.9.9.9');
remove_all_filters('demo_form_client_ip');
add_filter('demo_form_client_ip', function () {
    return 'no-es-ip';
});
check('el filtro client_ip con un valor inválido: vacío', ip('8.8.8.8'), '');
remove_all_filters('demo_form_client_ip');

// ---------- Constante apagada (al final: una constante no se puede borrar) ----------
define('DEMO_FORM_TRUST_PROXIES', false);
check('constante apagada: Cloudflare usa REMOTE_ADDR', ip('172.70.1.1', ['CF-Connecting-IP' => '190.12.34.56']), '172.70.1.1');
check('constante apagada: proxy privado usa REMOTE_ADDR', ip('127.0.0.1', ['X-Forwarded-For' => '1.2.3.4, 5.6.7.8']), '127.0.0.1');
add_filter('demo_form_client_ip', function () {
    return '4.4.4.4';
});
check('constante apagada: el filtro client_ip sigue funcionando', ip('127.0.0.1'), '4.4.4.4');

echo "\n$passed pasaron, $failed fallaron.\n";
exit($failed ? 1 : 0);
