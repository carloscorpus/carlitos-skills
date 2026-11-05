<?php
/**
 * Ficha de producto (maqueta del diseño).
 *
 * @version 1.6.4
 */
defined('ABSPATH') || exit;

get_header();
?>
<main>
    <?php while (have_posts()) : the_post(); ?>
        <h1><?php echo esc_html(get_the_title()); ?></h1>
        <?php // woo: precio ?>
        <?php // woo: boton ?>
    <?php endwhile; ?>
</main>
<?php
get_footer();
