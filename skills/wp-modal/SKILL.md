---
name: wp-modal
description: Build an accessible modal, dialog, drawer, lightbox or confirmation in a WordPress theme that uses Vite and pnpm, based on the native HTML `<dialog>` element (semantic, responsive, keyboard and screen-reader friendly, no UI library). Fixed structure (title, close button, scrolling body) with free content, because every project differs. Decides from the design whether the panel is a modal, a non-modal dialog or just an aside, and supports an optional auto-open. Use when a spec says `skill: wp-modal`, or the user asks for a modal, "ventana emergente", popup, dialog, "diálogo", drawer, "panel lateral", lightbox, "confirmación", or gives a Figma frame of an overlay.
metadata:
  version: "1.0.0"
---

# wp-modal

One engine, free content. The engine prints a native `<dialog>` with a fixed, accessible structure and leaves the inside to each project. The browser provides the hard parts (focus trap, inert background, Esc, focus return); the engine only adds what the browser lacks. Nothing here improves SEO: the rules below only avoid hurting it.

The engine files are generic and are **not edited per project**. A new modal only needs its view.

| File | Created by | Per project? |
|---|---|---|
| `inc/modals.php` | `scripts/install.mjs` | No, engine: `<prefix>_modal_start()`, `_modal_end()`, `_modal_trigger_attrs()` |
| `src/js/modules/modal.js` | `scripts/install.mjs` | No, engine: fallback open, click outside, auto-open, events |
| `src/css/modal.css` | `scripts/install.mjs` | No, engine: functional styles in `@layer components`, variables `--modal-*` |
| wp-modal block in `CLAUDE.md` | `scripts/install.mjs` (from `claude-block.md.tpl`) | No: the next install replaces it |
| `template-parts/modals/<id>.php` | you, from `examples/` | Yes: the content, the options and the classes |
| `tests/` (stays in the skill) | — | Static audit of the rendered page |

If the engine needs a change, change the template in this skill (and bump the skill version), never the copy in a theme.

Detail lives in `references/` and is read only by the step that points to it.

## Steps

1. **Read context.** From the theme root: read `CLAUDE.md` if there is one (prefix) and the modal's spec. If a Figma link is given, read the frame through the Figma MCP for the view. The spec says what the modal does; Figma says how it looks. If they contradict, stop and ask.

2. **Decide the panel type, then ask what is missing.** Read [references/panel-type.md](references/panel-type.md) and classify the design: modal, non-modal dialog, plain `<aside>` (no dialog), or hybrid. Decide from the design; if it does not make it clear, ask. Then ask only what the spec does not answer, in one message (AskUserQuestion when available):
   - **Panel type**, only if the design is ambiguous.
   - **Trigger:** a button, or a link. If a real page exists with the same content, use an `<a href>` (crawlable, works without JavaScript).
   - **Opens by itself?** It depends on the project, so ask. If yes: when (`load` | `delay` | `scroll`), how often (`always` | `session` | `days:N`), on which pages, and whether on mobile too (`min_width`). Read [references/auto-open.md](references/auto-open.md) first and tell the user about the mobile-interstitial risk and the storage note.
   - **Size and placement:** `size` sm | md | lg | xl | full; `placement` center | right | left | bottom. Skip if Figma shows it.
   - **Confirmation?** If it asks the user to confirm or cancel something, it is `role => 'alertdialog'`.
   The content is free: do not ask for a content template.

3. **Install the engine** (only the first modal of the theme). From the theme root, `<skill>` = this skill's folder:
   ```
   node <skill>/scripts/install.mjs --dry-run
   ```
   The installer finds Vite's main JS and CSS files by reading `vite.config.*` and prints them as `entry` and `css`. If it exits `1` with `candidates` (or none), ask the user which file is it and re-run with `--entry <path>` / `--css <path>` (relative to the theme root). The JSON lists `create`, `unchanged`, `conflicts`, `wire` and `claudeMd`. If `conflicts` is non-empty, show them and ask file by file: overwrite or keep. Then run without `--dry-run`, with `--overwrite` / `--skip` covering every conflict. Exit codes: `0` ok, `1` invalid input, slug not starting with a letter, theme without `functions.php` / `vite.config.*`, or main JS/CSS not found, `2` unresolved conflicts, `3` leftover placeholders (fix the template, not the output), `4` (`--check` only) something is not wired. `claudeMd: "missing"` means the theme has no `CLAUDE.md` (it is not created: tell the user).

4. **Close the install with `node <skill>/scripts/install.mjs --check`.** It must exit `0` (engine copied; `functions.php`, the main JS and the main CSS wired). `engineVersion` compares the installed engine with this skill's: when they differ, run `--dry-run`, show the conflicts and ask before overwriting (never overwrite silently). Do not call the modal done before this passes.

5. **Write the view** `template-parts/modals/<id>.php` from the closest file in `examples/template-parts/modals/` (`contenido`, `confirmacion`, `lightbox`, `drawer`, `formulario`). Read [references/accessibility.md](references/accessibility.md) first: the rules the audit checks and why. Classes and layout come from Figma and the `@theme` tokens; the structure helpers do not change. Never hand-write the `<dialog>`, its `id`, `aria-*` or the close button: the helpers print them.

6. **Place it and connect the triggers.** Print the view where the spec says (`get_template_part('template-parts/modals/<id>');`; the position in the DOM does not matter, the dialog renders in the top layer). Every trigger gets `<?php <prefix>_modal_trigger_attrs('<id>'); ?>` (`['link' => true]` on an `<a>`, `['mode' => 'non-modal']` for a non-modal dialog).

7. **Auto-open** (only if asked). Pass `'auto' => [...]` to `<prefix>_modal_start()`; see [references/auto-open.md](references/auto-open.md) for the options. Leave it off otherwise.

8. **Verify.** `php -l` every PHP file touched, `pnpm build` (the CSS must appear in the compiled stylesheet), then the static audit of the rendered page and the browser checklist in [references/acceptance.md](references/acceptance.md) (copy the relevant items into the modal's spec):
   ```
   node <skill>/tests/check.mjs <page url | saved .html>
   ```

## Do not

- Do not edit `inc/modals.php`, `src/js/modules/modal.js` or `src/css/modal.css` in a theme. Change the skill's templates.
- Do not add the `open` attribute to a `<dialog>` and do not call `show()`/`showModal()` yourself: the triggers and `auto` do it.
- Do not use a `<div role="dialog">`, a UI library or a jQuery plugin for a modal.
- Do not put an `<h1>` inside a modal, and do not leave a modal without a `title`.
- Do not load content into a modal with `fetch`; print it in the page (it stays indexable) and lazy-load heavy images.
- Do not open a modal on page load unless the project asked for it (step 2).
- Do not put things that must be visible above an open modal outside of it: the top layer ignores `z-index`.
- Do not consider the modal finished while `install.mjs --check` does not exit `0` and the audit reports errors.
