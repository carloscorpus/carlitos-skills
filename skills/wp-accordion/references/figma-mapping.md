# Design → options, classes and tokens

The skill never invents the look. Read the frame (desktop and mobile) and translate it. When the reference is an HTML file from `design-import` instead of a frame, read the same things from its HTML and CSS: the table below applies as is.

## Per accordion

| In the design | Goes to |
|---|---|
| Container (width, background, outer border, radius) | `class` (Tailwind), e.g. `max-w-3xl divide-y border-y` |
| One item (border, background, radius, gap between items) | `item_class` |
| The clickable row (padding, alignment, hover, open-state color) | `summary_class` (use `group-open:` / `[details[open]_&]:` variants for the open state) |
| Title text style | `title_class` |
| Icon: plus/minus or chevron, none, on the left or right | `icon` + `icon_position`; color and size → `icon_class` |
| Panel (padding, text style, background) | `panel_class` |
| Item titles are headings in the page outline | `heading` (the level the outline needs; never skip a level) |
| Items that start open | `open => true` on those items (or `open` in a list item) |
| One open at a time | `exclusive => true` |
| Everything inside a panel (text, images, buttons, lists) | The view's own markup, with classes from the design |

Use the project's `@theme` colors and spacing (read the main CSS) instead of arbitrary values; use an arbitrary value only if no token matches and tell the user.

A design with different looks per item (a highlighted first item, a different icon) is fine: item-level `class`, `summary_class`, `icon_class` and `panel_class` replace the accordion-level ones for that item.

## Mobile

Accordions are responsive by nature: the row is a flex line, the title wraps, panels have no fixed height. Read the mobile frame for:

- a smaller title or padding → responsive Tailwind variants in the same class strings (`text-base md:text-xl`, `px-4 md:px-6`);
- a taller row on touch → already covered: the row is at least 44 px (`--accordion-min-height`).

If the mobile frame changes the structure (the icon moves, items become cards), say what changes and ask: the engine only moves the icon with `icon_position`.

## Shared across accordions → tokens, once

If two or more accordions repeat the same divider, padding, title style or icon size, do not paste it in every view. Define it once in the project CSS (after the `accordion.css` import) by redefining the engine variables:

`--accordion-min-height`, `--accordion-gap`, `--accordion-icon-size`, `--accordion-duration`, `--accordion-easing`, `--accordion-easing-out`.

For the rest (colors, borders, padding), define a project component class in the CSS and pass it in `item_class` / `summary_class` / `panel_class`. On the first accordion of a project, list the values you took as the project baseline and ask the user to confirm them. After that, new accordions inherit them.

## Stop and ask

- The design is tabs, a carousel, or a card that expands out of the flow: it is not an accordion.
- The design has a button or link inside the item title: the `<summary>` is already the button, and nested interactive elements are invalid.
- The design needs content loaded on open (from the server): the engine prints everything in the page.
- The design contradicts the spec (which item starts open, one open at a time).
- The mobile frame is missing: ask whether the desktop accordion should simply shrink, or whether a mobile frame will come.
- The design uses a font, color or spacing that is not in the project's CSS.
