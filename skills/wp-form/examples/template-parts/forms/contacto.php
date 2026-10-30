<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de vista: form de contacto.
 * Las clases son de ejemplo: en cada proyecto salen de Figma y de los tokens del @theme.
 * Lo que no cambia es el contrato: los helpers de atributos, data-error-for, el honeypot,
 * data-form-status, el botón con data-submit-label, la leyenda de obligatorios y
 * fieldset + legend para los radios y los checkboxes de varias opciones.
 * Uso: get_template_part('template-parts/forms/contacto');
 */
$form_id = 'contacto';
$input_class = 'w-full min-h-11 bg-white py-2 px-3 border border-[#E0E0E0] rounded-lg text-base focus:outline focus:outline-anaranjado aria-invalid:border-anaranjado';
$privacy_url = get_privacy_policy_url();
// Canal alternativo si el navegador no tiene JavaScript: el que indique el cliente (correo o teléfono).
$fallback_email = 'hola@ejemplo.com';
?>
<form class="relative space-y-8" <?php {{PREFIX}}_form_attrs($form_id); ?>>
    <noscript>
        <p class="text-sm">Para enviar este formulario necesitas activar JavaScript. También puedes escribirnos a <a class="underline" href="mailto:<?php echo esc_attr(antispambot($fallback_email)); ?>"><?php echo esc_html(antispambot($fallback_email)); ?></a>.</p>
    </noscript>
    <p class="text-sm">Los campos con <span aria-hidden="true">*</span> son obligatorios.</p>

    <div class="space-y-6">
        <div class="flex flex-col gap-6 lg:flex-row">
            <div class="flex w-full flex-col gap-3 lg:w-1/2">
                <label for="<?php echo esc_attr({{PREFIX}}_field_id($form_id, 'name')); ?>">Nombre completo <span aria-hidden="true">*</span></label>
                <input class="<?php echo esc_attr($input_class); ?>" placeholder="Escribe aquí..." <?php {{PREFIX}}_field_attrs($form_id, 'name'); ?>>
                <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'name'); ?>></p>
            </div>

            <div class="flex w-full flex-col gap-3 lg:w-1/2">
                <label for="<?php echo esc_attr({{PREFIX}}_field_id($form_id, 'phone')); ?>">Teléfono <span aria-hidden="true">*</span></label>
                <input class="<?php echo esc_attr($input_class); ?>" placeholder="Escribe aquí..." <?php {{PREFIX}}_field_attrs($form_id, 'phone'); ?>>
                <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'phone'); ?>></p>
            </div>
        </div>

        <div class="flex flex-col gap-3">
            <label for="<?php echo esc_attr({{PREFIX}}_field_id($form_id, 'email')); ?>">Correo electrónico <span aria-hidden="true">*</span></label>
            <input class="<?php echo esc_attr($input_class); ?>" placeholder="Escribe aquí..." <?php {{PREFIX}}_field_attrs($form_id, 'email'); ?>>
            <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'email'); ?>></p>
        </div>

        <div class="flex flex-col gap-3">
            <label for="<?php echo esc_attr({{PREFIX}}_field_id($form_id, 'service')); ?>">Servicio de interés <span aria-hidden="true">*</span></label>
            <select class="<?php echo esc_attr($input_class); ?>" <?php {{PREFIX}}_field_attrs($form_id, 'service'); ?>>
                <option value="">Elige una opción</option>
                <?php foreach ({{PREFIX}}_field_options($form_id, 'service') as $value => $label) : ?>
                    <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
                <?php endforeach; ?>
            </select>
            <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'service'); ?>></p>
        </div>

        <?php // Radios: siempre dentro de fieldset con legend; un solo contenedor de error. ?>
        <fieldset class="flex flex-col gap-3">
            <legend class="mb-3">Prefiero que me contacten por <span aria-hidden="true">*</span></legend>
            <div class="flex gap-6">
                <?php foreach ({{PREFIX}}_field_options($form_id, 'contact_by') as $value => $label) : ?>
                    <label class="flex min-h-11 items-center gap-2">
                        <input class="size-5" <?php {{PREFIX}}_field_attrs($form_id, 'contact_by', $value); ?>>
                        <?php echo esc_html($label); ?>
                    </label>
                <?php endforeach; ?>
            </div>
            <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'contact_by'); ?>></p>
        </fieldset>

        <?php // Varias opciones: como los radios, fieldset + legend y un solo contenedor de error. ?>
        <fieldset class="flex flex-col gap-3">
            <legend class="mb-3">Temas de interés <span class="text-sm">(elige hasta 3)</span></legend>
            <div class="grid gap-2 sm:grid-cols-2">
                <?php foreach ({{PREFIX}}_field_options($form_id, 'topics') as $value => $label) : ?>
                    <label class="flex min-h-11 items-center gap-2">
                        <input class="size-5" <?php {{PREFIX}}_field_attrs($form_id, 'topics', $value); ?>>
                        <?php echo esc_html($label); ?>
                    </label>
                <?php endforeach; ?>
            </div>
            <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'topics'); ?>></p>
        </fieldset>

        <div class="flex flex-col gap-3">
            <label for="<?php echo esc_attr({{PREFIX}}_field_id($form_id, 'message')); ?>">Mensaje <span aria-hidden="true">*</span></label>
            <textarea class="<?php echo esc_attr($input_class); ?>" rows="5" placeholder="Cuéntanos qué necesitas..." <?php {{PREFIX}}_field_attrs($form_id, 'message'); ?>></textarea>
            <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'message'); ?>></p>
        </div>

        <div class="flex flex-col gap-2">
            <div class="flex items-start gap-3">
                <input class="mt-1 size-5" <?php {{PREFIX}}_field_attrs($form_id, 'consent'); ?>>
                <label for="<?php echo esc_attr({{PREFIX}}_field_id($form_id, 'consent')); ?>" class="text-sm">
                    <?php if ($privacy_url) : ?>
                        Acepto la <a class="underline" href="<?php echo esc_url($privacy_url); ?>" target="_blank" rel="noopener">política de privacidad</a> y el tratamiento de mis datos.
                    <?php else : ?>
                        Acepto la política de privacidad y el tratamiento de mis datos.
                    <?php endif; ?>
                    <span aria-hidden="true">*</span>
                </label>
            </div>
            <p class="text-sm text-anaranjado" <?php {{PREFIX}}_error_attrs($form_id, 'consent'); ?>></p>
        </div>
    </div>

    <?php {{PREFIX}}_form_honeypot(); ?>

    <div class="flex flex-col items-center gap-4">
        <button type="submit" class="btn-anaranjado min-h-11 data-loading:opacity-70" data-loading-label="Enviando...">
            <span data-submit-label>Enviar mensaje</span>
        </button>
        <p class="text-sm text-center data-[state=error]:text-anaranjado data-[state=success]:text-green-700" data-form-status role="status" aria-live="polite"></p>
    </div>
</form>
