# What `generate.mjs` writes

Everything goes in the theme's `acf-json/`, one file per item, named by its key (`group_…json`). ACF loads these files by itself; the engine imports them into the database so the admin can edit them (ACF's own "Sync").

## Keys

`<kind>_` + the first 13 hex characters of `sha1("wp-acf:<kind>:<name>")`. They depend only on the name, so generating again never changes them and no stored content is lost. `field_` keys use the full spec name (`home_hero_slides.imagen`), `group_` the page slug, `post_type_` the content name, `taxonomy_` the taxonomy key and `ui_options_page_` the page slug. The engine rebuilds the same field keys in PHP (`<prefix>_acf_key()`): the seed files only name fields.

`modified` changes only when the content changes, which is what makes ACF offer "Sync".

## Field groups

One `group_*.json` per page spec with the state asked for (`--states`, default `aplicado`).

- `title`: the page's `Grupo ACF`.
- `fields`: one `group` field per section (`name` = the section's `Grupo`, for example `home_hero`), skipping sections with `Grupo: ninguno` or `Estado: descartado`. Its subfields are the table rows: `home_hero_titulo` is the subfield `titulo`, which ACF stores as `home_hero_titulo`.
- A row `a_b_items` of type `repeater` with rows `a_b_items.titulo`, `a_b_items.imagen` becomes a repeater with those subfields (nested repeaters work the same, one dot per level). A `group` row works the same way. The repeater row must exist before its subfields.
- `instructions`: the row's description (it keeps the "Recomendado: …" text). `required`: the row's "Requerido". Nothing else limits the editor: no `maxlength`, no `min`/`max` on repeaters, no image size limits.
- `label`: the field name humanized in Spanish ("titulo_linea_1" → "Título linea 1"); the admin can rename it.
- `location`, from the page's `Ubicación`:

| `Ubicación` in the spec | ACF location rule |
|---|---|
| `página de inicio (front page)` | `page_type == front_page` |
| `plantilla pages/template-x.php` | `page_template == pages/template-x.php` |
| `página de opciones: Ajustes del sitio` | `options_page == ajustes-del-sitio` (and the options page is generated) |
| `tipo de contenido = producto` | `post_type == producto` (`post` when the content's origin is `post`) |

Any other text is an error: fix the spec.

## Content types and taxonomies

From the "Contenido dinámico" table of `_shared.md`, only for contents used by a page that is being generated:

- Origin `cpt` → `post_type_*.json`: key = the content name (up to 20 characters, lowercase, digits, `_` or `-`), Spanish labels from the name (`producto` → Producto / Productos), `supports` title, editor and thumbnail, archive on, REST on, the taxonomies listed in the table. The editor can change labels, icon and supports in the ACF admin.
- Origin `post` (the blog) registers no content type; origin `woo` is ignored.
- Each taxonomy named between backticks in the "Taxonomías" cell → `taxonomy_*.json` (hierarchical when the cell says "jerárquica"; `category` and `post_tag` are native and are not generated). The terms listed after the colon are the example terms: the seed file creates them.

## Options pages

Every `página de opciones: <Name>` in a `Ubicación` produces `ui_options_page_*.json` (`page_title` = the name, `menu_slug` = its slug, save button and message in Spanish, data in `options`). "Ajustes del sitio" is the top menu; the others become its submenus. Read their values with `get_field('<group>', 'option')`.

## `inc/acf/paginas.php`

The WordPress pages the engine creates: every static page (`Tipo: estática`) with the state asked for. The page whose template is `front-page.php` is `inicio` and becomes the front page; the others use their slug and `pages/template-<slug>.php`. Lists, details and the options spec are not pages. The file is regenerated whole each time, never a conflict.

A page with `Padre: <slug>` gets `'padre' => '<slug>'` and is listed after its parent. The engine creates it under the parent (`/servicios/diseno-web/`); if a page with that slug already sits at the top level (made by an engine before 1.3.0), it is moved under the parent without touching its content, and the report says `ahora cuelga de <slug>`. A parent that is not generated with the same states (`--states`) or a cycle is exit code `4`.

## Conflicts

A file in `acf-json/` that already exists and is different (usually saved from the ACF admin, which rewrites it) is a conflict: ask the user, then `--overwrite <file>` or `--skip <file>`. `orphans` lists JSON files that no spec produces; they are never deleted.
