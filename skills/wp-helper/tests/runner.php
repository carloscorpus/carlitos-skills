<?php
// Corre los helpers instalados en un tema con las funciones de WordPress simuladas.
// Uso (lo llama check.mjs): php runner.php <carpeta del tema> <entrada.json>
// Imprime un JSON con una salida por cada ítem de la entrada.

require __DIR__ . '/stubs.php';

[, $theme, $inputFile] = $argv;
$job = json_decode(file_get_contents($inputFile), true);

$GLOBALS['wph_theme'] = rtrim($theme, '/\\');
foreach ($job['attachments'] as $id => $a) {
    $GLOBALS['wph_attachments'][(string) $id] = $a;
}

$_SERVER['REQUEST_URI'] = '/contacto/';

foreach (['images', 'text', 'links'] as $helper) {
    if (is_file($theme . '/inc/helpers/' . $helper . '.php')) {
        require $theme . '/inc/helpers/' . $helper . '.php';
    }
}

// El prefijo sale del nombre de la carpeta del tema, igual que en install.mjs.
$prefix = str_replace('-', '_', basename(rtrim($theme, '/\\')));
$out = [];
foreach ($job['items'] as $item) {
    $input = $item['input'];
    if (is_array($input) && isset($input['__post'])) {
        $post = new WP_Post();
        $post->ID = $input['__post']['ID'];
        $post->post_type = $input['__post']['post_type'];
        $input = $post;
    }
    switch ($item['kind']) {
        case 'data':
            $out[] = ($prefix . '_image_data')($input, $item['size'] ?? 'full');
            break;
        case 'image':
            $out[] = ($prefix . '_image')($input, $item['args'] ?? []);
            break;
        case 'link_data':
            $out[] = ($prefix . '_link_data')($input);
            break;
        case 'link_attrs':
            $out[] = ($prefix . '_link_attrs')($input, $item['args'] ?? []);
            break;
        case 'link':
            $out[] = ($prefix . '_link')($input, $item['args'] ?? []);
            break;
        case 'text':
            $out[] = ($prefix . '_highlight')($input, $item['only'] ?? null);
            break;
    }
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
