<?php
defined('ABSPATH') || exit;

$hero = get_field('home_hero') ?: [];
?>
<section>
    <h1><?= esc_html($hero['titulo'] ?? '') ?></h1>
    <?= copam_theme_link($hero['boton'] ?? null) ?>
    <?php foreach ((array) ($hero['slides'] ?? []) as $slide) : ?>
        <?= copam_theme_image($slide['imagen'] ?? null, ['alt' => $slide['alt'] ?? '']) ?>
    <?php endforeach; ?>
</section>
