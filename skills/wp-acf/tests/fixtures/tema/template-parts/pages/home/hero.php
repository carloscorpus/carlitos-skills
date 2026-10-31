<?php
defined('ABSPATH') || exit;

$hero = get_field('home_hero') ?: [];
?>
<section>
    <h1><?= esc_html($hero['titulo'] ?? '') ?></h1>
    <?= copam_theme_link($hero['boton'] ?? null) ?>
    <?php $slides = (array) ($hero['slides'] ?? []); ?>
    <?php foreach ($slides as $i => $slide) : ?>
        <?= copam_theme_image($slide['imagen'] ?? null, [
            'alt' => ($slide['alt'] ?? '') ?: null,
            'alt_fallback' => ($hero['titulo'] ?? '') . ', ' . sprintf(__('foto %d de %d', 'copam-theme'), $i + 1, count($slides)),
        ]) ?>
    <?php endforeach; ?>
</section>
