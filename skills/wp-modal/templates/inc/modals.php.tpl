<?php
defined('ABSPATH') || exit;

/*
 * Motor de modales (skill wp-modal).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Imprime un <dialog> nativo con la estructura fija
 * (título, botón de cerrar, zona con scroll) y deja el contenido libre entre las dos llamadas:
 *
 *   {{PREFIX}}_modal_start('promo', ['title' => 'Oferta', 'width' => '45rem']);
 *   ... HTML libre ...
 *   {{PREFIX}}_modal_end();
 *
 * El comportamiento (abrir, cerrar, clic fuera, apertura automática) lo da el navegador y
 * src/js/modules/modal.js; el aspecto funcional y el movimiento, src/css/modal.css.
 * El diseño (colores, tipografía, espacios) lo ponen las clases de la vista, no este archivo.
 */

// Valores permitidos de cada opción; cualquier otro valor cae al primero de la lista.
function {{PREFIX}}_modal_choices(): array
{
    return [
        'placement' => ['center', 'right', 'left', 'bottom'],
        'role' => ['dialog', 'alertdialog'],
        'mobile' => ['default', 'center', 'sheet', 'fullscreen'],
        'motion' => ['auto', 'fade', 'scale', 'slide', 'none'],
        'form_success' => ['keep', 'close'],
        'auto_on' => ['delay', 'load', 'scroll'],
    ];
}

function {{PREFIX}}_modal_pick(array $args, string $key): string
{
    $allowed = {{PREFIX}}_modal_choices()[$key];
    $value = (string) ($args[$key] ?? '');

    return in_array($value, $allowed, true) ? $value : $allowed[0];
}

// El id debe ser un identificador HTML válido y empezar con letra.
function {{PREFIX}}_modal_id(string $id): string
{
    $id = preg_replace('/[^A-Za-z0-9_-]/', '', $id) ?? '';

    return preg_match('/^[A-Za-z]/', $id) ? $id : 'modal-' . $id;
}

// Imprime atributos escapados. `true` imprime solo el nombre; null/false se omiten.
function {{PREFIX}}_modal_print_attrs(array $attrs): void
{
    foreach ($attrs as $name => $value) {
        if ($value === null || $value === false) {
            continue;
        }
        echo ' ', esc_attr($name), $value === true ? '' : '="' . esc_attr((string) $value) . '"';
    }
}

// Clase base del motor más las clases extra de la vista, ya escapadas para un atributo.
function {{PREFIX}}_modal_class(string $base, string $extra = ''): string
{
    return esc_attr(trim($base . ' ' . $extra));
}

// Largo CSS válido (`720`, `720px`, `45rem`, `80%`). Un número sin unidad son píxeles.
// Devuelve '' si no es válido: así nada raro llega al atributo style.
function {{PREFIX}}_modal_length($value): string
{
    $value = trim((string) $value);
    if (preg_match('/^\d+(\.\d+)?$/', $value)) {
        return $value . 'px';
    }

    return preg_match('/^\d+(\.\d+)?(px|rem|em|%|vw|ch)$/', $value) ? $value : '';
}

/**
 * Abre el modal. Opciones (todas opcionales salvo `title`):
 *
 *   title          Texto del título. Obligatorio: da el nombre accesible del modal.
 *   title_hidden   true: el título solo lo leen los lectores de pantalla.
 *   description    Texto breve bajo el título (aria-describedby).
 *   placement      center | right | left | bottom
 *   role           dialog | alertdialog (confirmaciones: exige una decisión)
 *   width          Ancho exacto de Figma ('45rem', '720px', 720, '80%').
 *   mobile         center | sheet | fullscreen, según el frame móvil de Figma.
 *   motion         auto | fade | scale | slide | none (auto: según placement)
 *   stagger        true: el contenido del cuerpo entra de forma escalonada.
 *   backdrop_close true (por defecto) | false. Un alertdialog nunca se cierra con clic fuera.
 *   form_success   keep | close: qué hacer cuando un wp-form dentro del modal se envía bien.
 *   close_label    Texto accesible del botón de cerrar (por defecto "Cerrar").
 *   auto           Apertura automática: ['on' => delay|load|scroll, 'delay' => ms,
 *                  'scroll' => %, 'repeat' => always|session|days:N, 'min_width' => px].
 *   class, header_class, title_class, description_class, close_class, body_class
 *                  Clases (Tailwind) de cada parte, tomadas del diseño.
 */
function {{PREFIX}}_modal_start(string $id, array $args = []): void
{
    $id = {{PREFIX}}_modal_id($id);
    $title = trim((string) ($args['title'] ?? ''));
    if ($title === '') {
        // Sin título no hay nombre accesible: se avisa en modo debug y se usa el id.
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[wp-modal] El modal \"{$id}\" no tiene title.");
        }
        $title = $id;
    }

    $placement = {{PREFIX}}_modal_pick($args, 'placement');
    $role = {{PREFIX}}_modal_pick($args, 'role');
    $mobile = {{PREFIX}}_modal_pick($args, 'mobile');
    $motion = {{PREFIX}}_modal_pick($args, 'motion');
    $form_success = {{PREFIX}}_modal_pick($args, 'form_success');
    $description = trim((string) ($args['description'] ?? ''));
    $backdrop_close = ($args['backdrop_close'] ?? true) && $role !== 'alertdialog';
    $width = {{PREFIX}}_modal_length($args['width'] ?? '');

    $attrs = [
        'id' => $id,
        'data-modal' => true,
        'data-placement' => $placement,
        'data-motion' => $motion === 'auto' ? null : $motion,
        'data-mobile' => $mobile === 'default' ? null : $mobile,
        'data-stagger' => !empty($args['stagger']) ? true : null,
        'data-backdrop-close' => $backdrop_close ? 'true' : null,
        'data-form-success' => $form_success === 'close' ? 'close' : null,
        'role' => $role === 'alertdialog' ? 'alertdialog' : null,
        'aria-labelledby' => $id . '-title',
        'aria-describedby' => $description !== '' ? $id . '-description' : null,
        'style' => $width !== '' ? '--modal-width-exact:' . $width : null,
    ];

    // Apertura automática: se decide en el navegador, así funciona con cualquier caché de página.
    $auto = is_array($args['auto'] ?? null) ? $args['auto'] : null;
    if ($auto) {
        $on = {{PREFIX}}_modal_pick(['auto_on' => $auto['on'] ?? ''], 'auto_on');
        $repeat = (string) ($auto['repeat'] ?? 'session');
        if (!preg_match('/^(always|session|days:[1-9]\d{0,3})$/', $repeat)) {
            $repeat = 'session';
        }
        $attrs['data-modal-auto'] = $on;
        $attrs['data-modal-delay'] = $on === 'delay' ? max(0, (int) ($auto['delay'] ?? 0)) : null;
        $attrs['data-modal-scroll'] = $on === 'scroll' ? min(100, max(1, (int) ($auto['scroll'] ?? 50))) : null;
        $attrs['data-modal-repeat'] = $repeat;
        $attrs['data-modal-min-width'] = !empty($auto['min_width']) ? max(0, (int) $auto['min_width']) : null;
    }

    $title_class = {{PREFIX}}_modal_class('modal__title' . (!empty($args['title_hidden']) ? ' modal__title--hidden' : ''), (string) ($args['title_class'] ?? ''));
    ?>
    <dialog<?php {{PREFIX}}_modal_print_attrs($attrs); ?>>
        <div class="<?php echo {{PREFIX}}_modal_class('modal__panel', (string) ($args['class'] ?? '')); ?>">
            <header class="<?php echo {{PREFIX}}_modal_class('modal__header', (string) ($args['header_class'] ?? '')); ?>">
                <h2 id="<?php echo esc_attr($id); ?>-title" class="<?php echo $title_class; ?>"><?php echo esc_html($title); ?></h2>
                <form method="dialog">
                    <button class="<?php echo {{PREFIX}}_modal_class('modal__close', (string) ($args['close_class'] ?? '')); ?>" aria-label="<?php echo esc_attr((string) ($args['close_label'] ?? 'Cerrar')); ?>">
                        <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </form>
            </header>
            <?php if ($description !== '') : ?>
                <p id="<?php echo esc_attr($id); ?>-description" class="<?php echo {{PREFIX}}_modal_class('modal__description', (string) ($args['description_class'] ?? '')); ?>"><?php echo esc_html($description); ?></p>
            <?php endif; ?>
            <div class="<?php echo {{PREFIX}}_modal_class('modal__body', (string) ($args['body_class'] ?? '')); ?>">
    <?php
}

function {{PREFIX}}_modal_end(): void
{
    ?>
            </div>
        </div>
    </dialog>
    <?php
}

/**
 * Atributos del disparador. Dentro de la etiqueta:
 *
 *   <button <?php {{PREFIX}}_modal_trigger_attrs('promo'); ?>>Abrir</button>
 *   <a href="/promo/" <?php {{PREFIX}}_modal_trigger_attrs('promo', ['link' => true]); ?>>Abrir</a>
 *
 * Con un <a href> real el contenido sigue siendo rastreable y funciona sin JavaScript.
 * En un <button> el navegador abre el modal con Invoker Commands; modal.js cubre el resto.
 */
function {{PREFIX}}_modal_trigger_attrs(string $id, array $args = []): void
{
    $id = {{PREFIX}}_modal_id($id);
    $link = !empty($args['link']);

    {{PREFIX}}_modal_print_attrs([
        'type' => $link ? null : 'button',
        'command' => $link ? null : 'show-modal',
        'commandfor' => $link ? null : $id,
        'data-modal-open' => $id,
        'aria-haspopup' => 'dialog',
    ]);
}
