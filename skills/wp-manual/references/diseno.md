# PDF design

Approved with NERD on the copam pilot. Black and white, NERD logos, title font Archivo Black, text Inter (both in `assets/fuentes/`, SIL OFL 1.1; licenses next to them).

## Formats

| Format | Page | Section page |
|---|---|---|
| `horizontal` | 1920 × 1080 (16:9) | Left half: admin screenshot (up to 620 px) + web reference (up to 280 px). Right half: summary, numbered list, reminder. |
| `vertical` | 1240 × 1754 (A4 ratio) | Top: summary, admin (up to 690 px) + web (up to 370 px). Bottom: numbered list (two columns with more than 7). The images take the height the text leaves free, up to 72% of the page (measured in the browser before printing). |

`--formato ambos` builds both (the default until the team picks one; set `MANUAL_FORMATO` in `.env.manual`).

## Pages

1. Cover (black): client, "Manual de administración", legal name, date, NERD logo.
2. Contents: only the main parts (Login, Reglas generales, one line per chapter).
3. Black separator before each part: big title + frame with the NERD eyes.
4. Login: screenshot + steps with the real panel address.
5. General rules: the four rules with their screenshots.
6. Per chapter: "Dónde se edita" (screenshot + "Cómo llegar" + note) and one page per section.

Every white page: top bar `CLIENTE · MANUAL DE ADMINISTRACIÓN` and, on the right in bold, `CAPÍTULO · NN SECCIÓN` (the only title of the page); bottom right the NERD logo and the page number. Section pages end with the reminder «Después de editar, haz clic en Actualizar. Reglas generales en la pág. N.»

The admin screenshot is always larger than the web one; badges are black pills (first level) or outlined (inside a list), the same as on the screenshot.

## Brand files

`assets/marca/`: `logo-nerd-blanco.png`, `logo-nerd-negro.png`, `ojitos-nerd-blanco.png`, `ojitos-nerd-negro.png` (transparent, extracted from small PNGs). Replace them with versions from the original SVG keeping the same names.

## Report

`reporte.pdf` is plain A4 for the team: chapters (sections, fields, screenshots, state), what is not covered and why, errors and warnings. It is not given to the client.
