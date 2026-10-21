---
name: design-import
description: 'Turn a folder exported by Claude Design (static HTML + CSS + JS with bad practices) into a clean WordPress theme front end: tokens, components, page sections and page templates, following the wp-vite-theme structure or the structure it detects in another project. Writes one reviewable spec per page (sections, ACF Pro field tables, acceptance criteria) and applies only what the user approves. Use when the user adds a design folder (/add-dir) and says "importa el diseño", "reordena el diseño de Claude Design", "pasa este diseño al tema", "design import", "limpia el HTML/CSS del diseño", or a spec says `skill: design-import`.'
metadata:
  version: "1.0.0"
---

# design-import

The design folder is visually right and structurally wrong: inline styles, `!important`, `div`s used as buttons, duplicated CSS, inline handlers, heading jumps, missing `alt`. This skill keeps the look and rebuilds the structure. It does the **front end only**: ACF fields are *documented* in the specs (name, type, description, current value), not created. A later skill or prompt creates them from the specs.

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

1. **Read context.** The design folder is the one the user added with `/add-dir`; if there are several candidates, ask which. From the theme root read `CLAUDE.md` (prefix) and the main CSS. Check the theme has `style.css` and `functions.php`.

2. **Decide the destination.** If the theme has the wp-vite-theme signs (`front-page.php`, `pages/`, `template-parts/pages/`, `inc/enqueue.php`, `vite.config.ts`), read [references/destino-wp-vite-theme.md](references/destino-wp-vite-theme.md) and do not ask. Otherwise read [references/destino-generico.md](references/destino-generico.md), analyze the project and confirm the structure with the user once (AskUserQuestion when available, with a recommendation). A new kind of destination is one new file in `references/`, not a change here.

3. **Analyze.** `node <skill>/scripts/analyze.mjs --source <design folder>` (`<skill>` = this skill's folder). It only reads. Keep the JSON (`--out` writes it outside the source). It lists pages and sections, tokens, repeated blocks, interactions (forms, modals, accordions, sliders, tabs) and findings. Read [references/malas-practicas.md](references/malas-practicas.md) for what each finding id means and its fix.

4. **Start the specs.** From the theme root: `node <skill>/scripts/init.mjs --dry-run`, show `conflicts` and ask file by file (overwrite or keep), then run it for real with `--overwrite` / `--skip`. Exit codes: `0` ok, `1` invalid input, `2` unresolved conflicts, `3` leftover placeholders (fix the template). Then register every page, one call at a time from the main thread (parallel edits of `_index.md` overwrite each other):
   ```
   node <skill>/scripts/init.mjs --page home --title "Inicio" --source index.html --template front-page.php
   ```
   Page slug: lowercase, no accents; it is also the prefix of its ACF fields (`sobre-nosotros` → `sobre_nosotros_…`). The home is `home` and uses `front-page.php`; the others use `pages/template-<slug>.php`.

5. **Stage A, serial: tokens and shared pieces.** Fill `specs/_shared.md` from the inventory: `@theme` tokens (colors, fonts, font sizes, spacing, radii, shadows), shared components (`repeated` groups with `kind: cross-page`, plus small blocks like buttons and cards) and the naming rules. Use the project's existing tokens when present; propose a token only for values the design repeats. **Stop and ask the user to approve `_shared.md`** (set `Estado: aprobado`). Nothing in stage B starts before this.

6. **Stage B: one spec per page.** Fill `specs/<page>.md`: the summary and one `## Sección: <name>` block per section, in order, as [references/formato-spec.md](references/formato-spec.md) says. Field names, types, descriptions and the recommended (never imposed) lengths and image sizes follow [references/campos-acf.md](references/campos-acf.md). Sections that are forms, modals or accordions get `Skill: wp-form` / `wp-modal` / the accordion skill and no markup of yours. Copy the relevant criteria of [references/acceptance.md](references/acceptance.md) into each section. With more than three pages, [references/paralelo.md](references/paralelo.md) says how to give each page to a subagent. **Stop and ask the user to review each page**: they set it to `aprobado` or `descartado` (also in `_index.md`).

7. **Stage C: apply only what is approved.** For each `aprobado` page, in order:
   1. Tokens of `_shared.md` into the main CSS (`@theme`), once.
   2. Components into `template-parts/components/<name>.php`, receiving data by `$args`.
   3. Sections into `template-parts/pages/<page>/<section>.php`, and the page template (`front-page.php` or `pages/template-<slug>.php`) that only calls `get_header()`, `<main id="main-content">`, the `get_template_part()` calls and `get_footer()`.
   4. Images, fonts and JS: assets under `src/` as the destination reference says; JS rewritten as modules (no inline handlers).
   5. Fix the bad practices the findings listed for that page ([references/malas-practicas.md](references/malas-practicas.md)). Keep what the user sees identical.
   6. Sections with a `Skill:` go to that skill (wp-form, wp-modal, wp-helper for images, links and two-color text) with the spec as input. The HTML of the design is their visual reference where they ask for a Figma frame.
   7. Mark the section's criteria `- [x]` as they are verified, set `Estado: aplicado` on section and page, and update `_index.md`.

8. **Verify.** `php -l` on every PHP file touched, `pnpm build`, then `node <skill>/scripts/check.mjs` from the theme root (must exit `0`; errors exit `4`). Open the page and compare it with the original by eye; automatic visual comparison is not part of this skill. Tell the user which specs are ready for the ACF step and which texts, images and links are still fixed in the templates.

## Rules

- Text, images and links stay fixed in the templates in this version. Each one is tied to a field by the spec's "valor actual" column so the ACF step can replace them one by one.
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
- [references/paralelo.md](references/paralelo.md): one subagent per page.
- [references/acceptance.md](references/acceptance.md): acceptance criteria to copy into the specs.

## Do not

- Do not run, install or import anything from the design folder.
- Do not apply a page whose `Estado` is not `aprobado`.
- Do not create ACF field groups or files (`acf.php`, `acf-json/`): the specs document them.
- Do not write the markup of a form, modal or accordion yourself when a skill covers it.
- Do not edit `_shared.md` tokens after approval without telling the user.
- Do not upload `specs/` to the server: it is documentation.
- Do not consider the import finished while `check.mjs` does not exit `0`.
