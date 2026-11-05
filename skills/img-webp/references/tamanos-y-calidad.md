# Size and quality rules

Used in steps 3 and 4 of SKILL.md, before changing any default.

## What is converted

PNG and JPEG (`.png`, `.jpg`, `.jpeg`), decided by the **real format** read from the first bytes: a `.png` that is really a JPEG (a design export can do that) is converted as a JPEG and the scan warns about it. SVG, GIF, AVIF and WebP are never touched. A file with an image extension that is not an image is listed as unknown and left alone.

## Size: keep it, except above 2000 px

- Every image **keeps its own size**. Only a width above 2000 px is reduced to 2000 px, with the same proportion. Nothing is ever enlarged: a 353 px logo or a 720 px photo stays as it is, because enlarging adds no detail and makes the file heavier.
- 2000 px covers high-density screens for a box up to 1000 px wide. The widest box of the test design is 940 px.
- The rule looks at the width **as displayed**: a photo with EXIF orientation 6 (rotated) has its width and height swapped before comparing. A portrait 2731×4096 becomes 2000×3000. If a heavy portrait should be smaller, lower it for that run with `--max-width`.
- This skill never resizes to the box where the image is shown (that is a design decision) and does not generate `srcset` variants.

## Quality

- **Quality 80**, lossy, with `alphaQuality 100` so transparency edges stay clean. `--quality` changes it.
- **Transparency is kept.** A PNG that declares an alpha channel but is fully opaque becomes an opaque WebP (nothing is lost). The two logos of the test theme kept their transparency.
- **EXIF orientation is applied** and the other metadata is removed.
- **If the WebP is not lighter than the original, the original stays** and the image is reported as omitted. A tiny flat PNG can be heavier as lossy WebP.
- A `.webp` that already exists is not rebuilt (`--force` does it).

## Real numbers

On the 10 raster images of the `angelitozzz` test theme: 32.7 MB became 970 KB (97 % less). The 7.5 MB hero photo became 76 KB at 2000×1333; side by side with the original there is no visible difference. Four images were reduced (they were wider than 2000 px); the six smaller ones kept their size.

## Not done

AVIF, animated GIF, responsive `srcset` sets, and any change to how the page uses the image.
