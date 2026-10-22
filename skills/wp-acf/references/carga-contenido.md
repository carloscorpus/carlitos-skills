# The initial content: `inc/acf/seed/`

The design's text, images, files and links, moved out of the templates into data files. The engine (`inc/acf/runner.php`) reads every `inc/acf/seed/*.php` and loads it into ACF on theme activation and from Tools > Cargar contenido inicial. One file per page spec (`home.php`), one for the options spec (`opciones.php`), one per options page of a list (`comunicados.php`), and one per content with sample items (`comunicado.php`).

## Shape

```php
<?php
defined('ABSPATH') || exit;

return [
    'page'   => 'home',                        // the page spec slug; or 'option' => true for an options page
    'fields' => [
        'home_hero' => [                       // one entry per section group, the spec's `Grupo`
            'titulo_linea_1' => 'Terminal Portuario',
            'descripcion'    => '|COPAM S.A.| opera el *Terminal Portuario*',
            'boton'          => ['title' => 'Tarifario vigente', 'url' => ['_page' => 'tarifario']],
            'slides'         => [
                ['imagen' => ['_file' => 'assets/img/hero-1.webp', 'alt' => 'Vista aérea del terminal'], 'alt' => 'Vista aérea del terminal'],
            ],
        ],
    ],
];
```

- Keys inside a group are the **subfield names** (`titulo_linea_1`, not `home_hero_titulo_linea_1`). A repeater is a list of rows keyed by subfield name.
- Text values are the exact text the template had, including the highlight markers of `wp-helper` (`|…|`, `*…*`): they are stored as written and `<prefix>_highlight()` prints them.
- `['_file' => 'assets/…', 'alt' => '…']` becomes an attachment: the engine uploads the theme file to the Media Library once (marked, so it is never duplicated), sets the alt text if empty and stores its ID. Use it for `image`, `file` and `gallery` rows. A file the WordPress upload rules reject (SVG without a plugin) is skipped and reported.
- `['_page' => 'tarifario']` becomes that page's permalink (the page spec slug; `home` is the front page). Use it as the `url` of a `link`. An external link is a plain `'url' => 'https://…'`.
- `link` values are `['title' => …, 'url' => …, 'target' => '_blank']` (`target` optional).
- `true_false`: `1` or `0`. `number`: a number. `select`: the stored value (the slug of the option).

## Taking it out of a template

Every fixed text, image path and link of a connected section moves here, with the same value the spec shows as "valor actual". `check.mjs` verifies each text value of a `conectado` section is in the seed file, that the group is there, and that every `_file` exists in the theme.

## Sample items of a content type

For the design's example posts (comunicados, products): `inc/acf/seed/<content>.php`.

```php
return [
    'post_type' => 'post',                     // 'post' for the blog or the content's key
    'terms'     => ['category' => ['Operativo', 'Noticias', 'Mantenimiento']],
    'items'     => [
        [
            'id'        => 'comunicado-1',     // stable id, never changes
            'titulo'    => 'Mantenimiento del portal de clientes',
            'fecha'     => '2026-09-27 09:00:00',
            'extracto'  => 'El portal estará fuera de servicio el sábado.',
            'contenido' => '<p>…</p>',
            'terms'     => ['category' => ['Mantenimiento']],
            'fields'    => ['comunicado_cabecera' => [/* subfields, as above */]],
        ],
    ],
];
```

The engine creates the missing terms and, for each item, the post (published), its terms and its fields. An item that already exists (by `id`) is never touched again.

## Idempotence

Each group of fields is loaded once: the engine stores a marker (`_<prefix>_seed_<group>` on the page or item, an option for options pages). If the client edits a field, loading again does not overwrite it. A new section added later is loaded the next time. To force a reload, delete that marker.
