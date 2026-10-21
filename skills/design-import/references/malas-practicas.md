# Bad practices: finding → fix

`analyze.mjs` reports each finding with an `id`, a severity and file:line. This is what each one means and what to do. The look never changes: only the structure.

## HTML

| id | Why it matters | Fix |
|---|---|---|
| `inline-style` | Styles scattered in markup, no tokens, no responsive variants | Move to Tailwind classes using the `_shared.md` tokens; an exact value that appears once becomes an arbitrary value |
| `inline-style-tag` | CSS inside the page, loaded on every request | Move to `src/css/input.css` (`@layer components` only if it cannot be utilities) |
| `inline-script` | Code in markup, no caching, no module scope | Move to `src/js/modules/<name>.js` |
| `inline-handler` | `onclick=` couples markup to global functions | `addEventListener` in a module, selecting by a `data-` attribute or a class |
| `clickable-non-interactive` | A `div` with a click is invisible to keyboard and screen readers | `<button type="button">` for an action, `<a href>` for navigation; keep the classes |
| `link-placeholder` | `href="#"` goes nowhere | Real URL if the design implies one; `<button>` if it is an action; otherwise ask |
| `img-no-alt` | No text alternative | `alt` describing the image when it carries meaning; `alt=""` when decorative |
| `input-no-label` | Field without an accessible name | Visible `<label for>`; `aria-label` only if the design has no visible label |
| `heading-skip` | `h2` → `h4` breaks the outline | Fix the level in the markup; change the size with classes, never with the tag |
| `h1-count` | Zero or several `h1` | Exactly one `h1` per page, the page's main title |
| `html-no-lang`, `no-viewport`, `no-title` | Page-level basics | In WordPress `header.php` and `wp_head()` provide them: confirm they exist, do not copy them from the design |
| `deep-nesting` | "div soup" | Flatten wrappers that only add a class; use `section`, `article`, `nav`, `ul > li` where they fit |
| `broken-reference` | The export points to a file it does not contain | Ask the user for the file or mark the asset as missing in the spec |

Also fix without a finding: layout built with `<br>` or empty elements for spacing, text inside images, `<b>`/`<i>` for emphasis (`strong`/`em`), lists made of `div`s, tables used for layout, `target="_blank"` without `rel` (the `wp-helper` links helper handles ACF links).

## CSS

| id | Why it matters | Fix |
|---|---|---|
| `important` | Specificity war | Remove it and order or simplify the selectors; utilities do not need it |
| `id-selector` | High specificity, not reusable | Classes |
| `deep-selector` | CSS coupled to the DOM shape | One class per element |
| `fixed-height` | Breaks with longer text or small screens | `min-height`, `aspect-ratio` or nothing; keep the same look at the design's width |
| `duplicate-declarations` | Several selectors with the same block | One class or a token |

Also: `px` font sizes and spacings that match the scale become `rem` tokens; media queries by device (`@media (max-width: 768px)`) become the project's breakpoints only if they match exactly, otherwise keep the exact value; `position: absolute` used for flow layout becomes flex or grid.

## JS

| id | Why it matters | Fix |
|---|---|---|
| `jquery` | A dependency for a few DOM calls | Native JS in a module |
| `document-write`, `eval` | Blocking and unsafe | Remove |
| `inner-html` | XSS if the content is not yours | `textContent`, `append()` or a `<template>` |
| `alert` | Blocks the page | Message in the UI |
| `console-log` | Left-over debugging | Remove |
| `var-declaration` | Function scope surprises | `const` / `let` |
| `global-function` | Called from inline handlers | Module functions, wired with `addEventListener` |

If the design's script does something the browser does natively (accordion → `<details>`, modal → `<dialog>`), do not port it: use the skill that covers it (`wp-modal`, `wp-accordion`) or the native element.

## Do not "fix" by changing the design

If a fix would change what the user sees (a spacing that matches no token, a font size between two steps), keep the exact value and list it in the section's "Comportamiento" so the user decides.

## Not a bad practice: filters

A `<form>` whose controls are only selects, checkboxes, radios or search fields and that uses `method="get"` is a filter, not a message form (`analyze.mjs` marks it `kind: filter` and suggests no skill). It stays as labelled markup; never send it to `wp-form`. See `contenido-dinamico.md`.
