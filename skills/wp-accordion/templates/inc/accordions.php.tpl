<?php
defined('ABSPATH') || exit;

/*
 * Motor de acordeones (skill wp-accordion).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Imprime un <details> nativo por ítem (el navegador da el
 * teclado, el estado abierto/cerrado y el nombre accesible del <summary>) y deja el contenido libre
 * entre las llamadas:
 *
 *   {{PREFIX}}_accordion_start('faq', ['exclusive' => true, 'icon' => 'plus']);
 *       {{PREFIX}}_accordion_item_start('¿Cómo pago?', ['open' => true]);
 *           ... HTML libre ...
 *       {{PREFIX}}_accordion_item_end();
 *   {{PREFIX}}_accordion_end();
 *
 * Para datos que ya están en una lista (p. ej. un repeater de ACF) hay una versión en una llamada:
 *
 *   {{PREFIX}}_accordion('faq', $items, ['exclusive' => true]);   // $items = [['title' => , 'content' => ]]
 *
 * El comportamiento extra (modo exclusivo en navegadores viejos, abrir por #ancla, eventos) lo da
 * src/js/modules/accordion.js; el movimiento y lo funcional, src/css/accordion.css.
 * El diseño (colores, tipografía, espacios) lo ponen las clases de la vista, no este archivo.
 */

// Valores permitidos de cada opción; cualquier otro valor cae al primero de la lista.
function {{PREFIX}}_accordion_choices(): array
{
    return [
        'icon' => ['chevron', 'plus', 'none'],
        'icon_position' => ['end', 'start'],
        'motion' => ['auto', 'none'],
    ];
}

function {{PREFIX}}_accordion_pick(array $args, string $key): string
{
    $allowed = {{PREFIX}}_accordion_choices()[$key];
    $value = (string) ($args[$key] ?? '');

    return in_array($value, $allowed, true) ? $value : $allowed[0];
}

// El id debe ser un identificador HTML válido y empezar con letra.
function {{PREFIX}}_accordion_id(string $id): string
{
    $id = preg_replace('/[^A-Za-z0-9_-]/', '', $id) ?? '';

    return preg_match('/^[A-Za-z]/', $id) ? $id : 'accordion-' . $id;
}

// Imprime atributos escapados. `true` imprime solo el nombre; null/false se omiten.
function {{PREFIX}}_accordion_print_attrs(array $attrs): void
{
    foreach ($attrs as $name => $value) {
        if ($value === null || $value === false) {
            continue;
        }
        echo ' ', esc_attr($name), $value === true ? '' : '="' . esc_attr((string) $value) . '"';
    }
}

// Clase base del motor más las clases extra de la vista, ya escapadas para un atributo.
function {{PREFIX}}_accordion_class(string $base, string $extra = ''): string
{
    return esc_attr(trim($base . ' ' . $extra));
}

// Configuración del acordeón abierto. Una pila, porque un acordeón puede ir dentro del panel de otro.
function &{{PREFIX}}_accordion_stack(): array
{
    static $stack = [];

    return $stack;
}

/**
 * Abre el acordeón. Opciones (todas opcionales):
 *
 *   exclusive      true: al abrir un ítem se cierran los demás (usa el atributo `name` nativo).
 *   icon           chevron | plus | none. El ícono es decorativo (aria-hidden).
 *   icon_position  end | start
 *   motion         auto | none. `auto` anima la altura y el ícono salvo con movimiento reducido.
 *   heading        2-6: el título de cada ítem va dentro de un <h2>-<h6> en el <summary>.
 *                  Solo si el diseño usa esos títulos como encabezados de la página.
 *   class, item_class, summary_class, title_class, icon_class, panel_class
 *                  Clases (Tailwind) de cada parte, tomadas del diseño.
 */
function {{PREFIX}}_accordion_start(string $id, array $args = []): void
{
    $id = {{PREFIX}}_accordion_id($id);
    $heading = (int) ($args['heading'] ?? 0);

    $stack = &{{PREFIX}}_accordion_stack();
    $stack[] = [
        'id' => $id,
        'exclusive' => !empty($args['exclusive']),
        'icon' => {{PREFIX}}_accordion_pick($args, 'icon'),
        'icon_position' => {{PREFIX}}_accordion_pick($args, 'icon_position'),
        'heading' => $heading >= 2 && $heading <= 6 ? $heading : 0,
        'item_class' => (string) ($args['item_class'] ?? ''),
        'summary_class' => (string) ($args['summary_class'] ?? ''),
        'title_class' => (string) ($args['title_class'] ?? ''),
        'icon_class' => (string) ($args['icon_class'] ?? ''),
        'panel_class' => (string) ($args['panel_class'] ?? ''),
        'count' => 0,
    ];

    $motion = {{PREFIX}}_accordion_pick($args, 'motion');
    ?>
    <div<?php {{PREFIX}}_accordion_print_attrs([
        'id' => $id,
        'class' => {{PREFIX}}_accordion_class('accordion', (string) ($args['class'] ?? '')),
        'data-accordion' => true,
        'data-exclusive' => !empty($args['exclusive']) ? true : null,
        'data-motion' => $motion === 'none' ? 'none' : null,
    ]); ?>>
    <?php
}

function {{PREFIX}}_accordion_end(): void
{
    $stack = &{{PREFIX}}_accordion_stack();
    array_pop($stack);
    ?>
    </div>
    <?php
}

// Ícono decorativo. El chevron gira al abrir; el "plus" pierde la barra vertical (queda un "menos").
function {{PREFIX}}_accordion_icon(string $kind, string $extra): void
{
    if ($kind === 'none') {
        return;
    }
    $path = $kind === 'plus'
        ? '<path d="M5 12h14"/><path class="accordion__bar" d="M12 5v14"/>'
        : '<path d="M6 9l6 6 6-6"/>';
    ?>
    <svg class="<?php echo {{PREFIX}}_accordion_class('accordion__icon accordion__icon--' . $kind, $extra); ?>" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><?php echo $path; // fijo, no viene del usuario ?></svg>
    <?php
}

/**
 * Abre un ítem. Va entre _accordion_start() y _accordion_end().
 *
 *   title          Texto del <summary>. Obligatorio: es el nombre accesible del botón.
 *   open           true: el ítem empieza abierto.
 *   id             Id del ítem, para enlazarlo con #ancla (por defecto <id-del-acordeón>-<n>).
 *   class, summary_class, title_class, icon_class, panel_class
 *                  Reemplazan en este ítem las clases dadas al acordeón.
 */
function {{PREFIX}}_accordion_item_start(string $title, array $args = []): void
{
    $stack = &{{PREFIX}}_accordion_stack();
    if (!$stack) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[wp-accordion] _accordion_item_start() sin _accordion_start().');
        }

        return;
    }

    $cfg = &$stack[array_key_last($stack)];
    $cfg['count']++;
    $item_id = !empty($args['id']) ? {{PREFIX}}_accordion_id((string) $args['id']) : $cfg['id'] . '-' . $cfg['count'];
    $title = trim($title);
    if ($title === '' && defined('WP_DEBUG') && WP_DEBUG) {
        error_log("[wp-accordion] El ítem \"{$item_id}\" no tiene title.");
    }

    $pick = static fn (string $key): string => (string) ($args[$key] ?? $cfg[$key] ?? '');
    $tag = $cfg['heading'] ? 'h' . $cfg['heading'] : 'span';
    $icon_start = $cfg['icon_position'] === 'start';
    ?>
    <details<?php {{PREFIX}}_accordion_print_attrs([
        'id' => $item_id,
        'class' => {{PREFIX}}_accordion_class('accordion__item', (string) ($args['class'] ?? $cfg['item_class'])),
        'name' => $cfg['exclusive'] ? $cfg['id'] : null,
        'data-accordion-item' => true,
        'open' => !empty($args['open']),
    ]); ?>>
        <summary class="<?php echo {{PREFIX}}_accordion_class('accordion__summary', $pick('summary_class')); ?>">
            <?php if ($icon_start) {
                {{PREFIX}}_accordion_icon($cfg['icon'], $pick('icon_class'));
            } ?>
            <<?php echo $tag; ?> class="<?php echo {{PREFIX}}_accordion_class('accordion__title', $pick('title_class')); ?>"><?php echo esc_html($title); ?></<?php echo $tag; ?>>
            <?php if (!$icon_start) {
                {{PREFIX}}_accordion_icon($cfg['icon'], $pick('icon_class'));
            } ?>
        </summary>
        <div class="<?php echo {{PREFIX}}_accordion_class('accordion__panel', $pick('panel_class')); ?>">
    <?php
}

function {{PREFIX}}_accordion_item_end(): void
{
    ?>
        </div>
    </details>
    <?php
}

/**
 * Acordeón completo desde una lista. Cada ítem: ['title' => texto, 'content' => HTML,
 * 'open' => bool, 'id' => texto]. El contenido pasa por wp_kses_post() (el de un editor o un campo
 * de ACF); si necesitas marcado propio, usa las cuatro funciones de arriba.
 */
function {{PREFIX}}_accordion(string $id, array $items, array $args = []): void
{
    {{PREFIX}}_accordion_start($id, $args);
    foreach ($items as $item) {
        if (!is_array($item) || trim((string) ($item['title'] ?? '')) === '') {
            continue; // un ítem sin título no tiene nombre accesible
        }
        {{PREFIX}}_accordion_item_start((string) $item['title'], [
            'open' => !empty($item['open']),
            'id' => $item['id'] ?? '',
        ]);
        echo wp_kses_post((string) ($item['content'] ?? ''));
        {{PREFIX}}_accordion_item_end();
    }
    {{PREFIX}}_accordion_end();
}
