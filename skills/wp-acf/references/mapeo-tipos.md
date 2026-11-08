# Spec type to ACF field

The type column of a spec's "Campos ACF" table is the ACF field type. `generate.mjs` supports these:

| Type | Generated as | Notes |
|---|---|---|
| `text`, `textarea`, `email`, `url`, `number` | the same type | `textarea` has 4 rows and `new_lines` empty (the break is printed by `<prefix>_highlight()`); with `<br>` in "valor actual" its instructions end with "Usa Enter para pasar a otra línea."; no `maxlength`, `min` or `max` |
| `wysiwyg` | tabs all, full toolbar, media upload on | legal text and long prose |
| `image` | return `array`, library all, preview medium | the sizes stay in the instructions |
| `file` | return `array`, library all | uploaded PDFs and downloads; use `link` only for documents hosted elsewhere |
| `gallery` | return `array`, append | |
| `link` | return `array` | `title`, `url`, `target`; print with `<prefix>_link()` |
| `true_false` | switch (`ui`) | the "valor actual" `sí`/`no` is the initial state |
| `select`, `radio`, `checkbox`, `button_group` | return `value` | the description ends with `Opciones: a, b, c`; values are the slug of each label |
| `oembed`, `date_picker`, `color_picker` | the same type | date format `d/m/Y` |
| `repeater` | block layout, button "Añadir fila" | rows `name.sub` are its subfields; `min`/`max` of rows only if its description says `Mínimo: n` / `Máximo: n`, otherwise none |
| `group` | block layout | rows `name.sub` are its subfields |
| `relationship` | return `id`, only published entries, search filter (plus taxonomy when the content has one, post type when it names several) | the description says which content it picks from: `Contenido: producto` (or `Contenidos: producto, post`), each a row of "Contenido dinámico" in `_shared.md` (`cpt` = its key, `post` = `post`, `woo` = `product`); `Máximo: n` / `Mínimo: n` limit how many entries are chosen. Missing or unknown content is an error |
| `taxonomy` | one term picked from a taxonomy that already exists (nothing is registered), single select, returns the term `id`, does not assign the term to any post | the description says which one: `Taxonomía: category` (native), `post_tag`, `product_cat`, `product_tag` or a taxonomy of "Contenido dinámico". For several terms in a chosen order, use a `repeater` with one `taxonomy` inside (rows are dragged to reorder). Missing or unknown taxonomy is an error |
| `post_object` | one published entry, searchable select, returns the `id` | `Contenido: producto` as in `relationship`; also `page` and `post` (the native ones). Without `Contenido:` it picks among pages. `Múltiple` in the description allows several. Empty is allowed unless `Requerido: sí` |
| `page_link` | one published entry (archives included), returns its URL | same `Contenido:` and `Múltiple` as `post_object`; without `Contenido:` it picks among pages |
| `user` | returns the user `id` | `Rol: editor, author` limits the roles; `Múltiple` allows several |
| `google_map` | center Lima, zoom 14 | needs a Google Maps API key set in the site, not in the theme |
| `range` | slider, step 1 | `Mínimo: n` / `Máximo: n` (maximum 100 if not written) |
| `password`, `time_picker`, `date_time_picker` | the same type | time `H:i`, date and time `d/m/Y H:i` |
| `message`, `tab`, `accordion` | layout only, they hold no value | `message` shows the description as its text; `tab` and `accordion` split the editor's screen (their name is only a label) |
| `flexible_content` | blocks the editor adds in the order they want, button "Añadir bloque" | each layout is a row `name.<layout>` of type `group` and its subfields are `name.<layout>.<sub>`; `Mínimo: n` / `Máximo: n` limit the blocks |
| `clone` | seamless clone of one field or group | `Clonar: home_hero_boton` (the name of a field or a section group of any spec). Missing or unknown is an error |

An unknown type, or one ACF does not have, stops `generate.mjs` with a clear error.

## Naming

- Section group: the `Grupo` of the section (`home_hero`), a `group` field named exactly that.
- Subfield name: the row name without the `<group>_` prefix (`home_hero_titulo` → `titulo`). With a parent: the part after the last dot (`home_hero_slides.imagen` → `imagen`).
- Stored name: ACF stores a subfield of a group as `<group>_<sub>`, which is the row name. Read the section with one `get_field('<group>')`.
- Options pages: `opciones_<area>` groups, read with `get_field('<group>', 'option')`.

## Required and recommended

`Requerido: sí` → `required: 1`. The "Recomendado: …" text of the description is only shown to the editor as instructions; nothing validates it.
