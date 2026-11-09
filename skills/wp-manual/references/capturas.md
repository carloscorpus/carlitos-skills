# Screenshots

## Tool

- `capture.mjs` and `build.mjs` use **`playwright-core`** (the library only, no bundled browser) with **Edge or Chrome already installed** (`channel: msedge`, then `chrome`). They never download a browser.
- It is looked up in `--playwright-from <folder>`, then the theme, then the current folder. If missing, the scripts exit `5` with the install command for that folder. **Ask before installing.** Recommended: a tools folder outside the project (`mkdir <tools> && cd <tools> && npm init -y && npm install playwright-core`) and `--playwright-from <tools>`, so the theme is not touched. If the project prefers it as a dev dependency, use the command the script prints (pnpm/yarn/npm from the lockfile).
- No Edge nor Chrome: exit `5`; the user installs one of them.

## Login

- With `MANUAL_USER` and `MANUAL_PASS` the form is filled automatically. A wrong user or password exits `6`.
- Without them (or with `--login-manual`) a visible browser opens on `wp-login.php`; the user signs in (10 minutes) and the session is used only for that run (it is not saved to disk).
- Use a local user **with the client's role** (e.g. Editor): the admin menu changes with the role and the screenshots must show what the client will see.

## Read-only

- Every request that is not GET is aborted, except `wp-login.php`. Nothing can be saved, autosaved or sent.
- The page is never submitted; numbers, collapsed rows, the emptied field of the "obligatorios" rule and the red notice exist only on the screen.
- Opening an edit screen makes WordPress mark the page as "being edited" for a short time (as when a person opens it). Nothing else changes.

## What is captured

| Capture | Where |
|---|---|
| `login.png` | `wp-login.php`, signed out |
| `<chapter>-llegar.png` | the edit screen (pages, options) or the listing (contents), top of the screen |
| `<chapter>-<section>.png` | the section's ACF field (`.acf-field[data-name="<section>"]`), or the whole group box when the group is one section |
| `<chapter>-wordpress.png` | `#poststuff` of a post/CPT edit screen with `W1…W6` on the boxes it has |
| `<chapter>-<section>-web.jpg` | the web: pages `main > section` in order; options: notice / footer / header by name; or the draft's `- **Web:**` selector. At most 900 px tall (one screen), reduced motion, other fixed or sticky elements hidden |
| `regla-*.png` | from the first edit screen with ACF fields: Publish box, an empty required field with its notice, a list with collapsed rows and the mouse on a row, an image with its edit/remove buttons |
| `mapa.json` | per chapter and section: files and the numbers seen on screen (`check.mjs` compares them with the draft) |

All captures are at 2x (`deviceScaleFactor: 2`); admin in PNG, web in JPG (quality 82).

## Numbering

Same rule in `acf-json` (init) and on screen (capture): visible fields in order, skipping `tab`, `accordion` and `message`; children of a repeater (first row) and of a group get the parent's number (`7.1`, `2.5.1`). Rows after the first are collapsed. A list without rows shows no children: `check.mjs` warns, the text stays in the manual.

## Troubleshooting

- A section "no se encontró en la pantalla de edición": the group's location changed or the page uses another template; run `status.mjs`.
- Web section not found: add `- **Web:** <selector>` in the draft (e.g. `#servicios`, `main > section:nth-of-type(3)`) and run `capture.mjs --chapter <id>`.
- A post type with no published item: there is no edit screen to capture; publish one in the local site or accept the warning.
