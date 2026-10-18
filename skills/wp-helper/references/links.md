# Link helper

`inc/helpers/links.php`. For ACF Link fields (`['url', 'title', 'target']`), URL fields (a string) or an empty value. A link that is empty, dead or unsafe prints nothing, so a view never ships a broken `<a>`.

## Functions

| Function | Returns |
|---|---|
| `<prefix>_link($link, $args)` | the whole `<a>`, or `''` |
| `<prefix>_link_attrs($link, $args)` | only the attributes (with a leading space), or `''`; for your own `<a>` or button with icons or other children |
| `<prefix>_link_data($link)` | `['url', 'title', 'target', 'rel', 'external', 'blank', 'can_blank']`, or `null` |

```php
<?= demo_link(get_field('cta'), ['class' => 'btn btn-primary']) ?>

<?php if ($attrs = demo_link_attrs(get_field('cta'), ['class' => 'btn'])): ?>
    <a<?= $attrs ?>>Ver más <svg aria-hidden="true">…</svg></a>
<?php endif; ?>
```

The output is already escaped: do not wrap it in `esc_html`/`esc_attr`/`esc_url`. `text` and the ACF title are escaped as text; to put HTML inside the link use `link_attrs`.

## Args

| Arg | Used by | Meaning |
|---|---|---|
| `text` | `link` | link text; default is the ACF title |
| `blank` | both | `null` follows the ACF field; `true` forces a new tab; `false` forces the same tab |
| `rel` | both | extra tokens: `nofollow`, `sponsored`, `ugc`… merged with the safe ones, no duplicates, letters and hyphens only |
| `class` | both | classes |
| `label` | both | `aria-label`; needed when the link has no text (icon only) |
| `download` | both | adds `download` |
| `current` | both | adds `aria-current="page"` when it points to the page being viewed (internal links only) |
| `new_tab_label` | `link` | hidden notice text; `''` turns it off. Default: `se abre en una pestaña nueva` (`__()` with the theme's text domain) |
| `sr_class` | `link` | class of the hidden notice; default `sr-only` (Tailwind) |

## What it decides

| Input | Result |
|---|---|
| empty, `''`, `false`, `[]`, empty `url`, only `#` | `null` / `''` |
| `javascript:`, `data:`, `ftp:`, `sms:` or any protocol except `http`, `https`, `mailto`, `tel` | `null` / `''` |
| `mailto:` with an invalid address | `null` / `''` |
| `tel:+51 999-888 777` | `tel:+51999888777` (only `+` and digits; what follows `;` or `,` is kept) |
| `target` = `_blank` | `target="_blank"` with `rel="noopener"`; if the link is external, `rel="noopener noreferrer"` |
| `target` = anything else (`_parent`, empty) | same tab |
| `mailto:`, `tel:`, `#anchor` with `_blank` | same tab (a new tab makes no sense there) |
| host different from the site (ignoring `www.`), or `//other.com` | external |
| link opens a new tab | hidden notice inside the link, and only if it has visible text |
| no text and no `label` (`link`) | `''`: an `<a>` with no accessible name is a failure |

## Good practices it applies

- **Security:** every new tab gets `noopener`; protocols are an allow list; everything is escaped.
- **Accessibility:** accessible name always; hidden notice for new tabs (WCAG 3.2.5); no empty `href` or `#`; no `title` attribute (redundant for screen readers); optional `aria-current`.
- **SEO:** a real, crawlable `href`; `nofollow` is never added on its own (internal and editorial links should pass authority), only when you ask for it with `rel`; no `target` where it does not apply.

## Not covered

- Link text quality ("click here", "read more" repeated): that is copy, ask the design/content team for descriptive titles or pass `label`.
- Buttons that do not navigate (open a modal, submit): use a `<button>`, not a link.
- Menus built with `wp_nav_menu()`: those links are not ACF fields.
