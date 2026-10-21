# Motion

The design decides whether there is motion. If it does not say, offer the options below and recommend one. Never add motion the user did not accept.

## What the engine animates

| Part | Animation | Needs |
|---|---|---|
| Panel height | grows from 0 to its natural height on open and shrinks on close | `::details-content` + `interpolate-size` (CSS only) |
| Icon | the chevron turns 180°; the plus loses its vertical bar (becomes a minus) | nothing special |

Timing follows Material: open 225 ms decelerating (`--accordion-easing`), close the same time with a neutral curve (`--accordion-easing-out`). Change them for every accordion by redefining `--accordion-duration`, `--accordion-easing`, `--accordion-easing-out`.

## Options

| Option | When |
|---|---|
| `motion => 'auto'` (default) | Height and icon animate. Recommended for most designs |
| `motion => 'none'` | The design is static, or the panels hold heavy content (long lists, large images) where animating the height would stutter |

## How it degrades

- **`prefers-reduced-motion: reduce`**: no animation at all; the item opens and closes instantly. The engine handles it: do not add your own transitions.
- **Browsers without `::details-content` or `interpolate-size`** (Firefox, older Safari): the height does not animate, the icon still does. The accordion opens and closes correctly, which is the expected experience there.
- **Without JavaScript**: identical; the motion is CSS.

## Rules

- No motion that moves the page's content horizontally, no bounces, no opacity-only reveals that leave the space reserved.
- Do not animate with JavaScript (`height` in `requestAnimationFrame`, `scrollHeight` measurements): it is what the CSS replaces.
- Do not put `transition: all` on the summary or the panel; it animates properties the engine owns.
- An item that is opened from a `#hash` or from find-in-page opens with the same motion; that is expected.
