# Opening by itself

Off by default. Only if the project asked. Opening a dialog nobody requested interrupts the user, so every choice below should be deliberate.

## Options (`auto`)

| Key | Values | Notes |
|---|---|---|
| `on` | `delay` \| `load` \| `scroll` | `load`: on the next frame; `delay`: after `delay` ms (recommend 5000+); `scroll`: after `scroll` % of the page (default 50) |
| `repeat` | `always` \| `session` \| `days:N` | Default `session`. `days:N` remembers in `localStorage` |
| `min_width` | px | Skip below this width. `768` skips phones |

The decision is made in the browser, not in PHP, so it works with any page cache.

## Tell the user

- **Mobile interstitial risk.** A full-screen popup on arrival from search can be penalized by Google and annoys users. Recommend `min_width`, or `scroll`/`delay` instead of `load`, and a visible close button (always present).
- **Storage.** `session` uses `sessionStorage`; `days:N` uses `localStorage`. If storage is blocked the modal behaves as `always`. If the site has a cookie banner, check whether this counts as non-essential storage in the project's jurisdiction.
- **One at a time.** It never opens over another open modal.
- **Dialogs required by law** (cookie consent, age gate) are a separate decision; this skill does not make them.
- **Not on every page.** Limit it to the pages that need it by printing the view only there.

## Verify

Load the page in a private window (storage empty), wait the delay or scroll, confirm it opens once, close it, reload and confirm it respects `repeat`. Also check with keyboard only: focus lands inside, Esc closes, focus returns to the page.
