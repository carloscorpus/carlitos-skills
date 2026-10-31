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

Anything else (`post_object`, `relationship`, `taxonomy`, `page_link`, `user`, `google_map`, `tab`, `accordion`, `flexible_content`, `clone`, `message`, `password`, time pickers) stops `generate.mjs` with a clear error. Do not work around it in the JSON: either change the spec to a supported type or ask the user to add that field by hand in the ACF admin and tell them the regenerated group will conflict with it.

## Naming

- Section group: the `Grupo` of the section (`home_hero`), a `group` field named exactly that.
- Subfield name: the row name without the `<group>_` prefix (`home_hero_titulo` → `titulo`). With a parent: the part after the last dot (`home_hero_slides.imagen` → `imagen`).
- Stored name: ACF stores a subfield of a group as `<group>_<sub>`, which is the row name. Read the section with one `get_field('<group>')`.
- Options pages: `opciones_<area>` groups, read with `get_field('<group>', 'option')`.

## Required and recommended

`Requerido: sí` → `required: 1`. The "Recomendado: …" text of the description is only shown to the editor as instructions; nothing validates it.
