# Acceptance

Copy the items that apply into the spec of the page or section that uses the helper.

## Install

- [ ] `node <skill>/scripts/install.mjs --check` exits `0` (files present, `functions.php` wired).
- [ ] `php -l` passes on every file in `inc/helpers/`.
- [ ] The theme's `CLAUDE.md` has the `wp-helper` block (or the user was told it has no `CLAUDE.md`).
- [ ] No engine file was edited by hand (`images.php`, `text.php`).

## Images

- [ ] Every ACF image in the new views goes through `<prefix>_image()` or `<prefix>_image_data()`.
- [ ] With the field empty, the page renders with no PHP warning and no broken `<img>`.
- [ ] The main image of the page uses `'loading' => 'eager'`; the rest stay lazy.
- [ ] Decorative images have `alt` empty on purpose; informative ones have real alt text.
- [ ] Informative images pass `alt_fallback` (section title, title plus position, or the card's title) so an image the client replaces without alt does not end up with `alt=""`.

## Links

- [ ] Every ACF link in the new views goes through `<prefix>_link()` or `<prefix>_link_attrs()`; no `target="_blank"` or `rel` written by hand.
- [ ] With the field empty, nothing is printed (no empty `<a>`, no `href="#"`).
- [ ] A link that opens a new tab has the hidden notice, and `sr-only` exists in the compiled CSS (or `sr_class` points to a class that does).
- [ ] Icon-only links have `label`.
- [ ] No link has `nofollow` unless the user asked for it.

## Text styles

- [ ] Each style has a different marker (`--list` shows no repeats).
- [ ] Every class used exists in the compiled CSS after `pnpm build`.
- [ ] A text with two styles and a text with `&` render correctly in the browser (no `&amp;amp;`).
- [ ] The output is printed as is, without `esc_html()`.
- [ ] The color of every style has enough contrast against its background (WCAG AA, 4.5:1 for normal text): the helper cannot check it, the design decides it.

## Automated test (in this skill)

```
node <skill>/tests/check.mjs
```

Installs the helpers in a temporary theme and runs `tests/cases.json` through real PHP with WordPress functions simulated in `tests/stubs.php`. It needs `php` (in PATH, `--php <path>`, or Local's PHP, found by itself). It must report `"ok": true`. When the engine changes, add the new cases to `cases.json`.
