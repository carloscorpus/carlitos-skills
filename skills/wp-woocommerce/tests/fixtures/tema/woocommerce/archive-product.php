<?php
/**
 * Tienda (maqueta del diseño).
 *
 * @version 8.6.0
 */
defined('ABSPATH') || exit;

get_header();
?>
<main>
    <h1><?php woocommerce_page_title(); ?></h1>
    <?php if (woocommerce_product_loop()) : ?>
        <ul class="grid">
            <?php while (have_posts()) : the_post(); ?>
                <?php wc_get_template_part('content', 'product'); ?>
            <?php endwhile; ?>
        </ul>
        <?php do_action('woocommerce_after_shop_loop'); ?>
    <?php else : ?>
        <?php do_action('woocommerce_no_products_found'); ?>
    <?php endif; ?>
</main>
<?php
get_footer();
