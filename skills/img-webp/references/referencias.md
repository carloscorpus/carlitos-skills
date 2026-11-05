# References: what changes when a file is renamed

Used in steps 4 to 6 of SKILL.md. After `hero.jpg` becomes `hero.webp`, every place that names the old file must point to the new one. The tool does it with the same function for the preview (`--dry-run`) and for the real run (`--apply`), so what the preview shows is exactly what changes.

## What is searched

The text files of the project root: `php`, `css`, `scss`, `js`, `ts`, `tsx`, `jsx`, `vue`, `html`, `twig`, `md`, `json`, `yml`, `xml`. It matches the **file name** (`hero.jpg`), alone or inside a path (`'hero.jpg'`, `assets/img/hero.jpg`, `url("../assets/img/hero.jpg")`, `https://site.com/themes/x/assets/img/hero.jpg`). A name that is part of another (`my-hero.jpg`, `hero.jpgx`) is not touched. Line endings (LF or CRLF) are kept.

## What is ignored

`node_modules`, `dist`, `build`, `vendor`, `.git`, `.next`, `.nuxt`, `coverage`, lockfiles, minified files, the backup folder, and `specs/figma/lectura/`. That last one describes what Figma delivered, and `design-import`'s validator requires its `tipo` to match the file extension, so it must not be edited. The `.ref.txt` files of Figma's reference code live there too.

## Ambiguous references (never touched, always listed)

- Two converted files with the same name in different folders (`img/a/foto.jpg`, `img/b/foto.jpg`): a bare `'foto.jpg'` cannot be assigned. A reference with a path that identifies one of them is replaced.
- A path that does not fit the converted file (`other/dir/hero.jpg` when the converted one is `assets/img/hero.jpg`): it is probably another file.

They appear under `referencias.ambiguas` with `file:line` and the reason; fix them by hand, then rerun the scan.

## Not detected

Names built at run time (`'hero.' . $ext`), names stored in a database (the WordPress media library, ACF fields already saved) and anything outside the project. Say so in the report when the project is WordPress with saved content.

## wp-acf

`wp-acf` identifies each image it uploads to the media library by its **path** inside the theme. After converting, a load with the new `.webp` path creates a new media item and the old `.jpg` or `.png` item stays unused. Convert **before** the ACF load (a new project) to avoid duplicates; in a project that already loaded its content, tell the user the old media items can be deleted from the library.

## New project and design-import

When nothing references the images yet, only the files are converted. The skill that writes the templates (for example `design-import`) should be told the final names, which are the same names with `.webp`. The Figma reading in `specs/figma/lectura/` keeps describing the original download on purpose.

## Undo

The manifest (`img-webp.manifest.json`, inside the backup folder) records every converted image and every changed reference. `--restore` moves the originals back, removes the `.webp` files and puts the old names back, line by line. If a line changed meanwhile, that one is reported and left alone.
