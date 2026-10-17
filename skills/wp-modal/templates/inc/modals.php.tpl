<?php
defined('ABSPATH') || exit;

/*
 * Motor de modales (skill wp-modal).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Imprime un <dialog> nativo con la estructura fija
 * (título, botón de cerrar, zona con scroll) y deja el contenido libre entre las dos llamadas:
 *
 *   {{PREFIX}}_modal_start('promo', ['title' => 'Oferta']);
 *   ... HTML libre ...
 *   {{PREFIX}}_modal_end();
 *
 * El comportamiento (abrir, cerrar, clic fuera, apertura automática) lo da el navegador y
 * src/js/modules/modal.js; el aspecto funcional, src/css/modal.css.
 */

// Valores permitidos de cada opción; cualquier otro valor cae al primero de la lista.
function {{PREFIX}}_modal_choices(): array
{
    return [
        'size' => ['md', 'sm', 'lg', 'xl', 'full'],
        'placement' => ['center', 'right', 'left', 'bottom'],
        'mode' => ['modal', 'non-modal'],
        'role' => ['dialog', 'alertdialog'],
        'auto_on' => ['delay', 'load', 'scroll'],
    ];
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

// Normaliza las opciones: valores válidos, título obligatorio y apertura automática opcional.
function {{PREFIX}}_modal_args(string $id, array $args): array
{
    $choices = {{PREFIX}}_modal_choices();
    $pick = static fn ($value, array $allowed): string => in_array($value, $allowed, true) ? $value : $allowed[0];

    $id = {{PREFIX}}_modal_id($id);
    $role = $pick($args['role'] ?? null, $choices['role']);
    $mode = $pick($args['mode'] ?? null, $choices['mode']);

    $title = trim((string) ($args['title'] ?? ''));
    if ($title === '') {
        // Sin título el modal no tiene nombre accesible: se avisa y se usa el id como respaldo.
        _doing_it_wrong(__FUNCTION__, 'Cada modal necesita un "title": es su nombre accesible.', '{{ENGINE_VERSION}}');
        $title = ucfirst(str_replace(['-', '_'], ' ', $id));
    }

    // Un alertdialog exige una decisión: no se cierra con clic fuera. Un modal no modal no tiene fondo.
    $backdrop_close = $args['backdrop_close'] ?? true;
    $backdrop_close = $mode === 'modal' && $role === 'dialog' && $backdrop_close !== false;

    $auto = null;
    if (!empty($args['auto']) && is_array($args['auto'])) {
        $repeat = (string) ($args['auto']['repeat'] ?? 'session');
        $auto = [
            'on' => $pick($args['auto']['on'] ?? null, $choices['auto_on']),
            'delay' => max(0, (int) ($args['auto']['delay'] ?? 3000)),
            'scroll' => min(100, max(1, (int) ($args['auto']['scroll'] ?? 50))),
            'min_width' => max(0, (int) ($args['auto']['min_width'] ?? 0)),
            'repeat' => preg_match('/^(always|session|days:[1-9][0-9]{0,2})$/', $repeat) ? $repeat : 'session',
        ];
    }

    return [
        'id' => $id,
        'title' => $title,
        'title_visible' => ($args['title_visible'] ?? true) !== false,
        'description' => trim((string) ($args['description'] ?? '')),
        'size' => $pick($args['size'] ?? null, $choices['size']),
        'placement' => $pick($args['placement'] ?? null, $choices['placement']),
        'mode' => $mode,
        'role' => $role,
        'backdrop_close' => $backdrop_close,
        'close_label' => trim((string) ($args['close_label'] ?? '')) ?: 'Cerrar',
        'class' => trim((string) ($args['class'] ?? '')),
        'auto' => $auto,
    ];
}

/*
 * Abre el <dialog>. Opciones ($args):
 *   title            (obligatorio) nombre accesible del modal.
 *   title_visible    false = el título solo lo leen los lectores de pantalla.
 *   description      texto breve opcional (aria-describedby).
 *   size             md (por defecto) | sm | lg | xl | full
 *   placement        center (por defecto) | right | left | bottom
 *   mode             modal (por defecto) | non-modal (la página sigue usable; sin fondo bloqueado)
 *   role             dialog (por defecto) | alertdialog (confirmaciones: no se cierra con clic fuera)
 *   backdrop_close   false = no se cierra con clic fuera
 *   close_label      texto accesible del botón de cerrar
 *   class            clases extra para el panel (p. ej. de Tailwind)
 *   auto             null (por defecto) | ['on' => 'delay|load|scroll', 'delay' => ms,
 *                    'scroll' => %, 'min_width' => px (solo se abre en pantallas de ese ancho o más;
 *                    0 = siempre), 'repeat' => 'always|session|days:N']
 */
function {{PREFIX}}_modal_start(string $id, array $args = []): void
{
    $m = {{PREFIX}}_modal_args($id, $args);
    $title_id = $m['id'] . '-title';
    $desc_id = $m['id'] . '-desc';

    echo '<dialog';
    {{PREFIX}}_modal_print_attrs([
        'id' => $m['id'],
        'class' => 'modal',
        'data-modal' => true,
        'data-size' => $m['size'],
        'data-placement' => $m['placement'],
        'data-mode' => $m['mode'],
        'data-backdrop-close' => $m['backdrop_close'] ? 'true' : 'false',
        'role' => $m['role'] === 'alertdialog' ? 'alertdialog' : null,
        'aria-labelledby' => $title_id,
        'aria-describedby' => $m['description'] !== '' ? $desc_id : null,
        'data-modal-auto' => $m['auto']['on'] ?? null,
        'data-modal-delay' => $m['auto'] ? $m['auto']['delay'] : null,
        'data-modal-scroll' => $m['auto'] ? $m['auto']['scroll'] : null,
        'data-modal-min-width' => $m['auto'] && $m['auto']['min_width'] > 0 ? $m['auto']['min_width'] : null,
        'data-modal-repeat' => $m['auto']['repeat'] ?? null,
    ]);
    echo ">\n";

    echo '<div class="modal__panel', $m['class'] !== '' ? ' ' . esc_attr($m['class']) : '', "\">\n";
    echo '<header class="modal__header">', "\n";
    echo '<h2 id="', esc_attr($title_id), '" class="modal__title', $m['title_visible'] ? '' : ' modal__title--hidden', '">', esc_html($m['title']), "</h2>\n";
    // method="dialog" cierra el <dialog> sin JavaScript.
    echo '<form method="dialog"><button type="submit" class="modal__close" aria-label="', esc_attr($m['close_label']), '">';
    echo '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    echo "</button></form>\n";
    echo "</header>\n";

    if ($m['description'] !== '') {
        echo '<p id="', esc_attr($desc_id), '" class="modal__description">', esc_html($m['description']), "</p>\n";
    }

    echo "<div class=\"modal__body\">\n";
}

// Cierra el cuerpo, el panel y el <dialog> abiertos por {{PREFIX}}_modal_start().
function {{PREFIX}}_modal_end(): void
{
    echo "</div>\n</div>\n</dialog>\n";
}

/*
 * Imprime los atributos de un disparador (botón o enlace) que abre el modal $id.
 *   <button type="button" <?php {{PREFIX}}_modal_trigger_attrs('promo'); ?>>Ver oferta</button>
 *   <a href="/oferta/" <?php {{PREFIX}}_modal_trigger_attrs('promo', ['link' => true]); ?>>Ver oferta</a>
 * Opciones: mode ('modal' | 'non-modal', igual que el modal), link (true en un <a>: con un enlace
 * real la página funciona aunque falle el JavaScript, y el buscador puede rastrearlo).
 */
function {{PREFIX}}_modal_trigger_attrs(string $id, array $args = []): void
{
    $id = {{PREFIX}}_modal_id($id);
    $declarative = ($args['mode'] ?? 'modal') !== 'non-modal' && empty($args['link']);

    {{PREFIX}}_modal_print_attrs([
        'aria-haspopup' => 'dialog',
        'aria-controls' => $id,
        'data-modal-open' => $id,
        // Invoker Commands: abren el modal sin JavaScript. No existe un comando para el modo no modal.
        'command' => $declarative ? 'show-modal' : null,
        'commandfor' => $declarative ? $id : null,
    ]);
}
