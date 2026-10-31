# Image helper

`inc/helpers/images.php`. Two functions, both safe with any value an ACF image field can return.

## `<prefix>_image_data($img, $size = 'full'): ?array`

Returns `['id', 'url', 'alt', 'width', 'height']`, or `null` when there is no usable image. `width` and `height` are `null` when unknown (URL only, SVG).

| Input | Result |
|---|---|
| ACF array (return format "Array") | uses `sizes[$size]` if it exists, otherwise `url`; `ID` or `id` |
| ID, integer or numeric string (return format "ID") | WordPress resolves url, size and alt |
| URL string (return format "URL") | `id` 0, `alt` empty; only `http(s)://` and `/relative` pass |
| `WP_Post` attachment | same as ID; a post that is not an attachment gives `null` |
| `null`, `false`, `''`, `[]`, `0`, `'0'` | `null` |
| Attachment deleted from the media library | `null` (also for an ACF array that still carries its `ID`) |
| Attachment that is not an image (PDF) | `null` |
| SVG | url with no `width` / `height` |
| `javascript:` or any other protocol | `null` |

The alt text of `_image_data()` comes from the ACF array, then from the attachment's alt, then `''`. An empty alt means decorative image; the helper never uses the file name. `_image()` adds the `alt` and `alt_fallback` args on top (below).

So switching an ACF field's return format (Array / ID / URL) does not break the views.

## `<prefix>_image($img, $args = []): string`

Returns an escaped `<img>` or `''`, so `echo` is always safe (the helper's output is already HTML: do not wrap it in `esc_html`).

| Arg | Values | Default |
|---|---|---|
| `size` | any registered image size | `'full'` |
| `class` | classes | none (no empty `class=""`) |
| `alt` | text; `''` forces decorative | the image's alt |
| `alt_fallback` | text used only when the image has no alt of its own | `''` |
| `loading` | `lazy` \| `eager` | `lazy` |
| `fetchpriority` | `high` \| `low` \| `auto` | not printed |
| `sizes` | `sizes` attribute (needs an ID) | not printed |
| `fallback` | URL used when there is no image | none |

With an ID, WordPress adds `srcset`, `sizes`, `width` and `height` (no layout shift). With a URL only, the helper prints `width`/`height` when it knows them, plus `loading` and `decoding="async"`.

```php
<?= demo_image(get_field('banner'), ['size' => 'large', 'class' => 'h-full w-full object-cover', 'loading' => 'eager', 'fetchpriority' => 'high']) ?>

<?php if ($logo = demo_image_data(get_field('logo'))): ?>
    <a href="<?= esc_url(home_url('/')) ?>"><img src="<?= esc_url($logo['url']) ?>" alt="<?= esc_attr($logo['alt']) ?>"></a>
<?php endif; ?>
```

Use `loading => 'eager'` (and `fetchpriority => 'high'`) only on the main image above the fold; everything else stays lazy.

## Alt text when the client leaves it empty

The client often replaces an image and never writes its alt. Order used by `_image()`:

1. `alt` given by the call, even `''` (an explicit `''` is a decorative image on purpose, the fallback is not applied).
2. The image's own alt (ACF array, then the attachment's alt from the Media Library). A real alt always beats the fallback.
3. `alt_fallback`, trimmed.
4. `''`.

The helper only gives the tool; the view decides the text, because it depends on the design:

| Case | `alt_fallback` |
|---|---|
| One image in a section | the section's title |
| Several equal images (gallery, slider) | the title plus the position: `$title . ', ' . sprintf(__('foto %d de %d', 'tema'), $i + 1, $n)` |
| Each image is a card or sub-section | that card's own title |
| Decorative (ornament, background) | none: pass `'alt' => ''` |

```php
<?= demo_image($hero['imagen'] ?? null, ['alt_fallback' => $hero['titulo'] ?? '']) ?>
```

The text must come from a content field (the title the client already manages), never fixed text in the view.

## Out of scope

Upload-side guards in the admin (maximum weight, allowed formats, friendly error messages) are not part of this helper. ACF's own field settings (min/max size, allowed types) cover part of it.
