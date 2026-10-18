# Figma → options, classes and tokens

The skill never invents the look. Read the frame (desktop and mobile) and translate it.

## Per modal

| In Figma | Goes to |
|---|---|
| Panel width on desktop | `width` (exact: `'45rem'`, `'720px'`). Never the nearest preset: there are none |
| Panel on the mobile frame: centered with margin / bottom sheet / full screen | `mobile => 'center'` / `'sheet'` / `'fullscreen'` |
| Panel background, radius, shadow, border | `class` (Tailwind), e.g. `bg-white rounded-2xl shadow-xl` |
| Header padding / alignment | `header_class` |
| Title text style | `title_class` |
| Description text style | `description_class` |
| Close button look (color, hover, size beyond 44 px) | `close_class` |
| Body padding, gap, scroll behavior | `body_class` |
| Everything else inside (buttons, images, forms) | The view's own markup, with classes from the frame |

Use the project's `@theme` colors and spacing (read the main CSS) instead of arbitrary values; use an arbitrary value only if no token matches and tell the user.

## Shared across modals → tokens, once

If two or more modals repeat the same radius, padding, backdrop, background or title style, do not paste it in every view. Define it once in the project CSS (after the `modal.css` import) by redefining the engine variables:

`--modal-backdrop`, `--modal-bg`, `--modal-color`, `--modal-padding`, `--modal-close-size`, `--modal-width-default`, `--modal-drawer-width`, `--modal-duration`, `--modal-slide-duration`, `--modal-easing`, `--modal-stagger`.

On the first modal of a project, list the values you took as the project baseline and ask the user to confirm them. After that, new modals inherit them.

## Stop and ask

- The frame has a close button outside the panel, none at all, or a custom position: the engine does not do it.
- The frame contradicts the spec (title, required fields, who can close it).
- The mobile frame is missing: ask whether the desktop modal should simply shrink (`mobile` omitted), or whether a mobile frame will come.
- The frame uses a font, color or spacing that is not in the project's CSS.
