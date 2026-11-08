# ACF fields in the specs

The specs describe the fields; they do not create them. The ACF step later turns each row into a field and replaces the fixed text of the template with it. Write the rows so that step needs no guessing.

## Naming

- `<page>_<section>_<field>`, snake_case, Spanish, no accents or `ñ`: `home_hero_titulo`, `sobre_nosotros_equipo_miembros`.
- `<page>` is the spec file name with `-` turned into `_`. `check.mjs` rejects a field that does not start with it, and a name used twice.
- A repeated group (cards, FAQ items, team members) is one `repeater` named `<page>_<section>_<plural>` with its subfields written below it as `<repeater>.<subfield>`: `home_servicios_items.titulo`. The first item's text is the "valor actual"; mention the item count in the description.
- Organization: **one ACF field group per page** (the spec's `Grupo ACF`, e.g. "Inicio") with its location rule in `Ubicación` (`página de inicio (front page)`, `página de entradas (posts page)` for the blog list, `plantilla pages/template-nosotros.php`, `tipo de contenido = producto`). **Each section is a `group` field** named `<page>_<section>` (the section's `Grupo`, e.g. `home_hero`) and the rows of its table are its subfields.
- The names in the table are the full stored names: ACF saves the subfield `titulo` of the group `home_hero` as `home_hero_titulo`, so `get_field('home_hero')['titulo']` and `get_field('home_hero_titulo')` read the same value. `check.mjs` requires every field to start with its section's group. A section with no fields has `Grupo: ninguno`.
- Site-wide fields (header, footer, contact, social links) are the exception to the page prefix: their spec is `opciones` and they start with `opciones_` (`opciones_contacto_telefono`). They live on an options page and are read with `get_field(..., 'option')`. See `sitio-global.md`.
- This skill defines the structure (groups, names, types, descriptions, location); the ACF step only creates it from the spec.
- Names say what the content is, not how it looks: `titulo`, `bajada`, `imagen`, `boton`, never `texto_grande` or `azul`.

## Native first: what is not a field

Before writing a row, ask: **does WordPress (or WooCommerce) already store and edit this?** If yes, it is not an ACF field: the template reads it with the native function and the spec says so in `Comportamiento`. A duplicated field gives the editor two places to change the same thing, and one of them is ignored.

| In the design | WordPress already has | Read with | Spec |
|---|---|---|---|
| Title of an entry (post, own content type, detail page) | Title | `get_the_title()` | no field |
| Body of an entry | Editor | `the_content()` | no field (`wysiwyg` only for an extra block, not the main body) |
| Main image of an entry (card, hero of a detail) | Featured image | `get_the_post_thumbnail()` | no field |
| Summary, date, author (blog only: an own content type has no excerpt) | Excerpt, date, author | `get_the_excerpt()`, `get_the_date()`, `get_the_author()` | no field in a blog; in an own content type a summary is a field |
| Categories and tags of an entry | Taxonomy and its box in the editor | `get_the_terms()` | declared in "Contenido dinámico", no field |
| Logo, site icon, site name | Customizer > Site Identity | `the_custom_logo()`, `get_bloginfo()` | no field (the alternative logo is an options field) |
| Menus | Appearance > Menus | `wp_nav_menu()` | "Menús" table, no field |
| Product price, stock, SKU, add to cart (`Origen: woo`) | WooCommerce | its own functions | no field |

A field is right when WordPress has **no** place for it: texts of a page section, the extra data of an item (`producto_ficha_precio` in a catalog that is not WooCommerce), site data from the options page, and choosing something inside a section (the featured products of the home).

Page titles are the exception that is allowed: the `h1` of a static page's hero is part of the design and may differ from the WordPress title, so it is a field.

`check.mjs` warns when a row looks like one of the first rows of this table (a `titulo` or `imagen_destacada` in a detail, a `logo` in `opciones`, a WooCommerce `precio`). It is a warning, not an error: if the field really is something else, rename it so it says what it is (`logo_alternativo`, `titulo_corto`).

## Types

| In the design | Type |
|---|---|
| Short single-line text (title, label, button text alone) | `text` |
| Paragraph without formatting | `textarea` |
| Title or paragraph split into lines with `<br>` | one `textarea` (never one field per line) |
| Text with bold, lists or links inside | `wysiwyg` |
| Image (photo, illustration, icon file) | `image` |
| Button or link (text + URL + target together) | `link` |
| A bare URL (video, map) | `url` |
| Several images in a grid or slider | `gallery` |
| On/off switch (show a banner) | `true_false` |
| Repeated items | `repeater` |
| Number, email, date | `number`, `email`, `date_picker` |

Text with parts in another color is a normal `text`/`textarea`; the markers come from `wp-helper`'s text helper. Every template or component that prints it uses `<prefix>_highlight()`, never rules of its own (see "Files" in `destino-wp-vite-theme.md`): the same text must look the same in one line or in several, in a `text` or in a `textarea`.

### Text in several lines

A title or paragraph the design splits with `<br>` is **one** `textarea`, not `…_linea_1`, `…_linea_2`. Write each break as `<br>` in "valor actual"; the editor will press Enter in the admin and `wp-helper` prints it as a line break. A part in another color keeps its marker inside its line:

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `home_hero_titulo` | textarea | Título principal de la portada, en dos líneas. Usa Enter para pasar a otra línea. Recomendado: ~40 caracteres | Terminal Portuario<br>del |Callao| | sí |

A `<br>` the design shows only on some screens (a class such as `hidden md:block`) is a break on every screen too: write it as `<br>` and mobile shows the same lines as desktop. A part with its own color class is written with that style's marker; if the style does not exist yet, add it with `wp-helper` without asking (the class from the design, the name without `text-`, the first free marker). `check.mjs` warns when a section has `_linea_1`, `_linea_2`… fields.

## Description

Direct and clear, in this order: what the field is, where it shows, and the recommendation if it has one. One to three short sentences, Spanish.

> Título principal de la portada. Se muestra en grande sobre la imagen. Recomendado: ~50 caracteres.

## Recommendations, never limits

The user must never be blocked: no `maxlength`, no size validation, no "máximo". The description may recommend.

- **Text:** `Recomendado: ~N caracteres`, where N is the current text's length × 1.5, rounded up to a multiple of 5 (titles) or 10 (paragraphs).
- **Image:** `Recomendado: W × H px (A:B)`, where the ratio is the design box's and W is twice the box width at the widest breakpoint (sharp on dense screens); add `mínimo X px de ancho` = the box width. The image adapts to the design: the template sets `aspect-ratio` and `object-cover`, so another size or ratio crops, it never changes the layout.
- **Optional parts** (subtitle, secondary button): `Requerido: no`, and say in `Comportamiento` that the template hides the part when the field is empty (applied in the ACF step; in this version the text stays fixed).
- Do not test the layout with long text. Make the container flexible (no fixed heights) and stop there.

## Fixed text now, field later

In this version the text is printed as it is in the template. The "valor actual" column must be the exact text (whitespace aside) so `check.mjs` can confirm it is in the destination and the ACF step can find it. Escape `|` as `\|` inside a table cell.
