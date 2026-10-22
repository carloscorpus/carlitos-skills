<?php
defined('ABSPATH') || exit;

get_header();
$total = demo_query_total();
?>
<main class="container">
    <h1><?php echo esc_html((string) get_field('productos_catalogo_titulo', 'option')); ?></h1>

    <form method="get" action="<?php echo esc_url(demo_query_reset_url()); ?>" data-query="filtros">
        <?php foreach (demo_query_filters() as $filtro) : ?>
            <?php if ($filtro['tipo'] === 'taxonomia' || $filtro['tipo'] === 'opciones') : ?>
                <fieldset>
                    <legend><?php echo esc_html($filtro['etiqueta']); ?></legend>
                    <?php foreach ($filtro['opciones'] as $opcion) : ?>
                        <label>
                            <input type="checkbox" name="<?php echo esc_attr($filtro['name']); ?>" value="<?php echo esc_attr($opcion['valor']); ?>" <?php checked($opcion['marcada']); ?> <?php disabled($opcion['desactivada']); ?>>
                            <?php echo esc_html($opcion['etiqueta']); ?>
                            <?php if ($opcion['conteo'] !== null) : ?>(<?php echo esc_html((string) $opcion['conteo']); ?>)<?php endif; ?>
                        </label>
                    <?php endforeach; ?>
                </fieldset>
            <?php elseif ($filtro['tipo'] === 'rango') : ?>
                <input type="number" name="precio_min" value="<?php echo esc_attr((string) $filtro['valor']['min']); ?>" min="<?php echo esc_attr((string) $filtro['min']); ?>">
                <input type="number" name="precio_max" value="<?php echo esc_attr((string) $filtro['valor']['max']); ?>" max="<?php echo esc_attr((string) $filtro['max']); ?>">
            <?php endif; ?>
        <?php endforeach; ?>
        <input type="search" name="q" value="<?php echo esc_attr((string) get_query_var('s')); ?>">
        <select name="orden">
            <option value="reciente">Más recientes</option>
        </select>
        <button type="submit">Aplicar</button>
    </form>

    <p data-query="total" aria-live="polite"><?php echo esc_html($total['texto']); ?></p>

    <div data-query="resultados">
        <?php if (have_posts()) : ?>
            <?php while (have_posts()) : the_post(); ?>
                <?php get_template_part('template-parts/components/producto-card', null, ['id' => get_the_ID()]); ?>
            <?php endwhile; ?>
        <?php else : ?>
            <p>No hay productos con estos filtros.</p>
        <?php endif; ?>
    </div>

    <div data-query="paginacion"><?php demo_query_pagination(); ?></div>
</main>
<?php
get_footer();
