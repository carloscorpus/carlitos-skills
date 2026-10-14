<?php
/*
 * Paridad front/back, lado PHP (skill wp-form).
 * Valida tests/cases.json con el motor del tema y escribe el resultado en JSON,
 * junto con las reglas normalizadas que recibe el JS. check.mjs compara ambos lados.
 *
 * Uso (desde cualquier carpeta; el tema con wp-form debe estar activo):
 *   php <skill>/tests/check.php <ruta a wp-load.php> <prefijo> > forms-php.json
 */

if ($argc < 3) {
    fwrite(STDERR, "Uso: php check.php <wp-load.php> <prefijo>\n");
    exit(1);
}

[$_, $wp_load, $prefix] = $argv;
if (!preg_match('/^[a-z][a-z0-9_]*$/', $prefix)) {
    fwrite(STDERR, "Prefijo inválido.\n");
    exit(1);
}

require $wp_load;

$normalize = $prefix . '_normalize_field';
$validate = $prefix . '_validate_field';
if (!function_exists($normalize) || !function_exists($validate)) {
    fwrite(STDERR, "No se encontró el motor de forms con el prefijo \"$prefix\". ¿El tema está activo y carga inc/forms.php?\n");
    exit(1);
}

$spec = json_decode(file_get_contents(__DIR__ . '/cases.json'), true);
$rules = [];
$fields = [];

foreach ($spec['fields'] as $key => $definition) {
    $field = $normalize($definition);
    $fields[$key] = $field;

    $rules[$key] = call_user_func($prefix . '_field_rule', $field);
}

$results = [];
foreach ($spec['cases'] as $i => $case) {
    $value = isset($case['repeat']) ? str_repeat($case['repeat'][0], $case['repeat'][1]) : $case['value'];
    // Un checkbox llega al servidor como '1' o vacío.
    $raw = is_bool($value) ? ($value ? '1' : '') : $value;
    [, $error] = $validate($fields[$case['field']], $raw);
    $results[$i] = $error;
}

echo json_encode(['rules' => $rules, 'results' => $results], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
