# Panel type

Used in step 2 of SKILL.md. The type changes the HTML and the behaviour, so it is decided from the design (Figma or the spec), not by taste. If the design does not make it clear, ask the user.

| Signal in the design or the spec | Type | In the helper |
|---|---|---|
| The page behind is dimmed or blocked and the user must act (accept, choose, close) before going on | **Modal** | `mode => 'modal'` (default) → `showModal()` |
| It opens on demand but the page stays usable and visible next to it (filters beside the results, a chat, a mini cart that does not block) | **Non-modal dialog** | `mode => 'non-modal'` → `show()`; no dimmed background, no inert page, no focus trap |
| The content is always visible (a sidebar, related links, a table of contents) | **Not a modal** | A plain `<aside>` with `aria-label`; do not use the engine |
| A menu that is a drawer on mobile and the inline navigation on desktop | **Hybrid** | Ask the user. Usual answer: the header's own `<nav>` on desktop and a modal drawer (`placement => 'right'`) below the breakpoint, printing the same `wp_nav_menu()` in both. |

## Drawer vs aside

"Drawer" is a look (a panel that slides in from a side), not a type. A drawer with a dimmed background that blocks the page is a **modal**. A side panel that leaves the page usable is a **non-modal dialog**. A side column that is always there is an **aside**. Classify by behaviour.

## What each type changes

- **Modal:** the browser traps the focus, makes the rest of the page inert, closes with Esc and returns the focus to the trigger. The engine locks the page scroll and closes on a click outside.
- **Non-modal dialog:** none of that is automatic. The engine closes it with Esc when the focus is inside it and returns the focus to the trigger; the page behind keeps scrolling and stays reachable with Tab. Use it only if that is really what the design wants.
- **Trigger:** a modal can be opened with the declarative `command`/`commandfor` attributes. A non-modal dialog has no such command, so its trigger always goes through the JavaScript (`['mode' => 'non-modal']` in `_modal_trigger_attrs()` leaves those attributes out).

## Placement and size

- `placement`: `center` (dialogs, confirmations), `right` / `left` (drawers, panels), `bottom` (bottom sheet on mobile).
- `size`: `sm` confirmations, `md` default, `lg` / `xl` content with media or tables, `full` lightbox. On a phone `lg` and `xl` fill the screen and `sm`/`md` keep a small margin.
