# PDF design

Approved with NERD on the copam pilot. Black and white, NERD logos, title font Archivo Black, text Inter (both in `assets/fuentes/`, SIL OFL 1.1; licenses next to them).

## Formats

| Format | Page | Section page |
|---|---|---|
| `horizontal` | 1920 × 1080 (16:9) | Left column (940 px): admin screenshot and, where it fits, the web reference. Right column: summary, numbered list, reminder. Placement of the web image below. |
| `vertical` | 1240 × 1754 (A4 ratio) | Top: summary, admin (up to 690 px) + web (up to 370 px). Bottom: numbered list (two columns with more than 7). The images take the height the text leaves free, up to 72% of the page (measured in the browser before printing). |

### Web image in the horizontal format (measured in the browser before printing)

1. **Below the admin**, in the left column, when the admin stays 560 px wide or more.
2. Else **below the text**, in the right column, when it fits 420 px wide or more.
3. Else **side by side** with the admin, never wider together than the 940 px column: the admin at full height; the web takes what is left if it is 300 px or more, otherwise the admin keeps at least 560 px (readable) and the web takes the rest.

`build.mjs` measures every page: an image over a text, or out of the page, is reported in `solapes` and in `salida/revision-<formato>.json` (`check.mjs` reads it too).

### Two sections on one page (`--juntar`)

Horizontal only. Two consecutive sections of the same chapter share a page, in two bands, when, for one of several splits of the height, the text of both fits, each admin stays 380 px wide or more (and at least half its width) and each web image 300 px or more. The header reads «Capítulo · 01 X · 02 Y» and the reminder appears once. Pages and the contents are renumbered afterwards.

`--formato ambos` builds both (the default until the team picks one; set `MANUAL_FORMATO` in `.env.manual`).

## Pages

1. Cover (black): client, "Manual de administración", legal name and date (both optional: empty, not printed), NERD logo.
2. Contents: only the main parts (Login, Reglas generales, one line per chapter).
3. Black separator before each part: big title + frame with the NERD eyes.
4. Login: screenshot + steps with the real panel address.
5. General rules: the four rules with their screenshots (only those captured) and the fixed one «Lo que no se edita en cada página» (breadcrumbs are fixed; header and footer are edited once in the options page).
6. Per chapter: "Dónde se edita" (screenshot + "Cómo llegar" + note) and one page per section (or two short ones together with `--juntar`). Chapters with `Incluir: no` are left out; extra chapters go at the end, and a section of theirs without screenshot is a text-only page.

Every white page: top bar `CLIENTE · MANUAL DE ADMINISTRACIÓN` and, on the right in bold, `CAPÍTULO · NN SECCIÓN` (the only title of the page); bottom right the NERD logo and the page number. Section pages end with the reminder «Después de editar, haz clic en Actualizar. Reglas generales en la pág. N.»

The admin screenshot is always larger than the web one; badges are black pills (first level) or outlined (inside a list), the same as on the screenshot.

## Brand files

`assets/marca/`: `logo-nerd-blanco.png`, `logo-nerd-negro.png`, `ojitos-nerd-blanco.png`, `ojitos-nerd-negro.png` (transparent, extracted from small PNGs). Replace them with versions from the original SVG keeping the same names.

## Report

`reporte.pdf` is plain A4 for the team: chapters (sections, fields, screenshots, state), what is not covered and why, errors and warnings. It is not given to the client.
