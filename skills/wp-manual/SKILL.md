---
name: wp-manual
description: 'Generate the client''s administration manual (PDF) of a WordPress theme whose content is managed with ACF Pro: login, general rules, site options, every page with its numbered fields (1, 2… 7.1, 2.5.1), posts and custom post types, menus and logo. Reads acf-json/ and the design-import/wp-acf specs, Claude drafts the texts in specs/manual/ for the user to review, then it takes read-only screenshots of the local site (admin with numbered fields + the web section as reference) and builds the PDF in landscape (16:9), portrait (A4) or both, plus a separate simple coverage report for the team. Use when the user asks for "manual", "manual de usuario", "manual del cliente", "manual de administración", "manual del admin", "documenta el admin", "cómo se administra la web", or at the end of a project after wp-acf.'
metadata:
  version: "1.0.0"
---

# wp-manual

At the end of every project the client gets a manual that explains, from the login to every field, what they can edit. Doing it by hand (Canva, screenshots, arrows) takes days and repeats the same text on every page. This skill builds it from what the project already has: the ACF field groups (`acf-json/`), the pages list (`inc/acf/paginas.php` from wp-acf or `specs/_index.md` from design-import) and the templates.

The manual is for the **client**: plain Spanish, the business names (not the code names), recommendations and never limits. It never changes the site: screenshots are taken on the **local** site in read-only mode (every request other than GET is blocked, except the login form), so nothing can be saved.

| File | Created by | Notes |
|---|---|---|
| `.env.manual` (project root) | `init.mjs` (empty) | `MANUAL_URL`, `MANUAL_USER`, `MANUAL_PASS`, `MANUAL_FORMATO`. Added to `.gitignore`. Local credentials only. **Remind the user to delete it at the end.** |
| `specs/manual/_manual.md` | `init.mjs` | Cover data: client, legal name, real panel address (`https://<domain>/wp-admin`), date |
| `specs/manual/<chapter>.md` | `init.mjs` (skeleton) + Claude (texts) | One draft per chapter; the user reviews it. Format: [references/borrador.md](references/borrador.md) |
| `specs/manual/capturas/` | `capture.mjs` | PNG/JPG at 2x and `mapa.json` (the numbers actually seen) |
| `specs/manual/salida/` | `build.mjs` | `manual-horizontal.pdf`, `manual-vertical.pdf`, `reporte.pdf` (+ their `.html`) |

`specs/` is never uploaded to the server. Coverage of this version (what is done, partial or missing): [COBERTURA.md](COBERTURA.md).

Every script runs from the theme root (`<skill>` = this skill's folder), prints JSON and accepts `--out <folder>` and `--env <file>` to write **outside** the theme (a project that must not be touched: everything goes to that folder and nothing is written in the theme).

## Steps

1. **Read context.** `node <skill>/scripts/status.mjs`: theme and helper prefix, the chapters it found (options pages, pages and which ones share a group, posts/CPT, menus and logo), what is not covered and why, `.env.manual`, drafts, screenshots, `playwright-core` and `next`. Do not explore the theme to find the same things.

2. **`.env.manual` first.** `node <skill>/scripts/init.mjs`. When the file does not exist it creates it empty, adds it to `.gitignore` and exits with code `4`: **stop and ask the user to fill it** (`MANUAL_URL` of the local site, e.g. `http://copam.local`; `MANUAL_USER`/`MANUAL_PASS` of a local user **with the client's role**, e.g. Editor, so the screenshots show the menu the client sees; never production credentials). Without user/password the login is done by hand in a visible browser. When the user says it is filled, run `init.mjs` again: it writes `_manual.md` and one draft per chapter with the field numbers from `acf-json` (same order as the admin). Running it again later keeps the texts already written.

3. **Write the drafts (Claude).** Replace every `PENDIENTE` following [references/redaccion.md](references/redaccion.md): the section summary, the steps of "Cómo llegar" when needed, and one short sentence per number. Read the page spec (`specs/<page>.md`: behavior, what is automatic), the template of each section and the field type. Rules that `check.mjs` enforces:
   - never a number of characters;
   - images and galleries: `Recomendado: hasta 2000 px en el lado más largo, horizontal.` (or `vertical`, `cuadrada`), no fixed sizes;
   - `*asteriscos*` / `|barras|` only in the fields marked with highlight (the template prints them with `<prefix>_highlight`), and always explained there;
   - say what fills itself (lists of posts, counters) and what happens when an optional field is empty.

   Fill `Dirección del panel` in `_manual.md` with the real domain (ask the user). With more than five chapters, give each chapter to a subagent (same rules, one draft each). **Show the drafts to the user and wait for their review.**

4. **Browser tool.** `capture.mjs` and `build.mjs` need `playwright-core` (not bundled) and Edge or Chrome already installed (they never download a browser). It is taken from the project or from `--playwright-from <folder>`. If `status.mjs` says it is missing, **ask before installing**; recommend a tools folder outside the project (`npm install playwright-core` there, then `--playwright-from <that folder>`), so the theme's `package.json` is not touched. Detail: [references/capturas.md](references/capturas.md).

5. **Screenshots.** `node <skill>/scripts/capture.mjs [--playwright-from <folder>]` (optionally `--chapter <id>`). Read-only. It numbers the fields on the admin screenshot like the draft, collapses extra rows of every list, hides the grey help text, and captures the web reference of each section (at most one screen, reduced motion). When a section of the web is not found (exit JSON `avisos`), add `- **Web:** <css selector>` to that section in the draft and capture that chapter again.

6. **Check.** `node <skill>/scripts/check.mjs`. Errors: missing texts, characters, image wording, highlight where the template does not use it. Warnings: numbers that the screenshot does not show (a list with no rows), sections that no longer exist, what is not covered. Fix the drafts and run it again.

7. **Build.** `node <skill>/scripts/build.mjs [--formato horizontal|vertical|ambos]` (default: `MANUAL_FORMATO` of `.env.manual`, else both). With errors it only writes the report (use `--force` only if the user asks). Look at a few pages of the PDF before handing it over.

8. **Close.** Give the user the PDF paths and a short summary of `reporte.pdf` (what was not covered and why). **Remind them to delete `.env.manual`.** Do not commit the generated PDFs unless the user asks.

## Rules

- Never click "Actualizar"/"Publicar", never submit a form, never use production credentials.
- Screenshots and texts are of the **local** site; the manual names the real panel address from `_manual.md`.
- A group used by several pages (same template) is one chapter that names all of them; a common section is explained once and mentioned briefly where it appears.
- WooCommerce, in-admin help and videos/GIF are not in this version ([COBERTURA.md](COBERTURA.md)): say so if the project needs them.

## References

- [references/redaccion.md](references/redaccion.md): tone, wording per field type, uniform recommendations, highlight.
- [references/borrador.md](references/borrador.md): draft format (`Cómo llegar`, sections, `- **N** Label — text`, `Web:`).
- [references/capturas.md](references/capturas.md): playwright-core, login, read-only, numbering, web reference, troubleshooting.
- [references/diseno.md](references/diseno.md): the PDF design (formats, cover, separators, section page), fonts and logos.
