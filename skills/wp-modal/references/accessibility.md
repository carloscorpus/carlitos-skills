# Accessibility

Target: WCAG 2.2 AA. The native `<dialog>` opened with `showModal()` does most of the work.

## What the browser already does (do not rebuild it)

- Traps the focus inside, makes the rest of the page inert, closes with Esc, and returns focus to the element that opened it.
- Puts the dialog in the top layer (`z-index` is irrelevant).
- Announces it as a dialog to assistive tech.

## What the engine adds

- A fixed structure: title (`aria-labelledby`), optional description (`aria-describedby`), a 44 px close button with an accessible name, and a scrolling body.
- A fallback to open where Invoker Commands (`command` / `commandfor`) are missing, and for `<a href>` triggers.
- Click-outside close without closing when a text selection started inside the panel.
- Scroll lock without layout jump (it reserves the scrollbar space only if the page had one).
- `prefers-reduced-motion`: only a short fade remains, no movement or scale.
- Focus returns to the trigger if the browser did not do it.

## Rules the audit checks (`tests/check.mjs`)

| Rule | Why |
|---|---|
| `no-id`, `duplicate-id` | A dialog without a unique id cannot be opened by a trigger |
| `open-attr` | A dialog with `open` is shown non-modal: no focus trap, no inert background |
| `no-name` | A dialog needs an accessible name: `title` is mandatory (hidden visually with `title_hidden` if the design has none) |
| `bad-describedby` | The description must point inside the dialog |
| `h1-inside` | The page already has its `<h1>`; the modal title is an `<h2>` |
| `no-close` | There must be a close button with a name (the helper prints it; never remove it) |
| `img-alt`, `iframe-title` | Images need `alt` (empty if decorative); iframes need `title` |
| `lazy` (warning) | Images and iframes inside a closed modal should be `loading="lazy"` |
| `tabindex` | Positive `tabindex` breaks the natural focus order |
| `role-div` | Use the native `<dialog>`, not `<div role="dialog">` |
| `trigger-target`, `trigger-type` | Every trigger points to a real dialog; `<button>` triggers need `type="button"` |
| `href-hash` (warning) | A trigger `<a>` needs a real URL |
| `alert-autofocus`, `alert-backdrop` (warnings) | A confirmation focuses the least destructive button and is not closed by clicking outside |

## Decisions the view must make

- **Initial focus:** the browser focuses the first focusable element, which is the close button (it is in the header). For a form, put `autofocus` on the first field; for a confirmation, on the least destructive button; for long reading content, leave the default.
- **Touch targets:** at least 24×24 px by WCAG 2.2, 44×44 px recommended. The engine's close button is 44 px; check the buttons the design adds.
- **Contrast:** text 4.5:1, large text and UI parts 3:1, including the backdrop-to-panel boundary and the focus ring. If Figma fails it, tell the user before building.
- **Focus ring:** never remove it. The close button has one; keep the design's focus style on every control.
- **Content that updates** (form status, errors) goes in `role="status"` / `aria-live="polite"` regions, as wp-form already does.
- **Language:** the text is in the page's language; `lang` on foreign-language fragments.
- **Reflow:** at 320 px wide and 400 % zoom the content must scroll inside the body, never be cut off. `mobile => 'fullscreen'` helps long content.
- **No nested modals.** One at a time.

## Manual checks (the audit cannot see them)

Keyboard only (Tab, Shift+Tab, Esc, Enter, Space), a screen reader (NVDA/VoiceOver) reading the title when it opens, 200 % and 400 % zoom, and a phone. The checklist is in `acceptance.md`.
