---
name: wp-vite-theme
description: Scaffold a new WordPress theme (Local WP) with Vite + JS + Tailwind (latest) + pnpm. Use when the user starts a new WP theme project, says "inicia tema", "nuevo tema wp", "scaffold theme", "arranca proyecto wp con vite", or asks for the usual enqueue.php / vite.config.ts / style.css / header / footer base.
---

# wp-vite-theme

Generate the standard theme base. Only names change per project. Templates live in `templates/` (`*.tpl`), placeholders use `{{...}}`. `scripts/scaffold.mjs` (next to this file) copies and fills them; never copy or replace templates by hand.

## Placeholders

| Placeholder | Example | Used for |
|---|---|---|
| `{{THEME_NAME}}` | `Claudio` | `Theme Name`, visible title |
| `{{THEME_SLUG}}` | `claudio` | folder name, text domain, asset handles, log tag |
| `{{PREFIX}}` | `claudio` | PHP function prefix (`claudio_enqueue_assets`) |
| `{{PREFIX_UPPER}}` | `CLAUDIO` | PHP constants (`CLAUDIO_VITE_DEV_SERVER`) |
| `{{AUTHOR}}` | `Nerd y sus colaboradores` | `Author` |
| `{{THEME_URI}}` | `https://claudio.com` | `Theme URI` |

The Vite `base` needs no placeholder: `vite.config.ts` derives the theme folder with `basename(import.meta.dirname)`.

## Steps

1. **Detect context.** cwd should be `.../wp-content/themes/<slug>`. Slug = folder name (the script derives it and `PREFIX`/`PREFIX_UPPER`). Ask the user only for what is missing (visible name, author, URI). Never guess author. Also grep the site's `wp-config.php` (`../../../wp-config.php`) for `WP_ENVIRONMENT_TYPE`: it must be `local` or `development`, otherwise dev mode never activates (WP defaults to `production`). Warn the user if not.
2. **Check existing files.** Run a dry run from the theme root (`<skill>` = this skill's folder):
   ```
   node <skill>/scripts/scaffold.mjs --name "<name>" --author "<author>" --uri "<uri>" --dry-run
   ```
   It prints JSON with `create` and `conflicts`. If `conflicts` is non-empty, show them and ask the user, file by file, whether to overwrite or keep. Never decide for them.
3. **Generate files.** Same command without `--dry-run`, plus `--overwrite a,b` / `--skip c,d` covering every conflict (paths exactly as listed). Exit codes: `0` ok, `1` invalid input (fix and ask the user if needed), `2` unresolved conflicts, `3` leftover placeholders (a template uses an unknown `{{KEY}}`: fix the script/template, do not patch output by hand). On non-zero exit nothing is written. Do NOT create `index.html` (not needed in WP themes) nor ACF files (user creates those from the admin).
4. **package.json.** If missing: `pnpm init`, then set `"private": true`, `"type": "module"`, `"description": "Tema WordPress <slug>"`, `"license": "UNLICENSED"`, `"engines": { "node": ">=<major of node --version>" }`, scripts `dev: vite` and `build: vite build` only (no `preview`, it does not apply to a WP theme). Remove `main` and the default `test` script.
5. **Install deps.** Security config lives in `pnpm-workspace.yaml` (copied in step 3). Then:
   ```
   pnpm add -D vite@latest tailwindcss@latest @tailwindcss/vite@latest @types/node@^<major of node --version>
   ```
   - `minimumReleaseAge: 1440` (minutes) is the decided value. Respect it. NEVER lower it, pass flags to skip it, edit `.npmrc`/global pnpm config, or use npm/yarn/npx.
   - If pnpm rejects a version as too new, let it resolve the newest allowed one. Report it.
   - If the lockfile fails the policy check (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`), run `pnpm clean --lockfile` then `pnpm install`. Report it.
   - `strictDepBuilds` blocks dependency build scripts. If one is blocked, report which and why; allow only the essential ones via `allowBuilds` (the valid pnpm 12 setting name). Never approve blindly.
   - pnpm 12 fails on unknown keys in `pnpm-workspace.yaml` (`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`). Check names against pnpm.io/settings if a key errors.
6. **Verify integrations are still current.**
   - WebFetch `https://tailwindcss.com/docs/installation/using-vite` before trusting `vite.config.ts.tpl` / `input.css.tpl`. If the major changed the plugin name or CSS import, adapt to the docs and update the templates.
   - Grep `node_modules/vite/dist/node/index.d.ts` for `@deprecated` on options the config uses (e.g. `rolldownOptions` vs `rollupOptions`). Update the template if something is deprecated.
7. **Validate.** Detect the OS first (`node -p process.platform`: `win32`, `darwin`, `linux`).
   - `php -l` on every PHP file. Use `php` if it is in PATH; otherwise Local's PHP (newest `php-*` version):
     - win32: `%APPDATA%/Local/lightning-services/php-*/bin/win32/php.exe`
     - darwin: `~/Library/Application Support/Local/lightning-services/php-*/bin/darwin*/bin/php`
     - linux: `~/.config/Local/lightning-services/php-*/bin/linux/bin/php`
     If the path does not match, search `lightning-services/` for a `php` binary. If none exists, report that PHP lint was skipped.
   - `pnpm build` → confirm `dist/manifest.json` has keys `src/css/input.css` and `src/js/main.js`, and no `hot` file exists. Then delete `dist/`.
   - `pnpm dev` (in background) → `hot` appears. Then stop it and confirm `hot` disappears:
     - darwin/linux: send SIGINT to the Vite process (`kill -INT <pid>`).
     - win32: signals cannot be delivered from this shell; ask the user to stop it with Ctrl+C.
8. Tell user: `pnpm dev`, activate theme in WP admin, and the Deploy rules from the generated `CLAUDE.md`.

## Rules baked into templates

- `inc/*.php` start with `defined('ABSPATH') || exit;`.
- Every function/handle prefixed with `{{PREFIX}}`.
- Dev = local environment (`wp_get_environment_type()` is `local`/`development`) AND a `hot` file in the theme root (written by `pnpm dev`, removed on exit/SIGINT/SIGTERM/SIGHUP). Otherwise prod via `dist/manifest.json`.
- Prod never fatals: missing/invalid manifest → enqueue nothing (`error_log` only with `WP_DEBUG`). Manifest is read with `wp_json_file_decode()`.
- Vite scripts always get `type="module"` (dev and prod), never duplicated.
- Tailwind uses automatic class detection: `input.css` is only `@import "tailwindcss";`. Add `@source` only if a path is not detected.
- CSS in dev is enqueued with `<link>` to the Vite server. A PHP edit triggers a full reload either way (the Tailwind Vite plugin sends `full-reload`).
- Escape output: `esc_html`, `esc_url`, `esc_attr`.
- `header.php` calls `wp_body_open()`; `footer.php` calls `wp_footer()`.
- New features → new file in `inc/`, required from `functions.php`. Keep `functions.php` only as loader.
- Deploy: `dist/` is gitignored; build with dev server stopped, upload `dist/` plus modified PHP. Never upload `hot`, `node_modules/`, `src/`, or config files.
