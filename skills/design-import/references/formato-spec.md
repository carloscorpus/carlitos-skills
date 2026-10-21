# Spec format

`scripts/init.mjs --page` creates `specs/<slug>.md` with the page summary. You add one block per section. `scripts/check.mjs` validates exactly this shape, so keep the labels as written (Spanish, bold, with the colon inside the bold).

## Page summary (top of the file)

```markdown
# Página: Inicio

- **Resumen:** Presenta la empresa y lleva al visitante a pedir una cotización.
- **Fuente:** `index.html`
- **Plantilla:** `front-page.php`
- **Secciones (en orden):** hero, servicios, testimonios, contacto
- **Skills usadas:** wp-form (contacto), wp-helper
- **Notas de página:** h1 en el hero; título SEO "Inicio | Empresa"; sin meta descripción en el diseño
- **Estado:** pendiente
```

`Resumen`: what the page is about and what the visitor does there, in one or two sentences. `Skills usadas`: `ninguna` or the skills the sections delegate to.

## Section block

```markdown
## Sección: hero

- **Origen:** `index.html` líneas 14-39
- **Destino:** `template-parts/pages/home/hero.php`
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

- [ ] Un solo `h1` y los encabezados siguen el orden del diseño
- [ ] Sin estilos inline, `!important` ni manejadores `onclick`
- [ ] Imagen con `alt` y proporción fija (`aspect-ratio` + `object-cover`)
- [ ] Tokens del `_shared.md`, sin colores ni tamaños sueltos que ya tengan token
- [ ] Mismo aspecto que el original en escritorio y móvil
- [ ] `php -l` y `pnpm build` sin errores
```

## Rules

- `Origen` points to the file and lines of the design; `Destino` to the file(s) in the theme (comma-separated if there are several, relative to the theme root).
- `Skill`: `ninguna`, `wp-form`, `wp-modal`, `wp-accordion`, `wp-helper`. A section with a skill has no markup of yours: `Comportamiento` says what the skill must do (recipients, trigger, motion).
- `Estado` of each section: `pendiente`, `aprobado`, `descartado`, `aplicado`. The page's `Estado` and its row in `_index.md` must match.
- "Campos ACF" lists every text, image, link and repeated group of the section. A static section (a divider) has a header-only table. Value `—` for images and links.
- Criteria are verifiable by a command or by looking at the page. Copy the base set from `acceptance.md` and add the ones specific to the section. Never fewer than the base set.
- Elements kept out of the page (cookie banners, chat widgets) go in the summary's notes, not as blocks.
