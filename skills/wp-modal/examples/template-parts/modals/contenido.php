<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de vista: modal de contenido / promoción.
 * Los valores y las clases son de ejemplo: en cada proyecto salen de Figma y de los tokens del
 * @theme (references/figma-mapping.md). Lo que no cambia es la estructura:
 * {{PREFIX}}_modal_start() / {{PREFIX}}_modal_end() imprimen el <dialog>, el título, el botón de
 * cerrar y la zona con scroll. El contenido de en medio es libre.
 *
 *   width    el ancho exacto del frame de Figma. `size` (sm/md/lg/xl) es solo un respaldo para
 *            cuando no hay diseño: con diseño, no lo uses.
 *   mobile   cómo se ve en el frame móvil: 'center' | 'sheet' | 'fullscreen'.
 *   *_class  clases del diseño para cada parte. Lo común a varios modales (radio, relleno, fondo
 *            oscuro, estilo del título) va una vez al CSS del proyecto como variables --modal-*.
 *
 * Uso: get_template_part('template-parts/modals/contenido');
 * Disparador (en cualquier parte de la página):
 *   <button type="button" <?php {{PREFIX}}_modal_trigger_attrs('promo'); ?>>Ver la promoción</button>
 */
{{PREFIX}}_modal_start('promo', [
    'title' => 'Título de la promoción',
    'width' => '45rem',
    'mobile' => 'sheet',
    'title_class' => 'text-2xl font-bold',
    'body_class' => 'pt-4',
]);
?>
<div class="grid gap-6 md:grid-cols-2 md:items-center">
    <?php // Describe la imagen en alt si aporta información; si es decorativa, alt="". loading="lazy": no se descarga hasta que se abre. ?>
    <img class="h-auto w-full rounded-lg" src="<?php echo esc_url(get_theme_file_uri('/assets/img/promo.jpg')); ?>" alt="Descripción de la imagen" width="640" height="480" loading="lazy" decoding="async">

    <div class="space-y-4">
        <p>Texto de la promoción: qué incluye, hasta cuándo y para quién.</p>
        <a class="inline-flex min-h-11 items-center rounded-lg bg-black px-5 text-white" href="<?php echo esc_url(home_url('/contacto/')); ?>">Quiero la promoción</a>
    </div>
</div>
<?php
{{PREFIX}}_modal_end();
