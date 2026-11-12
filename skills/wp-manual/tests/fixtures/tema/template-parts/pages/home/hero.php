<?php
$hero = get_field('home_hero') ?: [];
$descripcion = $hero['descripcion'] ?? '';
?>
<section id="hero"><h1><?= esc_html($hero['titulo'] ?? '') ?></h1><p><?= demo_highlight($descripcion) ?></p></section>
