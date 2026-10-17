<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de vista: confirmación (alertdialog).
 * role => 'alertdialog' pide una decisión: no se cierra con clic fuera (sí con Esc y Cancelar).
 * El foco inicial va al botón MENOS destructivo (autofocus en Cancelar), no al de confirmar.
 *
 * Uso: get_template_part('template-parts/modals/confirmacion');
 * Disparador:
 *   <button type="button" <?php {{PREFIX}}_modal_trigger_attrs('confirmar-eliminar'); ?>>Eliminar</button>
 */
{{PREFIX}}_modal_start('confirmar-eliminar', [
    'title' => '¿Eliminar este elemento?',
    'description' => 'Esta acción no se puede deshacer.',
    'size' => 'sm',
    'role' => 'alertdialog',
]);
?>
<div class="modal__footer">
    <?php // method="dialog" cierra el modal sin JavaScript. ?>
    <form method="dialog">
        <button class="min-h-11 rounded-lg border px-5" type="submit" value="cancel" autofocus>Cancelar</button>
    </form>

    <?php // Conecta aquí la acción real: un enlace con nonce (wp_nonce_url) o un <form method="post"> propio. ?>
    <a class="inline-flex min-h-11 items-center rounded-lg bg-red-700 px-5 text-white" href="<?php echo esc_url(wp_nonce_url(home_url('/eliminar/'), 'eliminar')); ?>">Sí, eliminar</a>
</div>
<?php
{{PREFIX}}_modal_end();
