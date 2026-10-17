<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de vista: panel lateral (drawer) que se abre bajo demanda.
 * Antes de usarlo, decide el tipo (references/panel-type.md):
 *   - Con fondo oscurecido, para actuar sobre él: modal (este ejemplo).
 *   - La página debe seguir usable mientras está abierto (filtros junto a los resultados):
 *     'mode' => 'non-modal' aquí y ['mode' => 'non-modal'] en el disparador.
 *   - Contenido siempre visible: no es un modal; usa un <aside>.
 *
 * Uso: get_template_part('template-parts/modals/drawer');
 * Disparador:
 *   <button type="button" <?php {{PREFIX}}_modal_trigger_attrs('menu-movil'); ?>>Menú</button>
 */
{{PREFIX}}_modal_start('menu-movil', [
    'title' => 'Menú',
    'placement' => 'right',
    // 'mode' => 'non-modal',
]);
?>
<?php
// Si el menú ya existe en el header, imprime el mismo wp_nav_menu() aquí; no dupliques los enlaces a mano.
wp_nav_menu([
    'theme_location' => 'primary',
    'container' => 'nav',
    'container_aria_label' => 'Menú principal',
    'menu_class' => 'm-0 flex list-none flex-col gap-1 p-0',
    'fallback_cb' => false,
]);
{{PREFIX}}_modal_end();
