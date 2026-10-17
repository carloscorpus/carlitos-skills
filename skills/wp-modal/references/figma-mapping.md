# Figma → modal

Used in step 3 of SKILL.md. Behaviour and accessibility are fixed by the engine; **everything visual comes from the design**. Never pick a preset size or style "close enough": a 560 px modal in Figma is `width => '560px'`, not `size => 'md'`. The sizes (`sm` / `md` / `lg` / `xl` / `full`) exist only for projects that have no design for the modal.

## Where each Figma property goes

| In Figma | In the project | How |
|---|---|---|
| Frame width | per modal | `'width' => '560px'` in `<prefix>_modal_start()` (any CSS length: `px`, `rem`, `em`, `%`, `vw`, `ch`; a bare number is pixels, so `720` = `'720px'`). On a phone it never exceeds the screen. Drawers take it too. |
| Corner radius | shared → tokens; one-off → view | `--modal-radius` (and `--modal-drawer-radius`) in the project CSS, or a radius class in `class` |
| Padding | shared → tokens; one-off → view | `--modal-padding`, or `header_class` / `body_class` |
| Fill and text color | shared → tokens; one-off → view | `--modal-bg`, `--modal-color`, or classes in `class` |
| Dimmed background (color and opacity) | shared | `--modal-backdrop`, for example `rgb(0 0 0 / 0.5)` |
| Shadow | shared | `--modal-shadow` |
| Title text style | shared → tokens; one-off → view | `--modal-title-size`, `--modal-title-weight`, `--modal-title-leading`, or `title_class` with the project's text classes |
| Description text | view | `description_class` |
| Close button (size, colors, hover) | view | `close_class`. Keep at least 44 × 44 px; the audit cannot check classes. The button stays in the header, next to the title |
| Spacing between title and button | shared | `--modal-header-gap`, or `header_class` |
| Mobile frame | per modal | `'mobile' => 'center' \| 'sheet' \| 'fullscreen'` (below 40 rem; without it, large modals are full screen) |
| Prototype animation | shared | `--modal-duration`, `--modal-slide-duration`, `--modal-slide-easing`, only if the design specifies them |

## Shared values vs. one-offs

1. Look at **all** the modals in the design. A value that repeats in two or more (radius, padding, backdrop, title style) is a project token: define it **once**, in the project CSS after the engine's `@import`, preferably from the project's `@theme` tokens:
   ```css
   :root {
       --modal-radius: var(--radius-xl);
       --modal-backdrop: rgb(0 0 0 / 0.5);
       --modal-title-size: var(--text-2xl);
   }
   ```
2. A value that belongs to one modal (its width, a special background) goes in that modal's view, with `width` and the per-part classes.
3. On the **first** modal of a project, tell the user which values you took as the project baseline and ask them to confirm; the next modals reuse them.
4. Do not edit `src/css/modal.css` to apply any of this: the next engine update would erase it.

## Per-part classes

`class` (panel), `header_class`, `title_class`, `description_class`, `close_class`, `body_class`. They are added to the engine's own classes, and the engine styles live in a low-priority CSS layer, so Tailwind utilities and your own CSS win without `!important`.

## When the design asks for something the engine does not do

The engine supports one close-button position (in the header, next to the title) and always keeps a close button and a title for accessibility. If the design has the close button in a corner or outside the panel, no header bar, or no close button at all: **stop and tell the user** what the design asks for and what the engine offers. Do not hand-write a close button, hide the title or patch the engine in the theme.
