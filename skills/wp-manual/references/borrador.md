# Draft format (`specs/manual/<chapter>.md`)

`init.mjs` writes the skeleton; Claude replaces every `PENDIENTE`; the user reviews. Running `init.mjs` again keeps the texts and adds what is new (a new field gets `PENDIENTE`; a removed one is reported by `check.mjs`).

```markdown
# Capítulo: Inicio

- **Tipo:** página
- **Dónde:** Páginas › Inicio
- **Páginas:** Inicio
- **Grupo ACF:** group_6656ef53fa88e (Inicio)
- **Estado:** pendiente

## Cómo llegar

1. En el menú de la izquierda entra a **Páginas**.
2. Busca **Inicio** en la lista y haz clic en **Editar** (aparece al pasar el mouse sobre el nombre).
3. Baja: debajo del editor está cada sección, en el mismo orden que en la web.

> Nota opcional: se muestra destacada en la página "Dónde se edita".

## Sección: home_hero · Portada principal (Hero)

- **Resumen:** Lo primero que se ve: …
- **Web:** #hero

- **1** Título línea 1 * — Primera línea del título grande.
- **7** Slides * — Fotos del carrusel. Agrega, quita u ordena filas.
- **7.1** Imagen * — Foto del carrusel. Recomendado: hasta 2000 px en el lado más largo, horizontal.
```

- `## Sección: <name> · <title>`: `<name>` is the ACF field name of the section (do not change it); the title after `·` is free (it is the one printed in the PDF).
- `- **Web:**` is optional: a CSS selector for the web reference when the automatic one fails. Without it, a page section is looked up by its template (the root tag of the PHP that calls `get_field('<section>')`: its `id`, a `data-` attribute or a class), and only if that is not one single element on the page, by position (the n-th `section` of `<main>` that is not inside another section, even when wrapped in a `div`). When two sections land on the same element, `capture.mjs` warns.
- `- **N** Label — text`: the number and label come from ACF (the label is only a guide; the PDF prints the ACF label). Only the text after ` — ` is yours. `*` after the label means required.
- Chapter ids: `opciones-<menu_slug>`, `pagina-<page>`, `contenido-<post_type>`, `sitio`, `extra-<name>`.
- `- **Incluir:** no` in the header (under `Estado`) leaves that chapter out of the manual: `check.mjs` skips it, `capture.mjs` does not capture it, the PDF does not print it and the report says «omitido». `init.mjs` keeps it when it regenerates the draft. Use it when the client does not manage a part (for example «Menús y logo»).
- Contents (`contenido-*`) start with `## Sección: wordpress · Campos de WordPress` and the numbers `W1…W6`.
- `## Sección` of the `sitio` chapter (`menus`, `identidad`) has only a summary, already written (fixed WordPress screens).
- `_manual.md` holds `Cliente`, `Razón social`, `Dirección del panel` (the real domain + `/wp-admin`) and `Fecha`. `Fecha` and `Razón social` are optional: `init.mjs` leaves the date empty (ask the user), and an empty value is not printed on the cover.

## Extra chapters (`extra-<name>.md`)

Hand-written chapters for what does not come from ACF (for example the saved submissions of `wp-form`). Same format, with `- **Tipo:** extra`; they go at the end of the manual, in alphabetical order of the file. Their sections and numbers come from the draft itself (any number, `1`, `2`, `2.1`…; nothing is checked against ACF). Each section says where its screenshot comes from:

```markdown
# Capítulo: Envíos de formularios

- **Tipo:** extra
- **Dónde:** Envíos
- **Admin:** edit.php?post_type=copam_envio
- **Estado:** pendiente

## Cómo llegar

1. En el menú de la izquierda entra a **Envíos**.

## Sección: listado · Listado de envíos

- **Resumen:** …
- **Admin:** edit.php?post_type=copam_envio
- **Selector:** #posts-filter

- **1** Envío — …

## Sección: detalle · Ver un envío

- **Resumen:** …
- **Admin:** edit.php?post_type=copam_envio#primero
- **Selector:** #poststuff

## Sección: notas · Qué conviene saber

- **Resumen:** …

- **1** Archivos adjuntos — …
```

- Header `- **Admin:**`: admin screen for the "Dónde se edita" page (`<chapter>-llegar.png`).
- Section `- **Admin:**`: admin URL (relative to `/wp-admin/`) to capture; `#primero` at the end opens the first item of that list. `- **Selector:**` captures only that element (else the whole screen).
- Section `- **Captura:** <file>`: an image you put in `specs/manual/capturas/` yourself (wins over `Admin`).
- A section with neither prints as a text-only page.
- When the theme saves `wp-form` submissions (`inc/forms-entries.php`), `init.mjs` writes `extra-envios.md` already drafted (general texts: adjust them to the project's forms). Only administrators see «Envíos»: with an Editor in `.env.manual`, `capture.mjs` warns; use an administrator for that run or `Captura:`.
