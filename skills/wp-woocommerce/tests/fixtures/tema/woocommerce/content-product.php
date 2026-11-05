<?php
/**
 * Tarjeta de producto (maqueta del diseño).
 *
 * @version 9.4.0
 */
defined('ABSPATH') || exit;

global $product;
?>
<li <?php wc_product_class('card', $product); ?>>
    <a href="<?php echo esc_url(get_permalink()); ?>">
        <!-- woo: imagen -->
        <h2><?php echo esc_html(get_the_title()); ?></h2>
        <!-- woo: precio -->
    </a>
    <?php // woo: boton ?>
</li>
