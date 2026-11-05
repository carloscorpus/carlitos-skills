# The encoder: sharp

Used in step 2 of SKILL.md. Node cannot write WebP by itself, so the skill needs an encoder. It uses `sharp` (built on libvips), and it is **not bundled**: the script takes the `sharp` that the project already has, so the skill itself stays free of dependencies and installs nothing on its own.

## Why sharp

- It writes WebP with transparency, applies the EXIF orientation and resizes with the same proportion, all in one pass.
- It ships prebuilt binaries as `optionalDependencies` (for example `@img/sharp-win32-x64`): nothing is compiled. `sharp` 0.35.5 has **no `install` script** (its `build` script is not a lifecycle hook), so `pnpm add -D sharp` does not trigger the "unapproved build scripts" check of a project with `strictDepBuilds: true` or `allowBuilds`. Verify it on the first install in a project that has those rules.
- The alternatives are worse for this job: `cwebp` is an external program that does not travel with the project, ImageMagick is heavy, and WASM encoders are slower and add their own dependencies.

## How it is found

`webp.mjs` looks for `sharp` with normal Node resolution, first from `--sharp-from <folder>` and then from the project root (so a `node_modules` in the project or in a parent folder works). `--check-encoder` reports where it was found and its version.

## When it is missing

The script exits with `5` and prints `instalar.comando`, chosen from the project's `packageManager` field or its lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`; without hints, pnpm):

| Manager | Command |
|---|---|
| pnpm | `pnpm add -D sharp` |
| yarn | `yarn add -D sharp` |
| npm | `npm install --save-dev sharp` |

Show it and **ask before running it**. Respect the project's own rules: a theme whose `CLAUDE.md` says "only pnpm, never npx" or "do not approve builds without asking" keeps those rules; its `minimumReleaseAge` also applies, so a `sharp` version published today may not install yet. `-D` is right: the encoder is only used while preparing images, never in production.

## A project without package.json (or without node_modules)

Install `sharp` in any folder (for example a temporary one with `pnpm add sharp`) and pass it: `--sharp-from <that folder>`. The tests do the same through the `IMG_WEBP_SHARP_FROM` environment variable.

## Exit codes of `webp.mjs`

`0` ok · `1` wrong usage (two modes, bad number, a path outside the project, nothing to restore) · `5` no encoder.
