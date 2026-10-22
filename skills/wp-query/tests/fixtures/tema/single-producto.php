<?php
defined('ABSPATH') || exit;

get_header();
the_post();
?>
<main class="container">
    <h1><?php the_title(); ?></h1>
</main>
<?php
get_footer();
