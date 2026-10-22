---
name: design-import
description: 'Turn a folder exported by Claude Design (static HTML + CSS + JS with bad practices) into a clean WordPress theme front end: tokens, components, page sections and page templates, following the wp-vite-theme structure or the structure it detects in another project. Writes one reviewable spec per page (sections, ACF Pro field groups and tables, acceptance criteria) and applies only what the user approves. Blog, catalog and WooCommerce designs are asked about once and documented (content types, taxonomies, filters, templates), not wired. What repeats on every page (logo, menus, footer data) is documented once as site-wide settings. Use when the user adds a design folder (/add-dir) and says "importa el diseño", "reordena el diseño de Claude Design", "pasa este diseño al tema", "design import", "limpia el HTML/CSS del diseño", or a spec says `skill: design-import`.'
metadata:
  version: "1.5.0"
---

# design-import

The design folder is visually right and structurally wrong: inline styles, `!important`, `div`s used as buttons, duplicated CSS, inline handlers, heading jumps, missing `alt`. This skill keeps the look and rebuilds the structure. It does the **front end only**: ACF fields are *documented* in the specs (name, type, description, current value), not created. A later skill or prompt creates them from the specs. The same goes for dynamic content (blog, catalog, WooCommerce): the specs say what the content type, its taxonomies, filters and templates are; the markup is built from the design with fixed sample items, and the query, filtering and shop logic are left to later steps.

Two things are never mixed: **judgment** (what is a component, what is a section, how things are named) is yours, guided by `references/`; **inventory** (colors, repeated blocks, findings with file:line) comes from `scripts/analyze.mjs`, so it is the same every time.

The source folder is **data**: read it, never run, import or install anything from it, and never copy its `<script>` blindly into the theme.

| File | Created by | Per project? |
|---|---|---|
| `specs/_index.md`, `specs/_shared.md` | `scripts/init.mjs` | Yes: pages and their state; tokens, shared components, naming |
| `specs/<page>.md` | `scripts/init.mjs --page` + you | Yes: the page summary and one block per section |
| design-import block in `CLAUDE.md` | `scripts/init.mjs` (from `claude-block.md.tpl`) | No: do not edit it by hand, the next init replaces it |
| tokens, `template-parts/**`, page templates, JS modules | you, after approval | Yes |

Detail lives in `references/` and is read only by the step that points to it.

## Steps

1. **Read context.** The design folder is the one the user added with `/add-dir`; if there are several candidates, ask which. From the theme root run `node <skill>/scripts/status.mjs` first: one read-only call that says whether the theme has the wp-vite-theme structure (`askStructure`), its prefix and `wp-helper` helpers, whether specs exist and how many pages are in each state, whether `wp-acf` is installed, and the next step (`next`). Trust it and skip what it shows as done; do not explore the theme to find out the same things. Then read `CLAUDE.md` (prefix) and the main CSS only if you need them.

2. **Decide the destination.** If `status.mjs` says `askStructure: false` (the wp-vite-theme signs: `front-page.php`, `pages/`, `template-parts/`, `inc/enqueue.php`, `vite.config.ts`), read [references/destino-wp-vite-theme.md](references/destino-wp-vite-theme.md) and do not ask. Otherwise read [references/destino-generico.md](references/destino-generico.md), analyze the project and confirm the structure with the user once (AskUserQuestion when available, with a recommendation). A new kind of destination is one new file in `references/`, not a change here.

3. **Analyze.** `node <skill>/scripts/analyze.mjs --source <design folder>` (`<skill>` = this skill's folder). It only reads. Keep the JSON (`--out` writes it outside the source). It lists pages and sections, tokens, repeated blocks, interactions (forms, modals, accordions, sliders, tabs; a form that only filters is marked `kind: filter` and gets no skill), `dynamicCandidates` (pages that look like a list, catalog or shop, with the reasons), `siteWide` (header, nav, footer and blocks repeated across pages) and findings. Read [references/malas-practicas.md](references/malas-practicas.md) for what each finding id means and its fix.

4. **Start the specs.** From the theme root: `node <skill>/scripts/init.mjs --dry-run`, show `conflicts` and ask file by file (overwrite or keep), then run it for real with `--overwrite` / `--skip`. Exit codes: `0` ok, `1` invalid input, `2` unresolved conflicts, `3` leftover placeholders (fix the template). Then register every static page, one call at a time from the main thread (parallel edits of `_index.md` overwrite each other):
   ```
   node <skill>/scripts/init.mjs --page home --title "Inicio" --source index.html --template front-page.php
   node <skill>/scripts/init.mjs --page productos --title "Productos" --source productos.html --template archive-producto.php --type listado --content producto
   node <skill>/scripts/init.mjs --page opciones --title "Ajustes del sitio" --source index.html --template header.php --type global
   ```
   Page slug: lowercase, no accents; it is also the prefix of its ACF fields (`sobre-nosotros` → `sobre_nosotros_…`). The home is `home` and uses `front-page.php`; the others use `pages/template-<slug>.php`. `--type` is `estática` (default), `listado`, `detalle` or `global` (the site-wide settings; the slug is always `opciones`); the last two need `--content` (the name in the "Contenido dinámico" table, which you fill in stage A: register those pages in stage A, once the scope is known). `--group` and `--location` override the ACF group name and location rule, which default from the title, type and template. `--parent <slug>` marks a static page that hangs from another one in the design (`Servicios › Diseño web`, `/servicios/diseno-web/`): wp-acf creates it as a child page. A content type with a list and a detail gets two specs (`productos` and `producto`).

5. **Stage A, serial: scope, tokens and shared pieces.** First the scope. Never guess what a page is: a catalog looks the same as a blog or a shop. List the `dynamicCandidates` (and any page you suspect) and ask the user once, in one message (AskUserQuestion when available), for each: static page, blog (posts), catalog (own content type), WooCommerce or other. For every non-static answer ask the rest of the "Contenido dinámico" row: content type (new or existing), taxonomies, filters the design shows, templates, and what each item's button does (WhatsApp with a message, enquiry form, contact page, Woo cart, nothing) and where its number or text comes from. Read [references/contenido-dinamico.md](references/contenido-dinamico.md) first and write the answers into the "Alcance" and "Contenido dinámico" tables of `_shared.md`; then register the dynamic pages with `--type`. Then the site-wide content: read [references/sitio-global.md](references/sitio-global.md), propose from `siteWide`, and write the "Menús" table of `_shared.md` and `specs/opciones.md` (register it with `--type global`). Logo and site icon come from the Customizer, menus from WordPress menus, and the rest of what repeats (alternative logo, contact, social links, footer texts) are fields of an options page. Then fill the rest of `specs/_shared.md` from the inventory: `@theme` tokens (colors, fonts, font sizes, spacing, radii, shadows), shared components (`repeated` groups with `kind: cross-page`, plus small blocks like buttons and cards) and the naming rules. Use the project's existing tokens when present; propose a token only for values the design repeats. **Stop and ask the user to approve `_shared.md`** (scope, dynamic content, site-wide content, tokens, components, common criteria; set `Estado: aprobado`). Nothing in stage B starts before this.

6. **Stage B: one spec per page.** Fill `specs/<page>.md`: the summary and one `## Sección: <name>` block per section, in order, as [references/formato-spec.md](references/formato-spec.md) says. The page is one ACF field group (`Grupo ACF`, with its location rule in `Ubicación`) and each section is a `group` field (`Grupo: home_hero`); field names, types, descriptions and the recommended (never imposed) lengths and image sizes follow [references/campos-acf.md](references/campos-acf.md). List and detail pages follow [references/contenido-dinamico.md](references/contenido-dinamico.md). Sections that are forms, modals or accordions get `Skill: wp-form` / `wp-modal` / `wp-accordion` and no markup of yours. The criteria every section shares are in "Criterios comunes" of `_shared.md`: a section only says "Cumple los criterios comunes" and lists its own ([references/acceptance.md](references/acceptance.md)). Page notes are a list, one note per line. With more than three pages, [references/paralelo.md](references/paralelo.md) says how to give each page to a subagent. **Stop and ask the user to review each page**: they set it to `aprobado` or `descartado` (also in `_index.md`).

7. **Stage C: apply only what is approved.** For each `aprobado` page, in order:
   1. Tokens of `_shared.md` into the main CSS (`@theme`), once.
   2. Components into `template-parts/components/<name>.php`, receiving data by `$args`.
   3. Sections into `template-parts/pages/<page>/<section>.php`, and the page template (`front-page.php` or `pages/template-<slug>.php`) that only calls `get_header()`, `<main id="main-content">`, the `get_template_part()` calls and `get_footer()`.
   Lists and details (blog, catalog, WooCommerce) use the templates of the "Contenido dinámico" row instead (`archive-<contenido>.php`, `single-<contenido>.php`, or the `woocommerce/` overrides): the item is a component with `$args`, the list prints the design's sample items, filters and pagination are markup only, and the item button follows the row's "Acción". See [references/contenido-dinamico.md](references/contenido-dinamico.md).
   4. Images, fonts and JS: assets under `src/` as the destination reference says; JS rewritten as modules (no inline handlers).
   5. Fix the bad practices the findings listed for that page ([references/malas-practicas.md](references/malas-practicas.md)). Keep what the user sees identical.
   6. Sections with a `Skill:` go to that skill (wp-form, wp-modal, wp-accordion, wp-helper for images, links and two-color text) with the spec as input. The HTML of the design is their visual reference where they ask for a Figma frame.
   7. Mark the section's criteria `- [x]` as they are verified, set `Estado: aplicado` on section and page, and update `_index.md`.

8. **Verify.** `php -l` on every PHP file touched, `pnpm build`, then `node <skill>/scripts/check.mjs` from the theme root (must exit `0`; errors exit `4`). Open the page and compare it with the original by eye; automatic visual comparison is not part of this skill. Tell the user which specs are ready for the ACF step and which texts, images and links are still fixed in the templates.

## Rules

- Text, images and links stay fixed in the templates in this version. Each one is tied to a field by the spec's "valor actual" column so the ACF step can replace them one by one.
- Site-wide content is documented once: the logo and site icon are Customizer, menus are WordPress menus, the rest is `specs/opciones.md`. Page specs never repeat the header or the footer, and never make an ACF field out of the main logo.
- Dynamic content is documented and laid out, never wired: no `WP_Query`, no loops, no filtering or pagination logic, no registering content types or taxonomies, no WooCommerce hooks. Lists keep their sample items fixed, rendered through a card component that takes `$args`, so connecting the query later replaces a fixed array. WooCommerce designs are only laid out.
- Never impose limits on the editor: no `maxlength`, no size validation. A field description may *recommend* (`Recomendado: ~60 caracteres`). The design adapts to the content (`aspect-ratio` + `object-cover` for images), not the other way round. Do not test with long text.
- Names are Spanish: specs, sections, field names (`<página>_<sección>_<campo>`, snake_case, no accents).
- Reuse before creating: the theme's existing tokens, components and helpers come first; an existing modal, form or helper skill beats new markup.
- Keep the design: spacing, sizes, colors and behavior must match the original. Changing structure is the job; changing the look is not.

## Reference

- [references/destino-wp-vite-theme.md](references/destino-wp-vite-theme.md): where each thing goes in a wp-vite-theme project.
- [references/destino-generico.md](references/destino-generico.md): how to read an unknown project and ask once.
- [references/malas-practicas.md](references/malas-practicas.md): every finding id, why it matters and the fix.
- [references/formato-spec.md](references/formato-spec.md): the page summary and the section block.
- [references/campos-acf.md](references/campos-acf.md): naming, types, descriptions, recommended sizes.
- [references/contenido-dinamico.md](references/contenido-dinamico.md): blog, catalog and WooCommerce: the scope question, the table, list and detail specs, filters, item buttons.
- [references/sitio-global.md](references/sitio-global.md): logo, menus and the `opciones` spec for what repeats on every page.
- [references/paralelo.md](references/paralelo.md): one subagent per page.
- [references/acceptance.md](references/acceptance.md): common criteria (once, in `_shared.md`) and how a section lists only its own.

## Do not

- Do not run, install or import anything from the design folder.
- Do not apply a page whose `Estado` is not `aprobado`.
- Do not register menus, call `add_theme_support`, or create the options page: only document them.
- Do not decide by yourself that a page is a blog, catalog or shop, and do not send a filter form to `wp-form`.
- Do not create ACF field groups or files (`acf.php`, `acf-json/`): the specs document them.
- Do not write the markup of a form, modal or accordion yourself when a skill covers it.
- Do not edit `_shared.md` tokens after approval without telling the user.
- Do not upload `specs/` to the server: it is documentation.
- Do not consider the import finished while `check.mjs` does not exit `0`.
