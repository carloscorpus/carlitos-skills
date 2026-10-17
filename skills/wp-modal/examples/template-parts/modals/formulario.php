<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de vista: un formulario de wp-form dentro de un modal (requiere la skill wp-form).
 * El motor de formularios se conecta por <form data-form>, esté o no el modal abierto, así que
 * no hace falta nada más. Reglas:
 *   - El botón de cerrar del modal es un <form method="dialog"> en el encabezado, hermano del
 *     cuerpo: nunca metas el modal dentro de otro <form> (los <form> no se anidan).
 *   - El estado del envío (éxito/error) lo muestra el propio formulario, en texto. Con 'redirect'
 *     en la definición del form, la página de gracias reemplaza el modal.
 *
 * Uso: get_template_part('template-parts/modals/formulario');
 * Disparador:
 *   <button type="button" <?php {{PREFIX}}_modal_trigger_attrs('contacto-modal'); ?>>Escríbenos</button>
 */
{{PREFIX}}_modal_start('contacto-modal', [
    'title' => 'Escríbenos',
    'description' => 'Te respondemos en menos de un día hábil.',
    'size' => 'md',
]);

get_template_part('template-parts/forms/contacto');

{{PREFIX}}_modal_end();
