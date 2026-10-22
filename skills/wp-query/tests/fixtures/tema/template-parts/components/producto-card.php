<?php
defined('ABSPATH') || exit;
?>
<article class="card">
    <h2><a href="<?php echo esc_url(get_permalink($args['id'])); ?>"><?php echo esc_html(get_the_title($args['id'])); ?></a></h2>
</article>
