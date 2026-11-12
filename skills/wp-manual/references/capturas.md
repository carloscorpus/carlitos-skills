# Screenshots

## Tool

- `capture.mjs` and `build.mjs` use **`playwright-core`** (the library only, no bundled browser) with **Edge or Chrome already installed** (`channel: msedge`, then `chrome`). They never download a browser.
- It is looked up in `--playwright-from <folder>`, then the theme, then the current folder. If missing, the scripts exit `5` with the install command for that folder. **Ask before installing.** Recommended: a tools folder outside the project (`mkdir <tools> && cd <tools> && npm init -y && npm install playwright-core`) and `--playwright-from <tools>`, so the theme is not touched. If the project prefers it as a dev dependency, use the command the script prints (pnpm/yarn/npm from the lockfile).
- No Edge nor Chrome: exit `5`; the user installs one of them.
- A plain `npm install playwright-core` folder works as is: no wrapper or shim is needed (the scripts take `chromium` from the CommonJS default export).

## Login

- With `MANUAL_USER` and `MANUAL_PASS` the form is filled automatically. A wrong user or password exits `6`.
- Without them (or with `--login-manual`) a visible browser opens on `wp-login.php`; the user signs in (10 minutes) and the session is used only for that run (it is not saved to disk).
- Use a local user **with the client's role** (e.g. Editor): the admin menu changes with the role and the screenshots must show what the client will see.

## Read-only

- Every request that is not GET gets a local `403` answer, except `wp-login.php`. It never reaches the server, so nothing can be saved, autosaved or sent; answering instead of aborting keeps the "network idle" wait from hanging.
- Captchas (reCAPTCHA, hCaptcha, Cloudflare Turnstile) always get an empty answer: they keep the network busy and leave their badge on the screenshots. Other third parties (chat, analytics, a slow embed) can be blocked the same way with `--bloquear <part-of-url,…>` or `MANUAL_BLOQUEAR=` in `.env.manual`.
- If the login form itself requires a captcha that the server validates, the automatic login fails (exit `6`): use `--login-manual`.
- Every page waits for "network idle" at most ~10 s and then continues.
- The page is never submitted; numbers, collapsed rows, the emptied field of the "obligatorios" rule and the red notice exist only on the screen.
- Opening an edit screen makes WordPress mark the page as "being edited" for a short time (as when a person opens it). Nothing else changes.

## What is captured

| Capture | Where |
|---|---|
| `login.png` | `wp-login.php`, signed out |
| `<chapter>-llegar.png` | the edit screen (pages, options) or the listing (contents), top of the screen |
| `<chapter>-<section>.png` | the section's ACF field (`.acf-field[data-name="<section>"]`), or the whole group box when the group is one section |
| `<chapter>-wordpress.png` | `#poststuff` of a post/CPT edit screen with `W1…W6` on the boxes it has |
| `<chapter>-<section>-web.jpg` | the web: the draft's `- **Web:**` selector; else, for pages, the root of the section's template (`#id`, `data-`, class) when it is one element, else the n-th top-level `section` of `<main>`; options: notice / footer / header by name. At most 900 px tall (one screen). See "Web reference" below |
| `regla-*.png` | from the first edit screen with ACF fields: Publish box, an empty required field with its notice, a list with collapsed rows and the mouse on a row, an image with its edit/remove buttons |
| `mapa.json` | per chapter and section: files and the numbers seen on screen (`check.mjs` compares them with the draft) |

All captures are at 2x (`deviceScaleFactor: 2`); admin in PNG, web in JPG (quality 82).

## Web reference

Before each web screenshot:

- animations and transitions are turned off on the whole page;
- if the element is `sticky` or `fixed`, it goes back to the normal flow (`position: static`);
- what an entrance animation left invisible (opacity near 0), in the element or inside it, is shown with `opacity: 1` and `transform: none`. Nothing else is touched, so rotated icons or elements centered with `translate` keep their look;
- the other fixed or sticky elements (header, floating buttons) are hidden;
- it scrolls to the element, waits, forces the visibility again and takes the element's own screenshot (`locator.screenshot`). An element taller than one screen is cut at 900 px.

## Flat screenshots

A screenshot with almost no distinct colors (one flat grey or white block) is a paint failure: it happens with tall ACF lists in the admin and with web elements still hidden. `capture.mjs` checks every screenshot and repeats a flat one once (scroll, wait, crop of the full page). If it is still flat it is marked in `mapa.json` and listed in `avisos`; `check.mjs` reports it as an error. Run `capture.mjs --chapter <id>` again.

## Numbering

Same rule in `acf-json` (init) and on screen (capture): visible fields in order, skipping `tab`, `accordion` and `message`; children of a repeater (first row) and of a group get the parent's number (`7.1`, `2.5.1`). Rows after the first are collapsed. A list without rows shows no children: `check.mjs` warns, the text stays in the manual.

## Troubleshooting

- A section "no se encontró en la pantalla de edición": the group's location changed or the page uses another template; run `status.mjs`.
- Web section not found, or "es el mismo elemento que la sección …": add `- **Web:** <selector>` in the draft (e.g. `#servicios`, `[data-indice]`) and run `capture.mjs --chapter <id>`.
- An extra chapter (`extra-envios.md`) warns that the user cannot see the screen: «Envíos» is for administrators. Run that chapter with an administrator in `.env.manual` (`--chapter extra-envios`) or put your own images with `- **Captura:**`.
- A post type with no published item: there is no edit screen to capture; publish one in the local site or accept the warning.
