<?php
$hero = get_field('home_hero') ?: [];
$descripcion = $hero['descripcion'] ?? '';
?>
<section><h1><?= esc_html($hero['titulo'] ?? '') ?></h1><p><?= demo_highlight($descripcion) ?></p></section>
