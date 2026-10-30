---
name: wp-helper
description: 'Install the reusable PHP helpers of a WordPress theme, prefixed per project: safe images from ACF Pro fields (empty or deleted never breaks the view), safe accessible links (target, rel, protocols, new-tab notice) and text with parts in another color (configurable markers, no clashes). Asks which helper to include, or creates a local one. Use when a spec says `skill: wp-helper`, or the user asks for "helper", "imágenes ACF", "enlaces", "target blank", "botón", "texto de dos colores", "resaltar texto", or after wp-vite-theme.'
metadata:
  version: "1.2.0"
---

# wp-helper

Small PHP helpers every project ends up copying. The skill installs them once, with the theme prefix, and keeps them in `inc/helpers/`. The engine files are generic and are **not edited per project**; what changes per project is `inc/helpers/text-styles.php` (the color styles) and any local helper.

| File | Created by | Per project? |
|---|---|---|
| `inc/helpers/images.php` | `scripts/install.mjs --helpers images` | No, engine: `<prefix>_image_data()`, `<prefix>_image()` |
| `inc/helpers/text.php` | `scripts/install.mjs --helpers text` | No, engine: `<prefix>_highlight()` |
| `inc/helpers/links.php` | `scripts/install.mjs --helpers links` | No, engine: `<prefix>_link()`, `_link_attrs()`, `_link_data()` |
| `inc/helpers/text-styles.php` | same, only if missing | Yes: markers and classes, written by `--add-style` |
| wp-helper block in `CLAUDE.md` | `scripts/install.mjs` (from `claude-block*.md.tpl`) | No: do not edit it by hand, the next install replaces it |
| `inc/helpers/<name>.php` (local) | you | Yes: a helper only this project needs |

If the engine needs a change, change the template in this skill, bump `metadata.version` in its SKILL.md and note it in its CHANGELOG.md; never the copy in a theme.

Detail lives in `references/` and is read only by the step that points to it.

## Steps

1. **Read context.** From the theme root: read `CLAUDE.md` if there is one (prefix) and the spec. Without it the prefix is the folder name with `-` turned into `_` (`install.mjs` prints it as `values.PREFIX`; force another with `--slug`). Run `node <skill>/scripts/install.mjs --list` (`<skill>` = this skill's folder) to see what is already installed, the existing text styles and the free markers. The theme only needs `style.css` and `functions.php`: it does not have to use Vite or come from `wp-vite-theme`.

2. **Ask which helper**, in one message (AskUserQuestion when available), skipping what `--list` shows as installed and what the spec already answers:
   - **Images** (recommended in every project): ACF image fields always go through it.
   - **Text with parts in another color**: only if the design has paragraphs or titles with two colors. For each style ask its **name**, its **marker** (offer the free ones from `--list`; if the project already uses one, the new style takes a different marker) and its **color class**. The class comes from the design or from the project's Tailwind tokens (`@theme` in the main CSS); never invent a color.
   - **Links** (recommended in every project that has ACF Link or URL fields): every link goes through it. Ask nothing else: how a link opens comes from the ACF field, and the options are per call. Read [references/links.md](references/links.md) before using it.
   - **All of them**.
   - **A new local helper**: for something only this project needs. Ask what it must do; it is not installed from the skill (step 6).
   If the user answers with a number, map it in the order above. Read [references/text-styles.md](references/text-styles.md) before offering markers.

3. **Install the engine.** From the theme root:
   ```
   node <skill>/scripts/install.mjs --helpers images,text --dry-run
   ```
   The JSON lists `create`, `unchanged`, `conflicts`, `keptConfig`, `wire` and `claudeMd` (`missing` means the theme has no `CLAUDE.md`: it is not created, tell the user). If `conflicts` is non-empty, show them and ask file by file: overwrite or keep. Then run without `--dry-run`, with `--overwrite` / `--skip` covering every conflict. Exit codes: `0` ok, `1` invalid input (slug not starting with a letter, theme without `functions.php`, unknown helper), `2` unresolved conflicts, `3` leftover placeholders (fix the template, not the output), `4` (`--check` only) something is not installed or wired.

4. **Add the text styles** (only if `text` was chosen), one call per style:
   ```
   node <skill>/scripts/install.mjs --add-style --name naranja --marker "|" --class text-anaranjado
   ```
   It fails (`1`) if the name or the marker is already used and lists the free markers: ask the user again, never overwrite. Quote the marker (`"|"`) so the shell does not read it.

5. **Check.** `node <skill>/scripts/install.mjs --check` must exit `0` (files present and `functions.php` wired). `engineVersion` compares the installed engine with this skill's: when they differ, run `--dry-run`, show the conflicts and ask before overwriting (never overwrite silently). Then `php -l` every PHP file touched and, if a style was added, `pnpm build` and confirm its class is in the compiled CSS; if it is not, add that file with `@source` in the main CSS (see references/text-styles.md).

6. **A new local helper.** Write `inc/helpers/<name>.php` following the theme's `CLAUDE.md` (prefix, `defined('ABSPATH') || exit;`, escaped output), add its `require_once` to `functions.php`, and say that it is local to the project. Do not copy it into the skill unless the user asks.

7. **Use them in the views.** Only in the code you are writing: replace direct reads of ACF image fields with `<prefix>_image()`, print ACF links with `<prefix>_link()` (or `<a<?= <prefix>_link_attrs($field) ?>>` when the design puts icons inside) and print marked texts and every ACF `textarea` with `<prefix>_highlight()` (it keeps the line breaks the editor typed). Do not rewrite existing views unless the user asks. Read [references/images.md](references/images.md) for the options and [references/acceptance.md](references/acceptance.md) for the acceptance criteria.

## Reference

- [references/images.md](references/images.md): cases the image helper covers, options and examples.
- [references/links.md](references/links.md): what the link helper decides, args, and the security, accessibility and SEO rules it applies.
- [references/text-styles.md](references/text-styles.md): markers, rules, and how a style is added.
- [references/acceptance.md](references/acceptance.md): acceptance criteria and the automated test.

## Do not

- Do not edit `inc/helpers/images.php`, `inc/helpers/text.php` or `inc/helpers/links.php` in a theme. Change the skill's templates.
- Do not edit `inc/helpers/text-styles.php` by hand: use `--add-style`. Do not reuse a marker another style already has.
- Do not call `get_field()` or any ACF function inside the helpers: they must work without ACF.
- Do not wrap the output of `<prefix>_image()`, `<prefix>_link()`, `<prefix>_link_attrs()` or `<prefix>_highlight()` in `esc_html()`: it is already escaped HTML.
- Do not write `target="_blank"`, `rel` or `$field['url']` by hand for an ACF link, and do not add `nofollow` unless the user asks for it.
- Do not consider the install finished while `install.mjs --check` does not exit `0`.
