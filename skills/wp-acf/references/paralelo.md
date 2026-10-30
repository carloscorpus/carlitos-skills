# One subagent per page

Step 5 of the flow (connecting each page's templates) can run in parallel once the shared work is done.

## What the main thread does first

1. `install.mjs` and `generate.mjs` (the JSON is already in `acf-json/`).
2. `inc/acf/sitio.php`, `inc/setup.php` (menu locations) and the `opciones` spec (header, footer, top notice and `inc/acf/seed/opciones.php`).
3. `node <skill>/scripts/check.mjs` passes for the JSON part.

## Split

- 3 pages or fewer: do it in the main thread.
- More: one subagent per page, 3 or 4 at a time. A page is a spec: `home`, `nosotros`, `contacto`. The `opciones` spec and the sample items of a content type are not given to subagents.
- Each subagent edits **only**: `template-parts/pages/<page>/*.php` (and the page template if it still holds fixed text), `inc/acf/seed/<page>.php` and its own `specs/<page>.md` (only the `ACF:` line of each section).
- Never: `functions.php`, `inc/setup.php`, `inc/acf/sitio.php`, `inc/acf/runner.php`, `inc/acf/paginas.php`, `acf-json/`, the main CSS, `_index.md`, `_shared.md`, components shared with other pages. If a component needs a change, the subagent reports it.

## Brief

> Connect the page `<slug>` of the theme to ACF.
> Read `<skill>/references/plantillas.md`, `carga-contenido.md` and `mapeo-tipos.md`, `specs/<slug>.md` and the templates named in each section's `Destino`. The JSON for this page is already generated: the groups are in `acf-json/` and the section group names are in the spec (`Grupo`).
> For each section with `Estado: aplicado`: move every text, image, file and link of its template into `inc/acf/seed/<slug>.php` (`'page' => '<slug>'`, one entry per section group, subfield names as keys, `_file` and `_page` markers), replace them in the template with `get_field('<group>')` and the `wp-helper` helpers (every `textarea` through `<prefix>_highlight()`, so its line breaks show), keep the markup and classes exactly as they were, and set `**ACF:** conectado` in the section of the spec.
> Do not invent fields: if content in the template has no row in the section's table, report it. Do not edit shared files. Run `node <skill>/scripts/check.mjs --page <slug>` and `php -l` on every file you wrote (say so if `php` is not available).
> Answer with: the sections connected, the check result, content without a field, and anything you could not decide.

Replace the paths. The main thread, once all subagents answer, runs `check.mjs` for the whole theme and `design-import`'s `check.mjs`.
