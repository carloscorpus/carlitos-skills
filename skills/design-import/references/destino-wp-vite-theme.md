# Destination: a wp-vite-theme project

Use this when the theme has `front-page.php`, `pages/`, `template-parts/` and `inc/enqueue.php` (the structure `wp-vite-theme` 1.3.0 generates). Do not ask the user about structure: it is fixed. Read the theme's `CLAUDE.md` first (prefix, text domain).

## Where each thing goes

| From the design | Goes to |
|---|---|
| Home page | `front-page.php` (no `Template Name`) |
| Any other page | `pages/template-<slug>.php`, with `Template Name:` in the header |
| Section of one page | `template-parts/pages/<page>/<section>.php` (home uses `home/`) |
| Block used in 2+ pages, or small block (button, card, section title) | `template-parts/components/<name>.php` |
| `<header>` / `<nav>` | `header.php` (site-wide, never per page) |
| `<footer>` | `footer.php` |
| Form / modal | `template-parts/forms/` / `template-parts/modals/`, written by `wp-form` / `wp-modal` |
| Colors, fonts, sizes, radii, shadows | `@theme` in `src/css/input.css`, after `@import "tailwindcss";` |
| Fonts | `src/fonts/`, loaded with `@font-face` in `src/css/input.css` (Vite hashes them into `dist/`) |
| Images used by CSS | `src/img/`, referenced from the CSS |
| Images printed by PHP | `assets/img/` at the theme root, printed with `get_theme_file_uri()`; ACF image fields later go through the `wp-helper` images helper |
| Behavior (menu, tabs, sliders) | `src/js/modules/<name>.js`, imported from `src/js/main.js` |

`src/` is not uploaded to the server (see the theme's deploy rules), and `assets/` is not in that rule either: the first time a theme needs `assets/img/`, tell the user it must be uploaded together with `dist/`.

## Tokens

- Name by role, not by value: `--color-brand`, `--color-ink`, `--font-display`, `--radius-card`, `--shadow-card`. Never `--color-orange`.
- Replace a repeated value by its token everywhere. A value that appears once stays an arbitrary Tailwind value (`text-[17px]`) and is reported to the user; do not invent a token for it.
- Tailwind detects classes by itself: do not add `@source`.
- Map a size to Tailwind's default scale only when it matches exactly (`16px` = `4`, `24px` = `6`). Never round a spacing to the nearest step: that changes the design.

## Files

- Every `template-parts/**` and page template starts with `defined('ABSPATH') || exit;`.
- Escape output: `esc_html`, `esc_url`, `esc_attr`. Internal links use `esc_url(home_url('/<slug>/'))`; external ones keep their URL.
- Each page template calls `get_header()` and `get_footer()` once and puts the content inside `<main id="main-content">`.
- Include pieces with `get_template_part('template-parts/components/card', null, $args)`. Inside, read `$args` with defaults:
  ```php
  $titulo = $args['titulo'] ?? '';
  $texto  = $args['texto'] ?? '';
  ```
- File names are the section or component name in kebab-case without accents: `hero.php`, `por-que-elegirnos.php`.
- Functions, hooks and constants you add start with the theme prefix; new code that is not a view goes in `inc/` and is required from `functions.php`.

## Stop and ask

- The design has a layout that Tailwind cannot express without a custom CSS rule: write the rule in `src/css/input.css` under `@layer components` and tell the user.
- A page has no clear template (is it the home or another page?): ask.
- `src/css/input.css` already has tokens that clash with the design's: show both and ask which wins.
