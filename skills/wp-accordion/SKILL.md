---
name: wp-accordion
description: 'Build an accessible accordion, FAQ, collapsible list or "expand/collapse" section in a WordPress theme with Vite and pnpm (Tailwind by default), on the native `<details>`/`<summary>`. Design comes from Figma or an imported HTML; the skill adds structure, behavior, accessibility, SEO-safe rules, motion, responsive rules and a static audit. Use when a spec says `skill: wp-accordion`, or the user asks for an accordion, "acordeón", FAQ, "preguntas frecuentes", collapsible, "desplegable" or "expandir/colapsar", or gives a Figma frame of one.'
metadata:
  version: "1.0.0"
---

# wp-accordion

Figma decides how the accordion looks; this skill decides how it behaves. One engine prints one native `<details>` per item with a fixed, accessible structure (a `<summary>` that is the button, a panel) and leaves the inside to each project. The browser provides the hard parts (keyboard, expanded state, accessible name); the engine only adds what the browser lacks. An accordion does not improve SEO by itself: the rules in `references/seo.md` only keep it from hurting.

The engine files are generic and are **not edited per project**. A new accordion only needs its view.

| File | Created by | Per project? |
|---|---|---|
| `inc/accordions.php` | `scripts/install.mjs` | No, engine: `<prefix>_accordion_start()`, `_item_start()`, `_item_end()`, `_end()` and `<prefix>_accordion($id, $items)` |
| `src/js/modules/accordion.js` | `scripts/install.mjs` | No, engine: exclusive fallback, open by `#hash`, events |
| `src/css/accordion.css` | `scripts/install.mjs` | No, engine: summary row, icon, focus, height motion, in `@layer components`, variables `--accordion-*` |
| wp-accordion block in `CLAUDE.md` | `scripts/install.mjs` (from `claude-block.md.tpl`) | No: do not edit it by hand, the next install replaces it |
| `template-parts/accordions/<id>.php` | you, from the design | Yes: the options, the classes and the content |
| `tests/` (stays in the skill) | — | Static audit of the rendered page |

If the engine needs a change, change the template in this skill, bump `metadata.version` in its SKILL.md and note it in its CHANGELOG.md; never the copy in a theme. The skill ships no example views: you write each view from the design and the options below.

Detail lives in `references/` and is read only by the step that points to it.

## Steps

1. **Read context.** From the theme root: read `CLAUDE.md` if there is one (prefix) and the accordion's spec. If a Figma link is given, read the frame (desktop and mobile) through the Figma MCP and follow the Figma server's design-to-code instructions. The spec says what the accordion does; Figma says how it looks. If they contradict, stop and ask: do not decide. If the spec points to a design folder or HTML file (from `design-import`) instead of a Figma link, read that HTML and its CSS as the visual reference (desktop width from the container, mobile layout from its media queries), with the same rule.

2. **Ask only what is missing**, in one message (AskUserQuestion when available), always with a recommendation. Read [references/figma-mapping.md](references/figma-mapping.md) first: most answers are in the design.
   - **Mode:** several items open at once (default) or exclusive (opening one closes the others). Recommend exclusive only for a short list where the user compares answers; for long content, several open is friendlier.
   - **Open at the start:** none (recommended), the first, or a specific one. Content that matters must not depend on an item being closed.
   - **Items:** fixed text in the view, or a list from the project (ACF repeater, options page). With a list, use `<prefix>_accordion($id, $items)`.
   - **Heading:** is the item title a real heading of the page (an h2/h3 in the design's outline)? If yes, pass `heading`. If it is just a label, leave it out.
   - **Motion:** only if the design does not define it. Read [references/motion.md](references/motion.md), offer the options and recommend one. Never add motion the user did not accept.
   - **Tailwind:** detect it (`tailwindcss` in `package.json` or `@import "tailwindcss"` in the main CSS). If found, use it without asking. If not, ask how the classes should be written.
   Content is free: do not ask for a content template. Sizes, colors and spacing are not asked: they come from the design (next step).

3. **Map the design.** The look is never decided by the skill. Translate the frame into per-part classes (`class`, `item_class`, `summary_class`, `title_class`, `icon_class`, `panel_class`), the icon (`chevron` | `plus` | `none`) and its side (`icon_position`), and the values shared by several accordions (divider, padding, title style), which go **once** to the project CSS as `--accordion-*` tokens instead of being repeated per view. On the first accordion of a project, tell the user which values you took as the project baseline and ask them to confirm. If the design asks for something the engine does not do (tabs, a card that expands out of the flow, an item with a button inside the title), stop and tell the user: do not hack it.

4. **Install the engine** (only the first accordion of the theme). From the theme root, `<skill>` = this skill's folder:
   ```
   node <skill>/scripts/install.mjs --dry-run
   ```
   The installer finds Vite's main JS and CSS files by reading `vite.config.*` and prints them as `entry` and `css`. If it exits `1` with `candidates` (or none), ask the user which file it is and re-run with `--entry <path>` / `--css <path>` (relative to the theme root). The JSON lists `create`, `unchanged`, `conflicts`, `wire` and `claudeMd` (`missing` means the theme has no `CLAUDE.md`: it is not created, tell the user). If `conflicts` is non-empty, show them and ask file by file: overwrite or keep. Then run without `--dry-run`, with `--overwrite` / `--skip` covering every conflict. Exit codes: `0` ok, `1` invalid input (slug not starting with a letter, theme without `functions.php` / `vite.config.*`, main JS/CSS not found), `2` unresolved conflicts, `3` leftover placeholders (fix the template, not the output), `4` (`--check` only) something is not wired.

5. **Close the install with `node <skill>/scripts/install.mjs --check`.** It must exit `0` (engine copied; `functions.php`, the main JS and the main CSS wired). `engineVersion` compares the installed engine with this skill's: when they differ, run `--dry-run`, show the conflicts and ask before overwriting (never overwrite silently). Do not call the accordion done before this passes.

6. **Write the view** `template-parts/accordions/<id>.php`. Read [references/accessibility.md](references/accessibility.md) first: the rules the audit checks and why. Either open with `<prefix>_accordion_start('<id>', [...])`, one `<prefix>_accordion_item_start('<title>', [...])` / `_item_end()` per item, and `<prefix>_accordion_end()`; or pass a list to `<prefix>_accordion('<id>', $items, [...])`. Options (all optional):

   | Option | Values | Source |
   |---|---|---|
   | `exclusive` | bool (default false) | step 2 |
   | `icon`, `icon_position` | `chevron` \| `plus` \| `none`, `end` \| `start` | the frame |
   | `heading` | `2`-`6` | step 2 |
   | `motion` | `auto` \| `none` | step 2 |
   | `class`, `item_class`, `summary_class`, `title_class`, `icon_class`, `panel_class` | Tailwind classes | the frame |
   | item: `open`, `id` | bool, text (for `#anchor` links) | step 2 |

   Never hand-write the `<details>`, `<summary>`, its `name`, ids or the icon: the helpers print them. Item titles are plain text; the panel content is free HTML (or `wp_kses_post` in the list form).

7. **Place it.** Print the view where the spec says (`get_template_part('template-parts/accordions/<id>');`). To link to one item from elsewhere, give it an `id` and use `<a href="#that-id">`: the engine opens it and scrolls to it.

8. **Verify.** `php -l` every PHP file touched, `pnpm build` (the accordion CSS must appear in the compiled stylesheet), then the static audit of the rendered page and the browser checklist in [references/acceptance.md](references/acceptance.md) (copy the relevant items into the accordion's spec):
   ```
   node <skill>/tests/check.mjs <page url | saved .html>
   ```
   It must report no errors. Warnings are read, not ignored.

## Reference

- [references/figma-mapping.md](references/figma-mapping.md): design → options, classes and tokens.
- [references/accessibility.md](references/accessibility.md): what the native `<details>` already does, what the engine adds, and the rules the audit checks.
- [references/seo.md](references/seo.md): what helps, what hurts, and why there is no FAQ schema.
- [references/motion.md](references/motion.md): the animation, how it degrades, and reduced motion.
- [references/acceptance.md](references/acceptance.md): audit and browser checklist.

## Do not

- Do not edit `inc/accordions.php`, `src/js/modules/accordion.js` or `src/css/accordion.css` in a theme. Change the skill's templates.
- Do not build an accordion with `div`s, `role="button"`, `aria-expanded` and your own JS. The `<details>` does it, and works without JavaScript.
- Do not put a link, button or input inside the `<summary>`: it is already the button.
- Do not hide a panel with `display: none`, `hidden` or `visibility`: use the closed `<details>` (the browser still finds its text with Ctrl+F and opens it).
- Do not decide sizes, colors, radius or spacing: they come from the design. Do not repeat the same divider, padding or title style in every view: define it once as a project `--accordion-*` token.
- Do not put an `<h1>` inside an accordion, and do not leave an item without a title.
- Do not load panel content with `fetch`; print it in the page and lazy-load heavy images and iframes.
- Do not use an accordion for content that is the point of the page (the main text of a service, a product description): make it visible, or a page of its own.
- Do not add FAQ structured data (`FAQPage`): it has no effect on regular sites (see `references/seo.md`).
- Do not animate without `prefers-reduced-motion` support; the engine handles it, so do not add your own transitions.
- Do not consider the accordion finished while `install.mjs --check` does not exit `0` and the audit reports errors.
