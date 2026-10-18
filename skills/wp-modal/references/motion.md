# Motion: animations and micro-interactions

Figma's motion wins. If the design has no motion spec, offer the options below that fit the panel type, recommend one, and let the user choose. Everything is CSS (transitions on the native dialog); `prefers-reduced-motion` is handled by the engine (only a 120 ms fade remains). No JS animation libraries.

## Entrance / exit (`motion`)

| Option | What the user sees | Recommended for | Cost |
|---|---|---|---|
| `scale` | Fade in with a small rise and scale (0.98 → 1), 225 ms in / 195 ms out | Centered modal, confirmation | Default for `center` |
| `fade` | Plain fade, 225 ms in / 195 ms out | Lightbox, anything where movement distracts | Lightest |
| `slide` | From the edge: right/left drawer, bottom sheet; on a centered modal a longer rise, 225 ms in / 195 ms out | Drawer, bottom sheet | Default for `right`, `left`, `bottom` |
| `none` | Appears instantly | The user asked for no animation | None |

On mobile, `mobile => 'sheet'` slides up from the bottom automatically (unless `motion => 'fade'`).

## Micro-interactions

| Option | What it is | Where | How |
|---|---|---|---|
| Staggered content | Body children enter one after another (45 ms apart, the first 5) | Modals with a few distinct blocks (promo: image, title, text, button). Not for forms or long text | `stagger => true` |
| Close button feedback | Subtle press/hover response | Any | `close_class` with Tailwind: `transition-transform active:scale-90` (hover background is already in the engine) |
| Primary button feedback | Hover lift or press scale | CTAs inside the modal | Classes on the button from the frame, e.g. `transition active:scale-95` |
| Success state | After a form is sent, the status text appears (wp-form) and the modal closes after 2 s | Contact / quote forms | `form_success => 'close'`; with `keep` the message stays |
| Backdrop fade | Dimmed backdrop fades with the panel | Always | Built in; color via `--modal-backdrop` |
| Image reveal | Image fades in when loaded | Lightbox | `class` on the `<img>`: `opacity-0 transition-opacity` plus the loaded state — only if the user asks; otherwise skip |

## How to ask

One short question with the options for that panel type and a recommendation, for example for a centered modal: "Motion: `scale` (recommended, soft rise and fade), `fade` or `none`. Staggered content: yes/no (recommended no, there is one block)". Do not ask if Figma defines it or the spec says.

## Tuning

Timing follows Material: the panel enters decelerating (`--modal-easing: cubic-bezier(0, 0, 0.2, 1)`, 225 ms) and leaves shorter with a neutral curve (`--modal-easing-out: cubic-bezier(0.4, 0, 0.6, 1)`, 87 % of the entrance, 195 ms). Durations and easing are variables: `--modal-duration`, `--modal-slide-duration`, `--modal-easing`, `--modal-easing-out`, `--modal-stagger`. Change them once in the project CSS, not per modal. Keep durations under 400 ms; anything longer feels slow on repeated use.

## Why `overflow: clip` on the dialog

`showModal()` focuses the first control (the close button) at once, while a drawer is still translated off-screen. On an `overflow: hidden` container the browser scrolls it to reveal the focused element, so the drawer seems to jump or "bounce" sideways while the transform runs. `overflow: clip` crops the same but cannot be scrolled. Do not change it back to `hidden`.

## Do not

- Do not animate `width`, `height` or `top`/`left`: only `opacity` and `transform` (they do not cause layout work).
- Do not auto-play looping animations or moving backgrounds inside a modal.
- Do not add your own `transition` on `.modal__panel`: it would fight the engine's.
