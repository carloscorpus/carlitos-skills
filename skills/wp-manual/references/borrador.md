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
2. Abre **Inicio**.
3. Baja: debajo del editor está cada sección, en el mismo orden que en la web.

> Nota opcional: se muestra destacada en la página "Dónde se edita".

## Sección: home_hero · Portada principal (Hero)

- **Resumen:** Lo primero que se ve: …
- **Web:** main > section:nth-of-type(1)

- **1** Título línea 1 * — Primera línea del título grande.
- **7** Slides * — Fotos del carrusel. Agrega, quita u ordena filas.
- **7.1** Imagen * — Foto del carrusel. Recomendado: hasta 2000 px en el lado más largo, horizontal.
```

- `## Sección: <name> · <title>`: `<name>` is the ACF field name of the section (do not change it); the title after `·` is free (it is the one printed in the PDF).
- `- **Web:**` is optional: a CSS selector for the web reference when the automatic one fails (pages use `main > section` in order).
- `- **N** Label — text`: the number and label come from ACF (the label is only a guide; the PDF prints the ACF label). Only the text after ` — ` is yours. `*` after the label means required.
- Chapter ids: `opciones-<menu_slug>`, `pagina-<page>`, `contenido-<post_type>`, `sitio`.
- Contents (`contenido-*`) start with `## Sección: wordpress · Campos de WordPress` and the numbers `W1…W6`.
- `## Sección` of the `sitio` chapter (`menus`, `identidad`) has only a summary, already written (fixed WordPress screens).
- `_manual.md` holds `Cliente`, `Razón social`, `Dirección del panel` (the real domain + `/wp-admin`) and `Fecha`.
