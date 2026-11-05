<?php
/*
 * Página con contenido (carrito, checkout y "Mi cuenta" de WooCommerce son páginas de WordPress con su contenido
 * adentro: el shortcode o los bloques). Creada por wp-woocommerce porque el tema no tenía page.php ni singular.php
 * y index.php no imprime el contenido. Desde ahora es del proyecto: ajusta su marcado al diseño.
 */
defined('ABSPATH') || exit;

get_header();
?>
<main id="main-content" class="mx-auto max-w-[1200px] px-6 py-16">
    <?php while (have_posts()) : the_post(); ?>
        <h1><?= esc_html(get_the_title()) ?></h1>
        <?php the_content(); ?>
    <?php endwhile; ?>
</main>
<?php
get_footer();
