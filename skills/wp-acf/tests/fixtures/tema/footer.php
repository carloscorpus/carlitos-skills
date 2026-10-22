<?php
defined('ABSPATH') || exit;

$pie = get_field('opciones_pie', 'option') ?: [];
?>
<footer>
    <p><?= esc_html($pie['copyright'] ?? '') ?></p>
</footer>
