<?php
defined('ABSPATH') || exit;

get_header();
?>
<main class="container">
    <h1>Blog</h1>

    <form method="get" data-query="filtros">
        <select name="tema"><option value="">Todos los temas</option></select>
        <select name="anio"><option value="">Todos los años</option></select>
        <input type="search" name="q">
        <button type="submit">Aplicar</button>
    </form>

    <div data-query="resultados">
        <?php while (have_posts()) : the_post(); ?>
            <article><h2><?php the_title(); ?></h2></article>
        <?php endwhile; ?>
    </div>

    <div data-query="paginacion"><?php demo_query_pagination(); ?></div>
</main>
<?php
get_footer();
