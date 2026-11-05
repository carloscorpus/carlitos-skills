---
name: img-webp
description: 'Convert the PNG, JPG and JPEG images of a project (a WordPress theme or any folder) to WebP: same names with .webp, originals moved to a backup folder, sizes kept except images wider than 2000 px, and every reference (PHP, CSS, JS, specs) updated. SVG, GIF, AVIF and WebP are never touched. Works on one image, a folder or the whole project, and can undo itself. Independent of the other skills. Use when the user asks to convert images to webp, "convierte esta imagen a webp", "pasa las imágenes a webp", "optimiza las imágenes", "comprimir imágenes", "las imágenes pesan mucho", "imágenes pesadas", gives an image or a folder to convert, or when another skill (design-import) suggests it.'
metadata:
  version: "1.0.0"
---

# img-webp

Heavy PNG and JPEG files are the usual reason a page loads slowly: a design export can leave 6 to 9 MB photos in a theme. This skill converts them to WebP, keeps each image's own size (only a width above 2000 px is reduced to 2000 px, never enlarged), keeps transparency, moves the originals to a backup folder (never deletes them) and updates every place that names the old file.

It is **independent**: no other skill is needed and it does not assume WordPress. It only needs an encoder, `sharp`, which is **not** bundled: it is taken from the project (or from `--sharp-from`), and if it is missing the skill gives the exact install command and installs nothing on its own. Node alone cannot write WebP.

| File | Created by | Per project? |
|---|---|---|
| `<name>.webp` next to each original | `scripts/webp.mjs --apply` | Yes: the converted image |
| `src/img-originales/` (or `img-originales/` when there is no `src/`) | same | Yes: the moved originals, same folder structure. `src/` is not uploaded to the server |
| `img-webp.manifest.json` inside the backup | same | Yes: what was converted and which references changed, for the report and for `--restore` |

Detail lives in `references/` and is read only by the step that points to it. The engine is `scripts/webp.mjs` plus `scripts/webp/`; `scripts/lib/` is a generated copy (edit `shared/` and run `node scripts/sync-shared.mjs`, never the copy).

## Steps

1. **Read context.** What the user wants converted: one image, a folder, or "the project". From the project root run `node <skill>/scripts/webp.mjs --scan` (`<skill>` = this skill's folder), or `--scan <path>` for what they named. Without a path it looks at `assets/img`, `src/img`, `public/images`, `images` and `img`; if none exists, ask for the path. It only reads.

2. **Check the encoder.** `node <skill>/scripts/webp.mjs --check-encoder`. Exit `5` means `sharp` is missing: show the command it prints (`pnpm add -D sharp`, `yarn add -D sharp` or `npm install --save-dev sharp`, chosen from the project's lockfile) and **ask before running it**; follow the project's own package rules (a theme that forbids `npx` or an unapproved build step keeps forbidding them). If the project has no `package.json`, install `sharp` in any folder and pass `--sharp-from <folder>`. Read [references/herramienta.md](references/herramienta.md) when it is not obvious.

3. **Scan and ask only what is missing**, in one message (AskUserQuestion when available), always with a recommendation. The scan lists, per image, its real format (by its bytes, not its extension), size, weight and whether it would be reduced; what it ignores (SVG, GIF, AVIF, WebP) and warnings such as a `.png` that is really a JPEG. Ask only for what the user did not say: the scope when it is unclear, a different backup folder when the default does not fit, a different maximum width. Read [references/tamanos-y-calidad.md](references/tamanos-y-calidad.md) before changing a rule.

4. **Dry run.** `node <skill>/scripts/webp.mjs --dry-run <paths>` encodes in memory and writes nothing. Show the real savings per image (before and after, sizes), what would be reduced, what is omitted and why (an image whose WebP is not lighter keeps its original), and the references that would change with `file:line`. Read [references/referencias.md](references/referencias.md) for what to do with ambiguous references (they are listed and never touched). If no reference is found, the project is new: only the images are converted, and whoever writes the templates uses the `.webp` names.

5. **Apply.** `node <skill>/scripts/webp.mjs --apply <paths>`, with the same paths and options as the dry run. Ask for confirmation first only when the preview shows ambiguous references, many files changed, or a scope the user did not name; a user who gave the exact image or folder and said "convert" does not need another question.

6. **Report.** Per image before and after (weight and size), the total saved, what was omitted and why, the references changed, the backup path and the manifest, and the warnings the tool printed (a WordPress theme must upload `assets/` together with `dist/`; with `wp-acf`, an image is identified by its path, so a new `.webp` path creates a new media item and the old one stays unused).

7. **Verify.** Run `--scan` again on the same paths: no PNG or JPEG should be left except the ones reported as omitted. If PHP or CSS changed and the project has a build, run it. `node <skill>/scripts/webp.mjs --restore` undoes everything (originals, `.webp` files and references) from the manifest.

## Rules

- Only PNG and JPEG, decided by the real format. SVG, GIF, AVIF and WebP are never touched.
- Each image keeps its size. Only a width above 2000 px is reduced to 2000 px, with the same proportion. Never enlarge: a small image stays small.
- Quality 80, transparency kept, EXIF orientation applied, metadata removed. If the WebP is not lighter, the original stays.
- Originals are moved to the backup, never deleted. A `.webp` that already exists is not redone (unless `--force`), so running it twice changes nothing.
- A reference is replaced only when its file name is unambiguous. `specs/figma/lectura/` is never edited: it describes what Figma delivered and its validator needs the type to match the extension.
- Another skill that writes templates for images that are not WebP should offer this one first, so the templates are born with `.webp` names. Offer it once; if the user declines, continue.

## Reference

- [references/herramienta.md](references/herramienta.md): why `sharp`, how it is found, install commands, projects without `node_modules`.
- [references/tamanos-y-calidad.md](references/tamanos-y-calidad.md): the size and quality rules and why.
- [references/referencias.md](references/referencias.md): how references are found and replaced, what is ignored, ambiguous cases, `wp-acf`.

## Do not

- Do not install `sharp` or any package without the user's go-ahead.
- Do not delete originals, and do not run `--apply` on a folder the user did not name.
- Do not convert SVG, GIF, AVIF or images outside the project.
- Do not edit `scripts/lib/`.
- Do not edit `specs/figma/lectura/` or any file the tool lists as ignored.
- Do not consider the job done while `--scan` still lists convertible images that were not reported as omitted.
