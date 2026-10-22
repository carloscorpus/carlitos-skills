# Spec format

`scripts/init.mjs --page` creates `specs/<slug>.md` with the page summary. You add one block per section. `scripts/check.mjs` validates exactly this shape, so keep the labels as written (Spanish, bold, with the colon inside the bold).

## Page summary (top of the file)

```markdown
# Página: Inicio

- **Resumen:** Presenta la empresa y lleva al visitante a pedir una cotización.
- **Fuente:** `index.html`
- **Plantilla:** `front-page.php`
- **Tipo:** estática
- **Contenido:** ninguno
- **Secciones (en orden):** hero, servicios, testimonios, contacto
- **Skills usadas:** wp-form (contacto), wp-helper
- **Grupo ACF:** Inicio
- **Ubicación:** página de inicio (front page)
- **Padre:** ninguno
- **Notas de página:**
  - h1 en el hero
  - título SEO "Inicio | Empresa"
  - sin meta descripción en el diseño
- **Estado:** pendiente
```

`Notas de página`: a list, one note per indented line under the label (`h1`, SEO title and description, `noindex`, animations, anything that affects the whole page). No acceptance criteria here: those are in `_shared.md`. `check.mjs` warns about a long single-line paragraph. `Resumen`: what the page is about and what the visitor does there, in one or two sentences. `Skills usadas`: `ninguna` or the skills the sections delegate to.

`Tipo`: `estática`, `listado`, `detalle` or `global` (only the `opciones` spec, for what repeats on every page). `Contenido`: `ninguno` for a static page; for a list or detail, the name of a row of the "Contenido dinámico" table in `_shared.md` (`check.mjs` verifies it). `Grupo ACF`: the name of the page's field group. `Ubicación`: its location rule, in plain words. `init.mjs --page` fills all four with defaults you adjust. A 1.0 spec without them still validates, with a warning.

`Padre` (optional, `ninguno` when missing): the slug of another static spec this page hangs from, when the design nests it (a "Diseño web" page under "Servicios", a breadcrumb `Servicios › Diseño web`, a URL like `/servicios/diseno-web/`). wp-acf creates it as a child page, so its address becomes `/servicios/diseno-web/`. Only static pages that are not the home; `check.mjs` rejects a missing parent, a parent that is not static and cycles. `init.mjs --page … --parent servicios` writes it.

## Filters (lists only)

A `listado` spec says how its list is filtered, so wp-query can wire it without asking again. `init.mjs --type listado` adds these labels (with defaults) and an empty table; fill them from the design:

```markdown
- **Al filtrar:** sin recargar
- **Paginación:** números
- **Por página:** 12
- **Filtros en móvil:** panel
- **Estado:** pendiente

**Filtros**

| Filtro | Tipo | Fuente | Varios | Conteo | Vista |
|---|---|---|---|---|---|
| `categoria` | taxonomía | `categoria_producto` | sí (o) | dinámico | checkbox |
| `precio` | rango | `producto_ficha_precio` | no | — | deslizador |
| `material` | opciones | `producto_ficha_material` | sí (y) | fijo | chips |
| `fecha` | fecha | `post_date` | — | — | select de año |
| `q` | búsqueda | título y contenido | — | — | campo |
| `orden` | orden | reciente, az, `producto_ficha_precio` asc, `producto_ficha_precio` desc | — | — | select |
```

- `Al filtrar`: `sin recargar` (results change as soon as a filter changes) or `botón aplicar` (only when the visitor presses the button). `Paginación`: `números`, `cargar más`, `infinito` or `ninguna`. `Por página`: a number. `Filtros en móvil`: `igual` or `panel` (a drawer; the section says `Skill: wp-modal`).
- `Filtro`: the name in the URL (`?categoria=sillas,mesas&precio=100-300`), lowercase. Not a WordPress query var (`s`, `p`, `page`, `cat`, `tag`, `year`, `order`, `orderby`…), nor a taxonomy or content name: the search is `q`.
- `Tipo` and `Fuente`:

| Tipo | Fuente | Notes |
|---|---|---|
| `taxonomía` | a taxonomy of the content's row in "Contenido dinámico" (`category`, `post_tag` for the blog) | Hierarchical terms show nested when the design does. |
| `rango` | a `number` or `range` field of the detail spec | Min–max: slider or two inputs. |
| `opciones` | a `select`, `checkbox`, `radio`, `button_group` or `true_false` field of the detail spec | The options are the field's `Opciones: a, b, c`. |
| `fecha` | `post_date` or a `date_picker` field | Year, month or a range, as the design shows. |
| `búsqueda` | free text (what it searches) | One per list. |
| `orden` | the options, comma separated: `reciente`, `antiguo`, `az`, `za`, `relevancia` or `` `campo` asc/desc `` | One per list. |

- `Varios`: `no`, `sí (o)` (any of the chosen values) or `sí (y)` (all of them). Only `taxonomía` and `opciones`; a `true_false` field is always `no`. Different filters always combine with "and".
- `Conteo`: `ninguno`, `fijo` (the total of each option) or `dinámico` (how many results each option would give with the other filters applied). Only `taxonomía` and `opciones`; follow the design (`Sillas (12)`).
- `Vista`: how the design shows it (checkbox, radio, select, chips, slider, two inputs, field). Required.

`check.mjs` validates all of it against `_shared.md` and the detail spec. A list without the table only warns (specs written before 1.6.0).

## Section block

```markdown
## Sección: hero

- **Origen:** `index.html` líneas 14-39
- **Destino:** `template-parts/pages/home/hero.php`
- **Grupo:** `home_hero`
- **Skill:** ninguna
- **Comportamiento:** el botón lleva a la sección contacto; la imagen se recorta con `object-cover` (relación 16:9); en móvil el texto va sobre la imagen
- **Estado:** pendiente

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `home_hero_titulo` | text | Título principal de la portada. Se muestra en grande sobre la imagen. Recomendado: ~50 caracteres | Hacemos crecer tu negocio | sí |
| `home_hero_imagen` | image | Imagen de fondo del hero. Se recorta para llenar el bloque. Recomendado: 1920 × 1080 px (16:9), mínimo 1280 px de ancho | — | sí |
| `home_hero_boton` | link | Botón principal: texto y destino | Cotizar | no |

**Criterios de aceptación**

- [ ] Cumple los criterios comunes de `_shared.md`
- [ ] La imagen se recorta con `object-cover` sin deformarse en móvil
```

## Rules

- `Origen` points to the file and lines of the design; `Destino` to the file(s) in the theme (comma-separated if there are several, relative to the theme root).
- `Grupo`: the `group` field of the section (`<page>_<section>`, unique in the theme) or `ninguno` when the section has no fields. Every field of the table starts with it.
- `Skill`: `ninguna`, `wp-form`, `wp-modal`, `wp-accordion`, `wp-helper`. A section with a skill has no markup of yours: `Comportamiento` says what the skill must do (recipients, trigger, motion).
- `ACF` (optional, written by `wp-acf`, not by you): `pendiente` or `conectado`. `conectado` means the section template reads its fields from ACF and the text now lives in the initial load (`inc/acf/seed/`), so `check.mjs` stops comparing "valor actual" with the template for that section.
- `Estado` of each section: `pendiente`, `aprobado`, `descartado`, `aplicado`. The page's `Estado` and its row in `_index.md` must match.
- "Campos ACF" lists every text, image, link and repeated group of the section. A static section (a divider) has a header-only table. Value `—` for images and links.
- Criteria are verifiable by a command or by looking at the page. The common set is written once in "Criterios comunes" of `_shared.md`; the section starts with the line "Cumple los criterios comunes de `_shared.md`" and adds only its own. Do not copy the common set: `check.mjs` warns when three or more are repeated.
- Elements kept out of the page (cookie banners, chat widgets) go in the summary's notes, not as blocks.
