# Accessibility

The accordion is a native `<details>`. The browser already gives most of the pattern; the rules below keep the view from breaking it. The audit (`tests/check.mjs`) checks the ones marked with its rule id.

## What the native `<details>` already does

- `<summary>` is exposed as a button with an expanded/collapsed state; Enter and Space toggle it. No `role`, `tabindex` or `aria-expanded` is needed, and adding them by hand is a bug (`aria-div`).
- Focus order is the document order; every summary is a stop. Content of a closed item is not focusable and is not read.
- It works without JavaScript.
- Find-in-page (Ctrl+F) opens a closed item that contains the match.
- Exclusive mode is the `name` attribute (the engine prints it with `exclusive`); older browsers get the same from `accordion.js`.

## What the engine adds

- A summary at least 44 px tall (`--accordion-min-height`): the minimum touch target.
- A visible focus ring (`:focus-visible`, `currentColor`, also in forced-colors mode).
- A decorative icon (`aria-hidden="true"`, `focusable="false"`). It is never the only state cue: the browser exposes the state, and the icon follows `[open]`.
- A panel without fixed heights and with `overflow-wrap`: long words and 400 % zoom do not cut text.
- Motion off under `prefers-reduced-motion`.

## Rules for the view

1. **Every item has a title** (`no-title`). It is the button's accessible name. Do not use an icon or image as the only content.
2. **Nothing interactive inside the `<summary>`** (`summary-interactive`): no `<a>`, `<button>`, `<input>`. A button inside a button is invalid and breaks keyboard and screen readers. If the design has an action next to the title, put it in the panel.
3. **Do not hand-build it** (`aria-div`): no `div`/`span`/`li` with `aria-expanded` or `aria-controls`, no `role="button"`. Use the helpers.
4. **`<summary>` is the first child of its `<details>`** (`no-summary`). The helpers do it.
5. **Do not hide a panel yourself** (`panel-hidden`): `hidden`, `display: none` or `visibility: hidden` on the panel or its content makes it unreachable even when open. Closed is the browser's job.
6. **Headings.** By default the title is a `<span>`; the item is a button, not a section. Pass `heading` only when the design's titles are headings of the page's outline, and keep the level in order (no h2 → h4). Never an `<h1>` (`h1-inside`). Note: some screen readers announce the summary as a button and read the heading text without its level; that is why the default is no heading.
7. **No landmark per panel.** Do not add `role="region"` to each panel: with many items it floods the landmark list. The engine does not add it.
8. **Unique ids** (`duplicate-id`). The engine builds item ids from the accordion id; give explicit `id`s only to link to them.
9. **Exclusive mode needs `name`** (`no-name`) on every item. The `exclusive` option prints it.
10. **Images and iframes inside a panel**: `alt` (empty if decorative) (`img-alt`), `title` on iframes (`iframe-title`), `loading="lazy"` on both (`lazy`): they would otherwise download while the item is closed.
11. **No positive `tabindex`** (`tabindex`).
12. **Contrast.** The design's: 4.5:1 for text, 3:1 for the icon and the focus ring. Check the open and hover states too.
13. **Open at the start** only what the page needs visible. Everything open defeats the accordion (`all-open` warns).

## What the audit cannot see

Focus ring visibility, contrast, behavior with a screen reader, zoom and reduced motion: they are in the browser checklist of `acceptance.md`.
