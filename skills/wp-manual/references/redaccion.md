# Writing the drafts

The reader is the client: someone who edits the site once a month and has never seen ACF. Write in plain Spanish (tú), short sentences, the names the client uses ("Comunicados", "la portada"), never code names (`home_hero`, `repeater`, `h2`).

## Sources, in this order

1. The page spec `specs/<page>.md`: `Comportamiento` of each section says what is automatic (a list of the last posts, a counter, a slider that moves alone), what happens when a field is empty and where a button points.
2. The section template (`Destino` in the spec, or `template-parts/…` that calls `get_field('<section>')`): confirms what shows and what is hidden when empty.
3. The field in `acf-json`: type, required (`*`), its instructions.

Do not invent behavior: if neither the spec nor the template says it, do not write it.

## Summary of a section (`- **Resumen:**`)

One or two sentences: what the visitor sees and anything automatic. Example: «Lo primero que se ve: un carrusel de fotos con el título, un párrafo y dos botones. Las fotos cambian solas cada pocos segundos.»

## One sentence per number

What it is and where it shows, plus only what helps to edit it. Patterns:

| Field | Sentence |
|---|---|
| title / label | «Título de la sección.» / «Texto pequeño que va sobre el título.» |
| optional text | «Frase bajo el título. Opcional.» or «Si la dejas vacía, no se muestra.» (only if the template hides it) |
| textarea with line breaks | «Usa Enter para pasar a otra línea.» |
| image / gallery | «Foto de fondo. Recomendado: hasta 2000 px en el lado más largo, horizontal.» (`horizontal`, `vertical` or `cuadrada`, from the shape of the box in the design) |
| alt text | «Describe la foto en una frase. No se ve en la web: la leen los lectores de pantalla y los buscadores.» |
| link / button | «Botón: su texto y a dónde lleva.» (+ where it points today, if useful) |
| file | «El archivo (PDF). Para cambiarlo, quita el actual y sube el nuevo.» |
| list (repeater) | «Una fila por tarjeta.» (+ what adapts by itself, e.g. a counter) |
| field inside a list | what one row's field is |
| true/false | «Activa o desactiva…» |
| relationship / post object | «Elige qué … se muestran.» |

## Hard rules (check.mjs)

- **Never a number of characters**, never a fixed size, never "máximo". The client is never limited; the design adapts.
- **Images and galleries** always say `Recomendado: hasta 2000 px en el lado más largo` + orientation.
- **Highlight** (`*asteriscos*` bold, `|barras|` medium, other markers from `inc/helpers/text-styles.php` if the theme has them) **only** in the fields marked with highlight by the inventory (`highlight: true`: the template prints them with `<prefix>_highlight`). There, always explain it with an example: «Puedes resaltar palabras: entre **\*asteriscos\*** van en negrita y entre **\|barras\|** en un peso medio. Ejemplo: `*Terminal Portuario*`.» In a field without it, do not mention it.
- `**negrita**` and `` `código` `` are the only formatting the PDF understands. Markdown escapes (`*`, `|`, `~`) print the character itself: `***asteriscos***` shows ***asteriscos*** in bold, with its asterisks.

## Posts and custom post types (section `wordpress`)

The numbers `W1…W6` are WordPress' own boxes (title, content, excerpt, categories, tags, featured image). Explain each one that the screen has (`check.mjs` only requires the ones the screenshot shows). Say what the listing does with them (e.g. «La imagen destacada se ve en la tarjeta del listado»).

## Shared and common parts

- A chapter with several pages (same template) says so in "Cómo llegar": the user can open any of them.
- A section that repeats on many pages (from site options) is explained in the options chapter.
- **Do not repeat on every page** that the breadcrumbs are fixed or that the header and footer are edited in the site options: the PDF already says it once, in Reglas generales («Lo que no se edita en cada página»). `check.mjs` warns when the same note of "Cómo llegar" appears in 3 chapters or more.
