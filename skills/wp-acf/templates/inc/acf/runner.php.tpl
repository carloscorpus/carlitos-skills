<?php
defined('ABSPATH') || exit;

/*
 * Sincronización de ACF y carga inicial de contenido (skill wp-acf).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Los datos del proyecto viven en:
 *   inc/acf/paginas.php   páginas de WordPress (lo genera wp-acf desde los specs)
 *   inc/acf/sitio.php     menús y logo
 *   inc/acf/seed/*.php    texto, imágenes y enlaces de cada página, de las opciones y de los contenidos de ejemplo
 *
 * Se ejecuta al activar el tema y desde Herramientas > Cargar contenido inicial. Es idempotente: cada grupo
 * de campos se carga una sola vez (queda una marca) y nunca pisa lo que el cliente ya editó.
 */

// ---------- Menús y logo (en cada petición) ----------

function {{PREFIX}}_acf_site(): array
{
    static $site = null;
    if ($site === null) {
        $file = get_theme_file_path('inc/acf/sitio.php');
        $site = is_readable($file) ? (array) require $file : [];
    }
    return $site;
}

function {{PREFIX}}_acf_setup_site()
{
    $site = {{PREFIX}}_acf_site();

    $locations = [];
    foreach ((array) ($site['menus'] ?? []) as $location => $menu) {
        $locations[(string) $location] = (string) ($menu['nombre'] ?? $location);
    }
    if ($locations) {
        register_nav_menus($locations);
    }

    if (!empty($site['logo'])) {
        add_theme_support('custom-logo');
    }
}
add_action('after_setup_theme', '{{PREFIX}}_acf_setup_site');

// ---------- Utilidades ----------

// Misma clave que genera wp-acf (generate.mjs): depende solo del nombre del campo.
function {{PREFIX}}_acf_key(string $name): string
{
    return 'field_' . substr(sha1('wp-acf:field:' . $name), 0, 13);
}

// Sube un archivo del tema (assets/...) a la biblioteca de medios una sola vez y devuelve su ID (0 si falla).
function {{PREFIX}}_acf_attachment(string $relative): int
{
    $path = get_theme_file_path($relative);
    if (!is_readable($path)) {
        return 0;
    }

    $existing = get_posts([
        'post_type'      => 'attachment',
        'post_status'    => 'inherit',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_key'       => '_{{PREFIX}}_seed_file',
        'meta_value'     => $relative,
    ]);
    if ($existing) {
        return (int) $existing[0];
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';

    $tmp = wp_tempnam($path);
    if (!$tmp || !copy($path, $tmp)) {
        return 0;
    }

    $id = media_handle_sideload(['name' => basename($path), 'tmp_name' => $tmp], 0);
    if (is_wp_error($id)) {
        @unlink($tmp);
        return 0;
    }

    update_post_meta($id, '_{{PREFIX}}_seed_file', $relative);
    return (int) $id;
}

// Reemplaza los marcadores de una carga: ['_file' => 'assets/img/x.webp', 'alt' => '...'] por el ID del adjunto y
// ['_page' => 'tarifario'] por la ruta relativa de esa página ('/tarifario/'), sin dominio: así la base de datos no
// depende de si el sitio está en local o en producción.
function {{PREFIX}}_acf_resolve($value, array $pages)
{
    if (!is_array($value)) {
        return $value;
    }

    if (isset($value['_file'])) {
        $id = {{PREFIX}}_acf_attachment((string) $value['_file']);
        if ($id && !empty($value['alt']) && get_post_meta($id, '_wp_attachment_image_alt', true) === '') {
            update_post_meta($id, '_wp_attachment_image_alt', (string) $value['alt']);
        }
        return $id ?: '';
    }

    if (isset($value['_page'])) {
        $slug = (string) $value['_page'];
        $link = isset($pages[$slug]) ? get_permalink($pages[$slug]) : '';
        return wp_make_link_relative($link ?: home_url('/' . trim($slug, '/') . '/'));
    }

    $resolved = [];
    foreach ($value as $key => $item) {
        $resolved[$key] = {{PREFIX}}_acf_resolve($item, $pages);
    }
    return $resolved;
}

// ---------- 1. Sincronizar el JSON con la base de datos ----------

// Igual que el botón "Sync" de ACF: importa los grupos, tipos de contenido, taxonomías y páginas de opciones
// del acf-json/ que faltan en la base o son más nuevos, para poder editarlos desde el admin.
function {{PREFIX}}_acf_sync(): array
{
    if (!function_exists('acf_get_local_json_files') || !function_exists('acf_import_internal_post_type') || !function_exists('acf_get_internal_post_type_posts')) {
        return ['error' => 'ACF Pro 6.1 o superior no está activo.'];
    }

    $report = [];
    $json = acf_get_setting('json');
    acf_update_setting('json', false);

    foreach (['acf-field-group', 'acf-post-type', 'acf-taxonomy', 'acf-ui-options-page'] as $type) {
        $files = acf_get_local_json_files($type);
        if (!$files) {
            continue;
        }

        foreach (acf_get_internal_post_type_posts($type) as $post) {
            if (($post['local'] ?? '') !== 'json' || !empty($post['private']) || empty($files[$post['key']])) {
                continue;
            }

            $in_db    = !empty($post['ID']);
            $modified = (int) ($post['modified'] ?? 0);
            if ($in_db && (!$modified || $modified <= (int) get_post_modified_time('U', true, $post['ID']))) {
                continue;
            }

            $local = json_decode((string) file_get_contents($files[$post['key']]), true);
            if (!is_array($local)) {
                continue;
            }

            $local['ID'] = $in_db ? (int) $post['ID'] : 0;
            acf_import_internal_post_type($local, $type);
            $report[] = ['tipo' => $type, 'clave' => $post['key'], 'accion' => $in_db ? 'actualizado' : 'importado'];
        }
    }

    acf_update_setting('json', $json);
    return $report;
}

// ---------- 2. Páginas de WordPress ----------

function {{PREFIX}}_acf_pages(): array
{
    $file  = get_theme_file_path('inc/acf/paginas.php');
    $pages = is_readable($file) ? (array) require $file : [];
    $ids   = [];
    $report = [];

    foreach ($pages as $key => $page) {
        $slug  = (string) ($page['slug'] ?? $key);
        $front = !empty($page['frente']);
        $front_id = get_option('show_on_front') === 'page' ? (int) get_option('page_on_front') : 0;
        $front_ok = $front_id && get_post_status($front_id) === 'publish';

        $id = 0;
        if ($front && $front_ok) {
            $id = $front_id;
        } else {
            $existing = get_page_by_path($slug);
            if ($existing && $existing->post_status !== 'trash') {
                $id = (int) $existing->ID;
            }
        }

        $state = 'existente';
        if (!$id) {
            $id = wp_insert_post([
                'post_type'   => 'page',
                'post_status' => 'publish',
                'post_title'  => (string) ($page['titulo'] ?? $slug),
                'post_name'   => $slug,
            ], true);
            if (is_wp_error($id)) {
                $report[$key] = ['estado' => 'error: ' . $id->get_error_message()];
                continue;
            }
            $state = 'creada';
        }

        if ($front && !$front_ok) {
            update_option('page_on_front', $id);
            update_option('show_on_front', 'page');
        } elseif (!$front && !empty($page['plantilla'])) {
            $current = (string) get_post_meta($id, '_wp_page_template', true);
            if ($current === '' || $current === 'default') {
                update_post_meta($id, '_wp_page_template', (string) $page['plantilla']);
            }
        }

        $ids[$key]    = (int) $id;
        $report[$key] = ['id' => (int) $id, 'estado' => $state];
    }

    return ['ids' => $ids, 'report' => $report];
}

// ---------- 3. Cargas de contenido ----------

// Carga los campos de un destino: un ID de página o entrada, o 'option' para una página de opciones.
function {{PREFIX}}_acf_seed_fields(array $fields, $target, array $pages): array
{
    $report = [];

    foreach ($fields as $group => $values) {
        $marker = '_{{PREFIX}}_seed_' . $group;
        $done   = $target === 'option' ? get_option($marker) : get_post_meta((int) $target, $marker, true);
        if ($done) {
            $report[$group] = 'omitido (ya cargado)';
            continue;
        }

        update_field({{PREFIX}}_acf_key((string) $group), {{PREFIX}}_acf_resolve($values, $pages), $target);

        if ($target === 'option') {
            update_option($marker, 1, false);
        } else {
            update_post_meta((int) $target, $marker, 1);
        }
        $report[$group] = 'cargado';
    }

    return $report;
}

// Un archivo de inc/acf/seed/: los campos de una página ('page'), de las opciones ('option') o los elementos de
// ejemplo de un contenido ('items', con 'post_type' y 'terms').
function {{PREFIX}}_acf_seed(array $seed, array $pages): array
{
    $report = [];

    foreach ((array) ($seed['terms'] ?? []) as $taxonomy => $names) {
        foreach ((array) $names as $name) {
            if (!term_exists((string) $name, (string) $taxonomy)) {
                wp_insert_term((string) $name, (string) $taxonomy);
            }
        }
    }

    if (!empty($seed['page'])) {
        $id = $pages[(string) $seed['page']] ?? 0;
        $report['pagina'] = $id
            ? {{PREFIX}}_acf_seed_fields((array) ($seed['fields'] ?? []), $id, $pages)
            : 'omitido (la página aún no existe)';
    } elseif (!empty($seed['option'])) {
        $report['opciones'] = {{PREFIX}}_acf_seed_fields((array) ($seed['fields'] ?? []), 'option', $pages);
    }

    $post_type = (string) ($seed['post_type'] ?? 'post');
    foreach ((array) ($seed['items'] ?? []) as $item) {
        $seed_id = (string) ($item['id'] ?? '');
        if ($seed_id === '') {
            continue;
        }

        $found = get_posts([
            'post_type'      => $post_type,
            'post_status'    => 'any',
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'meta_key'       => '_{{PREFIX}}_seed_id',
            'meta_value'     => $seed_id,
        ]);

        if ($found) {
            $post_id = (int) $found[0];
            $state   = 'existente';
        } else {
            $args = [
                'post_type'    => $post_type,
                'post_status'  => 'publish',
                'post_title'   => (string) ($item['titulo'] ?? $seed_id),
                'post_excerpt' => (string) ($item['extracto'] ?? ''),
                'post_content' => (string) ($item['contenido'] ?? ''),
            ];
            if (!empty($item['fecha'])) {
                $args['post_date'] = (string) $item['fecha'];
            }
            $post_id = wp_insert_post($args, true);
            if (is_wp_error($post_id)) {
                $report['items'][$seed_id] = 'error: ' . $post_id->get_error_message();
                continue;
            }
            update_post_meta($post_id, '_{{PREFIX}}_seed_id', $seed_id);
            foreach ((array) ($item['terms'] ?? []) as $taxonomy => $names) {
                wp_set_object_terms($post_id, (array) $names, (string) $taxonomy);
            }
            $state = 'creado';
        }

        $report['items'][$seed_id] = [
            'estado' => $state,
            'campos' => {{PREFIX}}_acf_seed_fields((array) ($item['fields'] ?? []), (int) $post_id, $pages),
        ];
    }

    return $report;
}

// ---------- 4. Menús ----------

function {{PREFIX}}_acf_menus(array $pages): array
{
    $report = [];

    foreach ((array) ({{PREFIX}}_acf_site()['menus'] ?? []) as $location => $menu) {
        $assigned = get_nav_menu_locations();
        if (!empty($assigned[$location]) && wp_get_nav_menu_object($assigned[$location])) {
            $report[$location] = 'omitido (la ubicación ya tiene un menú)';
            continue;
        }

        $name     = (string) ($menu['nombre'] ?? $location);
        $existing = wp_get_nav_menu_object($name);
        if ($existing) {
            set_theme_mod('nav_menu_locations', array_merge($assigned, [$location => (int) $existing->term_id]));
            $report[$location] = 'asignado el menú existente';
            continue;
        }

        $menu_id = wp_create_nav_menu($name);
        if (is_wp_error($menu_id)) {
            $report[$location] = 'error: ' . $menu_id->get_error_message();
            continue;
        }

        $skipped = [];
        $add = function (array $items, int $parent) use (&$add, $menu_id, $pages, &$skipped) {
            foreach ($items as $item) {
                $args = [
                    'menu-item-title'     => (string) ($item['titulo'] ?? ''),
                    'menu-item-status'    => 'publish',
                    'menu-item-parent-id' => $parent,
                ];
                if (!empty($item['clases'])) {
                    $args['menu-item-classes'] = (string) $item['clases'];
                }

                if (!empty($item['pagina'])) {
                    $page_id = $pages[(string) $item['pagina']] ?? 0;
                    if (!$page_id) {
                        $skipped[] = (string) $item['pagina'];
                        continue;
                    }
                    $args += ['menu-item-type' => 'post_type', 'menu-item-object' => 'page', 'menu-item-object-id' => $page_id];
                } else {
                    $args += ['menu-item-type' => 'custom', 'menu-item-url' => (string) ($item['url'] ?? '#')];
                }

                $id = wp_update_nav_menu_item($menu_id, 0, $args);
                if (!is_wp_error($id) && !empty($item['hijos'])) {
                    $add((array) $item['hijos'], (int) $id);
                }
            }
        };
        $add((array) ($menu['items'] ?? []), 0);

        set_theme_mod('nav_menu_locations', array_merge($assigned, [$location => (int) $menu_id]));
        $report[$location] = ['menu' => (int) $menu_id, 'paginas_omitidas' => array_values(array_unique($skipped))];
    }

    return $report;
}

// ---------- 5. Logo ----------

function {{PREFIX}}_acf_logo(): string
{
    $file = (string) ({{PREFIX}}_acf_site()['logo'] ?? '');
    if ($file === '') {
        return 'sin logo configurado';
    }
    if (get_theme_mod('custom_logo')) {
        return 'omitido (ya hay un logo)';
    }

    $id = {{PREFIX}}_acf_attachment($file);
    if (!$id) {
        return 'no se pudo subir ' . $file . ' (si es SVG, WordPress no lo permite sin un plugin: súbelo a mano en Personalizar)';
    }

    set_theme_mod('custom_logo', $id);
    return 'logo asignado';
}

// ---------- Todo junto ----------

function {{PREFIX}}_acf_run(): array
{
    $report = ['sync' => {{PREFIX}}_acf_sync()];
    if (isset($report['sync']['error']) || !function_exists('update_field')) {
        $report['error'] = 'ACF Pro no está activo: activa el plugin y vuelve a cargar.';
        return $report;
    }

    $pages            = {{PREFIX}}_acf_pages();
    $report['paginas'] = $pages['report'];

    $report['cargas'] = [];
    foreach (glob(get_theme_file_path('inc/acf/seed/*.php')) ?: [] as $file) {
        $seed = require $file;
        if (is_array($seed)) {
            $report['cargas'][basename($file)] = {{PREFIX}}_acf_seed($seed, $pages['ids']);
        }
    }

    $report['menus'] = {{PREFIX}}_acf_menus($pages['ids']);
    $report['logo']  = {{PREFIX}}_acf_logo();

    return $report;
}

add_action('after_switch_theme', '{{PREFIX}}_acf_run');

// ---------- Herramientas > Cargar contenido inicial ----------

function {{PREFIX}}_acf_admin_menu()
{
    add_management_page(
        __('Cargar contenido inicial', '{{SLUG}}'),
        __('Cargar contenido inicial', '{{SLUG}}'),
        'manage_options',
        '{{SLUG}}-carga',
        '{{PREFIX}}_acf_render_tool'
    );
}
add_action('admin_menu', '{{PREFIX}}_acf_admin_menu');

function {{PREFIX}}_acf_render_tool()
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $report = null;
    if (isset($_POST['{{PREFIX}}_acf_run'])) {
        check_admin_referer('{{PREFIX}}_acf_run');
        $report = {{PREFIX}}_acf_run();
    }
    ?>
    <div class="wrap">
        <h1><?= esc_html__('Cargar contenido inicial', '{{SLUG}}') ?></h1>
        <p><?= esc_html__('Sincroniza los campos de ACF y carga el texto, las imágenes y los menús del diseño. Lo que ya se cargó o se editó no se vuelve a pisar.', '{{SLUG}}') ?></p>
        <form method="post">
            <?php wp_nonce_field('{{PREFIX}}_acf_run'); ?>
            <?php submit_button(__('Cargar contenido', '{{SLUG}}'), 'primary', '{{PREFIX}}_acf_run'); ?>
        </form>
        <?php if ($report !== null) : ?>
            <h2><?= esc_html__('Resultado', '{{SLUG}}') ?></h2>
            <pre><?= esc_html(wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></pre>
        <?php endif; ?>
    </div>
    <?php
}
