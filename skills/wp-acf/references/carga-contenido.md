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
            'titulo'         => "Terminal Portuario\ndel |Callao|",   // textarea en dos líneas
            'descripcion'    => '|COPAM S.A.| opera el *Terminal Portuario*',
            'boton'          => ['title' => 'Tarifario vigente', 'url' => ['_page' => 'tarifario']],
            'slides'         => [
                ['imagen' => ['_file' => 'assets/img/hero-1.webp', 'alt' => 'Vista aérea del terminal'], 'alt' => 'Vista aérea del terminal'],
            ],
        ],
    ],
];
```

- Keys inside a group are the **subfield names** (`titulo`, not `home_hero_titulo`). A repeater is a list of rows keyed by subfield name.
- Text values are the exact text the template had, including the highlight markers of `wp-helper` (`|…|`, `*…*`): they are stored as written and `<prefix>_highlight()` prints them.
- A `<br>` in the spec's "valor actual" is a real line break in the seed: write that value in double quotes with `\n` (`"Terminal Portuario\ndel |Callao|"`) and escape a dollar sign as `\$`. Every other text stays in single quotes.
- `['_file' => 'assets/…', 'alt' => '…']` becomes an attachment: the engine uploads the theme file to the Media Library once (marked, so it is never duplicated), sets the alt text if empty and stores its ID. Use it for `image`, `file` and `gallery` rows. A file the WordPress upload rules reject (SVG without a plugin) is skipped and reported.
- `['_page' => 'tarifario']` becomes that page's **relative path** (`/tarifario/`; the page spec slug; `home` is the front page, `/`). Use it as the `url` of a `link`. It never stores a domain, so the value does not depend on local or production. A path that is not a WordPress page is a plain relative string (`'url' => '/tarifario/'`); an external link is a plain `'url' => 'https://…'`.
- Never write an absolute URL of the site itself (`http://copam.local/…`, `localhost`, the production domain): `check.mjs` reports it.
- `link` values are `['title' => …, 'url' => …, 'target' => '_blank']` (`target` optional).
- `true_false`: `1` or `0`. `number`: a number. `select`: the stored value (the slug of the option).
- `relationship`: a list of `['_item' => '<id>']`, the `id` of sample items of a content (`'destacados' => [['_item' => 'producto-1'], ['_item' => 'producto-2']]`), in the order the design shows them. The engine loads the files with `items` first, so the items exist, and stores their IDs; an `_item` that is not found is left out. `check.mjs` reports an `_item` that is no item's `id`. If the design's entries have no sample items yet, write them first (see below).

- **Markers work anywhere in a value**: a single field, a repeater row, a group, a layout of a `flexible_content`, at any depth. The engine walks the whole value and replaces each marker; one that names something that does not exist is left out of its list or its keys. These are all of them:

| Marker | Stored value | Use it in |
|---|---|---|
| `['_file' => 'assets/…', 'alt' => '…']` | attachment ID | `image`, `file`, `gallery` |
| `['_page' => 'tarifario']` | relative path of that page | the `url` of a `link` |
| `['_item' => 'producto-1']` | ID of the sample item with that `id` | `relationship`, `post_object`, `page_link` |
| `['_post' => 'contacto', 'type' => 'page']` | ID of a page or post by slug (`type` is `page` by default) | `post_object`, `page_link`, `relationship` |
| `['_term' => 'especiales', 'taxonomy' => 'category', 'nombre' => 'Especiales']` | ID of the term; **created if it does not exist** (`nombre` optional, otherwise the slug) | `taxonomy`, anywhere, even inside a repeater row |
| `['_user' => 'admin']` | user ID by login or email | `user` |

  `'categorias' => [['categoria' => ['_term' => 'especiales', 'taxonomy' => 'category']], ['categoria' => ['_term' => 'noticias', 'taxonomy' => 'category']]]` fills a repeater of categories in that order. `check.mjs` reports a `_term` without `taxonomy`.
- `flexible_content`: a list of blocks, each with its layout name in `acf_fc_layout` (`[['acf_fc_layout' => 'texto', 'titulo' => '…'], ['acf_fc_layout' => 'foto', 'imagen' => ['_file' => 'assets/…']]]`). `google_map`: `['address' => '…', 'lat' => -12.04, 'lng' => -77.04, 'zoom' => 14]`. `range`: a number. `time_picker`: `'09:00'`. `date_time_picker`: `'2026-09-27 09:00:00'`. `tab`, `accordion`, `message` and `clone` have nothing to load (a clone loads like the field it clones).

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
