# ACF fields in the specs

The specs describe the fields; they do not create them. The ACF step later turns each row into a field and replaces the fixed text of the template with it. Write the rows so that step needs no guessing.

## Naming

- `<page>_<section>_<field>`, snake_case, Spanish, no accents or `ñ`: `home_hero_titulo`, `sobre_nosotros_equipo_miembros`.
- `<page>` is the spec file name with `-` turned into `_`. `check.mjs` rejects a field that does not start with it, and a name used twice.
- A repeated group (cards, FAQ items, team members) is one `repeater` named `<page>_<section>_<plural>` with its subfields written below it as `<repeater>.<subfield>`: `home_servicios_items.titulo`. The first item's text is the "valor actual"; mention the item count in the description.
- Organization: **one ACF field group per page** (the spec's `Grupo ACF`, e.g. "Inicio") with its location rule in `Ubicación` (`página de inicio (front page)`, `plantilla pages/template-nosotros.php`, `tipo de contenido = producto`). **Each section is a `group` field** named `<page>_<section>` (the section's `Grupo`, e.g. `home_hero`) and the rows of its table are its subfields.
- The names in the table are the full stored names: ACF saves the subfield `titulo` of the group `home_hero` as `home_hero_titulo`, so `get_field('home_hero')['titulo']` and `get_field('home_hero_titulo')` read the same value. `check.mjs` requires every field to start with its section's group. A section with no fields has `Grupo: ninguno`.
- Site-wide fields (header, footer, contact, social links) are the exception to the page prefix: their spec is `opciones` and they start with `opciones_` (`opciones_contacto_telefono`). They live on an options page and are read with `get_field(..., 'option')`. See `sitio-global.md`.
- This skill defines the structure (groups, names, types, descriptions, location); the ACF step only creates it from the spec.
- Names say what the content is, not how it looks: `titulo`, `bajada`, `imagen`, `boton`, never `texto_grande` or `azul`.

## Types

| In the design | Type |
|---|---|
| Short single-line text (title, label, button text alone) | `text` |
| Paragraph without formatting | `textarea` |
| Text with bold, lists or links inside | `wysiwyg` |
| Image (photo, illustration, icon file) | `image` |
| Button or link (text + URL + target together) | `link` |
| A bare URL (video, map) | `url` |
| Several images in a grid or slider | `gallery` |
| On/off switch (show a banner) | `true_false` |
| Repeated items | `repeater` |
| Number, email, date | `number`, `email`, `date_picker` |

Text with parts in another color is a normal `text`/`textarea`; the markers come from `wp-helper`'s text helper.

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
