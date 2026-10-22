# Acceptance criteria

The criteria every section shares live **once**, in the "Criterios comunes" section of `specs/_shared.md` (the template brings them). Do not copy them into each section: a section declares them with one line and lists only its own. Mark `- [x]` only after checking it.

## In a section

```markdown
**Criterios de aceptación**

- [ ] Cumple los criterios comunes de `_shared.md`
- [ ] El slider se mueve con flechas y teclado, y se pausa con `prefers-reduced-motion`
- [ ] La primera imagen carga de inmediato; las demás con `lazy`
```

The first line is always there: it is the check-off of the common set (base set plus the lines of "Según lo que tenga la sección" that apply). The rest are specific to the section: what only this section has (a behavior, a count, a field that must be hidden when empty). A section without anything specific keeps only the first line.

## What `_shared.md` holds

- **Todas las secciones:** one `h1` and ordered headings, no inline styles or `!important`, right controls, images with `alt`, tokens instead of loose values, same look as the original, escaped PHP, `php -l` and `pnpm build`.
- **Según lo que tenga la sección:** images (size or ratio, lazy), links (real destinations, safe `rel`), JS behavior (modules, keyboard, reduced motion), skills (their own `references/acceptance.md`), repeated blocks (one component with `$args`).
- **Cada página (una vez, al final):** `check.mjs` exits `0`, internal links point to the theme's pages, `header.php` and `footer.php` are not repeated in the page template.

## What is specific, by kind of section

- Listado o detalle (blog, catálogo, WooCommerce): the card is a component with `$args`; filters are `label` markup and do not use `wp-form`; pagination is a `<nav aria-label="Paginación">`; the item button follows the "Acción" of `_shared.md`; no `WP_Query` and no Woo logic.
- Header, footer or block shared by every page (spec `opciones`): the main logo comes from Site Identity, menus are menu locations, fixed texts match "valor actual" and no page repeats the header or the footer.
- Component: documented in `_shared.md` with its arguments and where it is used.

`check.mjs` warns when a section repeats three or more common criteria instead of pointing to them. Specs from before 1.3.0 (with the full set in each section) still pass.
