---
name: wp-modal
description: 'Build an accessible modal, dialog, confirmation, drawer, bottom sheet or lightbox in a WordPress theme with Vite and pnpm (Tailwind by default), on the native `<dialog>`. Design comes from Figma; the skill adds structure, behavior, accessibility, SEO-safe rules, motion and a static audit, and asks whether a form inside uses wp-form or something else. Use when a spec says `skill: wp-modal`, or the user asks for a modal, "ventana emergente", popup, dialog, "diálogo", drawer, "panel lateral", lightbox, "confirmación", or gives a Figma frame of an overlay.'
metadata:
  version: "1.0.3"
---

# wp-modal

Figma decides how the modal looks; this skill decides how it behaves. One engine prints a native `<dialog>` with a fixed, accessible structure (title, close button, scrolling body) and leaves the inside to each project. The browser provides the hard parts (focus trap, inert background, Esc, focus return); the engine only adds what the browser lacks. A modal does not improve SEO by itself: the rules in `references/seo.md` only keep it from hurting.

The engine files are generic and are **not edited per project**. A new modal only needs its view.

| File | Created by | Per project? |
|---|---|---|
| `inc/modals.php` | `scripts/install.mjs` | No, engine: `<prefix>_modal_start()`, `_modal_end()`, `_modal_trigger_attrs()` |
| `src/js/modules/modal.js` | `scripts/install.mjs` | No, engine: fallback open, click outside, auto-open, form success, events |
| `src/css/modal.css` | `scripts/install.mjs` | No, engine: position, scroll lock, motion, in `@layer components`, variables `--modal-*` |
| wp-modal block in `CLAUDE.md` | `scripts/install.mjs` (from `claude-block.md.tpl`) | No: do not edit it by hand, the next install replaces it |
| `template-parts/modals/<id>.php` | you, from the Figma frame | Yes: the options, the classes and the content |
| `tests/` (stays in the skill) | — | Static audit of the rendered page |

If the engine needs a change, change the template in this skill, bump `metadata.version` in its SKILL.md and note it in its CHANGELOG.md; never the copy in a theme. The skill ships no example views: you write each view from the frame and the options below.

Detail lives in `references/` and is read only by the step that points to it.

## Steps

1. **Read context.** From the theme root: read `CLAUDE.md` if there is one (prefix) and the modal's spec. If a Figma link is given, read the frame (desktop and mobile) through the Figma MCP and follow the Figma server's design-to-code instructions. The spec says what the modal does; Figma says how it looks. If they contradict, stop and ask: do not decide. If the spec points to a design folder or HTML file (from `design-import`) instead of a Figma link, read that HTML and its CSS as the visual reference (desktop width from the container, mobile layout from its media queries), with the same rule.

2. **Decide the panel type, then ask what is missing.** Read [references/panel-type.md](references/panel-type.md) and classify the frame (centered modal, confirmation, drawer, bottom sheet, lightbox). Decide from the design; ask only if it is ambiguous. Then ask only what the spec and the design do not answer, in one message (AskUserQuestion when available), always with a recommendation:
   - **Trigger:** a button, or a link. If a real page exists with the same content, recommend an `<a href>` (crawlable, works without JavaScript).
   - **Opens by itself?** Depends on the project. If yes: when (`load` | `delay` | `scroll`), how often (`always` | `session` | `days:N`), on which pages, and whether on mobile too. Read [references/auto-open.md](references/auto-open.md) first and tell the user about the mobile-interstitial risk.
   - **Motion:** only if Figma does not define it. Read [references/motion.md](references/motion.md), offer the options that fit the panel type and recommend one. Never add motion the user did not accept.
   - **Tailwind:** detect it (`tailwindcss` in `package.json` or `@import "tailwindcss"` in the main CSS). If found, use it without asking. If not, ask how the classes should be written.
   - **Form inside?** none | wp-form (offer it only if its skill is available) | independent. Read [references/forms.md](references/forms.md) and follow its branch.
   - **Close rules:** click outside closes (default yes). A confirmation (`alertdialog`) never closes that way.
   Content is free: do not ask for a content template. Sizes, colors and spacing are not asked: they come from the design (next step).

3. **Map the design.** The look is never decided by the skill. Read [references/figma-mapping.md](references/figma-mapping.md) and translate the frame into values: the exact `width`, the `mobile` behaviour from the mobile frame, the per-part classes, and the values shared by several modals (radius, padding, backdrop, title style), which go **once** to the project CSS as `--modal-*` tokens instead of being repeated per modal. On the first modal of a project, tell the user which values you took as the project baseline and ask them to confirm. If the design asks for something the engine does not do (close button outside the panel, no close button, nested modals), stop and tell the user: do not hack it.

4. **Install the engine** (only the first modal of the theme). From the theme root, `<skill>` = this skill's folder:
   ```
   node <skill>/scripts/install.mjs --dry-run
   ```
   The installer finds Vite's main JS and CSS files by reading `vite.config.*` and prints them as `entry` and `css`. If it exits `1` with `candidates` (or none), ask the user which file it is and re-run with `--entry <path>` / `--css <path>` (relative to the theme root). The JSON lists `create`, `unchanged`, `conflicts`, `wire` and `claudeMd` (`missing` means the theme has no `CLAUDE.md`: it is not created, tell the user). If `conflicts` is non-empty, show them and ask file by file: overwrite or keep. Then run without `--dry-run`, with `--overwrite` / `--skip` covering every conflict. Exit codes: `0` ok, `1` invalid input (slug not starting with a letter, theme without `functions.php` / `vite.config.*`, main JS/CSS not found), `2` unresolved conflicts, `3` leftover placeholders (fix the template, not the output), `4` (`--check` only) something is not wired.

5. **Close the install with `node <skill>/scripts/install.mjs --check`.** It must exit `0` (engine copied; `functions.php`, the main JS and the main CSS wired). `engineVersion` compares the installed engine with this skill's: when they differ, run `--dry-run`, show the conflicts and ask before overwriting (never overwrite silently). Do not call the modal done before this passes.

6. **Write the view** `template-parts/modals/<id>.php`. Read [references/accessibility.md](references/accessibility.md) first: the rules the audit checks and why. Open with `<prefix>_modal_start('<id>', [...])` and close with `<prefix>_modal_end()`. Options (all optional except `title`):

   | Option | Values | Source |
   |---|---|---|
   | `title`, `title_hidden`, `description` | text, bool, text | Figma copy (hidden only if the design shows no title) |
   | `placement` | `center` \| `right` \| `left` \| `bottom` | panel type |
   | `role` | `dialog` \| `alertdialog` | confirmation → `alertdialog` |
   | `width` | `'45rem'`, `'720px'`, `720`, `'80%'` | exact frame width |
   | `mobile` | `center` \| `sheet` \| `fullscreen` | mobile frame |
   | `motion`, `stagger` | `auto` \| `fade` \| `scale` \| `slide` \| `none`, bool | step 2 |
   | `backdrop_close` | bool (default true) | step 2 |
   | `form_success` | `keep` \| `close` | step 2, only with a form |
   | `auto` | `['on', 'delay', 'scroll', 'repeat', 'min_width']` | step 2 |
   | `class`, `header_class`, `title_class`, `description_class`, `close_class`, `body_class` | Tailwind classes | the frame |

   Never hand-write the `<dialog>`, its `id`, `aria-*` or the close button: the helpers print them. Never pick a preset width when there is a design.

7. **Place it and connect the triggers.** Print the view where the spec says (`get_template_part('template-parts/modals/<id>');`; the position in the DOM does not matter, the dialog renders in the top layer). Every trigger gets `<?php <prefix>_modal_trigger_attrs('<id>'); ?>` (`['link' => true]` on an `<a href>`).

8. **Form inside** (only if step 2 said so). Follow [references/forms.md](references/forms.md).

9. **Verify.** `php -l` every PHP file touched, `pnpm build` (the modal CSS must appear in the compiled stylesheet), then the static audit of the rendered page and the browser checklist in [references/acceptance.md](references/acceptance.md) (copy the relevant items into the modal's spec):
   ```
   node <skill>/tests/check.mjs <page url | saved .html>
   ```
   It must report no errors. Warnings are read, not ignored.

## Reference

- [references/panel-type.md](references/panel-type.md): how to tell the panel type from the design.
- [references/figma-mapping.md](references/figma-mapping.md): frame → options, classes and tokens.
- [references/accessibility.md](references/accessibility.md): what the native `<dialog>` already does, what the engine adds, and the rules the audit checks.
- [references/seo.md](references/seo.md): what helps, what hurts, what a modal cannot do.
- [references/motion.md](references/motion.md): animation and micro-interaction options, with a recommendation per panel type.
- [references/auto-open.md](references/auto-open.md): opening by itself, with its UX/SEO risks.
- [references/forms.md](references/forms.md): a form inside a modal (wp-form or independent).
- [references/acceptance.md](references/acceptance.md): audit and browser checklist.

## Do not

- Do not edit `inc/modals.php`, `src/js/modules/modal.js` or `src/css/modal.css` in a theme. Change the skill's templates.
- Do not add the `open` attribute to a `<dialog>` and do not call `show()`/`showModal()` yourself: the triggers and `auto` do it.
- Do not decide sizes, colors, radius or spacing: they come from Figma. Do not repeat the same radius, padding, backdrop or title style in every view: define it once as a project `--modal-*` token.
- Do not use a `<div role="dialog">`, a UI library or a jQuery plugin for a modal.
- Do not put an `<h1>` inside a modal, and do not leave a modal without a `title`.
- Do not load content into a modal with `fetch`; print it in the page and lazy-load heavy images and iframes.
- Do not open a modal on page load unless the project asked for it (step 2).
- Do not stack modals (a modal that opens another). Replace the content or use a separate page.
- Do not put things that must be visible above an open modal outside of it: the top layer ignores `z-index`.
- Do not animate without `prefers-reduced-motion` support; the engine handles it, so do not add your own transitions on the panel.
- Do not consider the modal finished while `install.mjs --check` does not exit `0` and the audit reports errors.
