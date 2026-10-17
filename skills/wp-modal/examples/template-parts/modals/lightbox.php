<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de vista: lightbox (imagen o video grande).
 * El título sigue presente para los lectores de pantalla (title_visible => false lo oculta a la vista).
 * Un lightbox por imagen: el contenido se imprime en la página, así sigue indexable, y la imagen
 * (loading="lazy") no se descarga hasta que se abre. Para una galería grande, un solo modal con
 * JavaScript propio que cambie la imagen es otro diseño: pídelo aparte.
 *
 * Uso: get_template_part('template-parts/modals/lightbox');
 * Disparador (un enlace a la imagen sirve de respaldo sin JavaScript):
 *   <a href="<?php echo esc_url($url_imagen_grande); ?>" <?php {{PREFIX}}_modal_trigger_attrs('foto-1', ['link' => true]); ?>>
 *       <img src="..." alt="..." loading="lazy">
 *   </a>
 */
{{PREFIX}}_modal_start('foto-1', [
    'title' => 'Fachada del local',
    'title_visible' => false,
    'size' => 'full',
    'class' => 'bg-black text-white',
]);
?>
<figure class="m-0 grid h-full place-items-center gap-3">
    <img class="max-h-[80dvh] w-auto max-w-full object-contain" src="<?php echo esc_url(get_theme_file_uri('/assets/img/foto-1.jpg')); ?>" alt="Fachada del local con el letrero iluminado" width="1600" height="1067" loading="lazy" decoding="async">
    <figcaption class="text-sm">Fachada del local, 2026.</figcaption>
</figure>
<?php
{{PREFIX}}_modal_end();
