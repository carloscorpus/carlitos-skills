# From fixed text to `get_field`

A section's template stops holding the design's text. It reads its group once and prints the values.

```php
<?php
defined('ABSPATH') || exit;

$hero = get_field('home_hero') ?: [];
?>
<section …>
    <h1><?= <prefix>_highlight($hero['titulo'] ?? '') ?></h1>
    <p><?= <prefix>_highlight($hero['descripcion'] ?? '') ?></p>
    <?php $slides = (array) ($hero['slides'] ?? []); ?>
    <?php foreach ($slides as $i => $slide) : ?>
        <?= <prefix>_image($slide['imagen'] ?? null, [
            'class' => 'size-full object-cover',
            'alt' => ($slide['alt'] ?? '') ?: null,
            'alt_fallback' => ($hero['titulo'] ?? '') . ', ' . sprintf(__('foto %d de %d', '<theme>'), $i + 1, count($slides)),
        ]) ?>
    <?php endforeach; ?>
    <?= <prefix>_link($hero['boton'] ?? null, ['class' => '…']) ?>
</section>
```

## Rules

- One `get_field('<group>')` per section (the group is the section's `Grupo`). Its keys are the subfield names. Options-page groups: `get_field('<group>', 'option')`; the check fails without `'option'`.
- No fixed text and no fallback text in the code: an empty field prints nothing. The only exception is the `alt_fallback` of an image (next rule), which is built from a content field, never from fixed text. Layout words that are not content (a visually hidden label such as "se abre en una pestaña nueva") stay in the template and in `__()`.
- Images through `<prefix>_image($campo, [...])` and links through `<prefix>_link()` / `<prefix>_link_attrs()` of `wp-helper`; never `$campo['url']` or `wp_get_attachment_image_url()` in a view. Pass `'loading' => 'eager'` on the first screen's main image. An image or link that is empty must not leave a broken element: wrap it in a condition when the surrounding markup would be empty.
- **Alt text of images.** The client often replaces an image and never writes its alt, which would leave `alt=""` (decorative). Pass the alt field as `'alt' => ($row['alt'] ?? '') ?: null` (an empty field must be `null`, not `''`, or the fallback never applies) and add an `alt_fallback` from a content field of the same section, by case:
  - One image in the section: the section's title (`$hero['titulo']`).
  - Several equal images (gallery, slider): the title plus the position, `$title . ', ' . sprintf(__('foto %d de %d', '<theme>'), $i + 1, $n)`. The phrase is layout text, so it goes in `__()`.
  - Each image is a card or sub-section: that card's own title.
  - Decorative (ornament, background): `'alt' => ''` and no fallback.
  A real alt (the field, or the Media Library's) always wins over the fallback. If the spec does not make clear which case applies, do not invent: tell the main thread. Details in `wp-helper` `references/images.md` (engine 1.3.0 or later).
- Text with highlighted parts **and every `textarea`**: `<prefix>_highlight()` (already escaped; it turns the editor's Enter into `<br>`). Everything else `esc_html()`, `esc_url()`, `esc_attr()`. A `textarea` printed with `esc_html()` loses its line breaks: `check.mjs` warns.
- A text the design breaks with `<br>` is one `textarea`: remove the `<br>` from the template and print the field once; the break lives in the content (`"línea 1\nlínea 2"` in the seed). Never one field per line. A `<br>` the design showed only on desktop becomes a break on every screen too. A part with its own color class (`<span class="text-anaranjado">`) becomes that style's marker in the content and the `<span>` leaves the template.
- A `relationship` gives post IDs: `foreach ((array) ($group['<field>'] ?? []) as $post_id)`, skip the ones that are no longer published (`if (get_post_status($post_id) !== 'publish') continue;`) and print with `get_the_title($post_id)` (`esc_html`), `get_permalink($post_id)` (`esc_url`) and `<prefix>_image(get_post_thumbnail_id($post_id) ?: null, […])`, or pass them to the card component already used for that content. It is not a query: no `WP_Query`, and no fixed fallback list when it is empty.
- Printing the other types: `post_object` / `user` give an ID (`get_the_title($id)`, `get_permalink($id)`, `get_userdata($id)`; a "Múltiple" one is a list of IDs); `page_link` gives the URL (`esc_url`); `taxonomy` gives a term ID (`get_term($id)`, `get_term_link($id)`); `google_map` is an array (`address`, `lat`, `lng`); `flexible_content` is a list of rows, each with `acf_fc_layout` (a `switch` per layout, one component per layout, no `get_field` inside); `tab`, `accordion` and `message` have no value, do not print them. Skip an empty value (`allow_null`) instead of printing a broken link.
- A repeater is a `foreach` over `(array) ($group['<repeater>'] ?? [])`. A repeated card stays a component (`get_template_part('template-parts/components/…', null, $args)`) fed from the rows.
- A component receives its data by `$args`, as before: the section reads ACF and passes the values down. A component never calls `get_field` itself, unless its only job is to print one site-wide option.
- A text passed to a component goes as it is, markers and line breaks included (`'titulo' => $hero['titulo'] ?? ''`), and the component prints it with `<prefix>_highlight()`. A component with rules of its own (`explode("\n", …)`, `nl2br()`, `str_replace` of a marker, a regex for the markers, a separate argument for the colored part) is replaced by the helper call: those rules fail in some case (one line in a `textarea`, several lines in a `text`). `check.mjs` follows the `get_template_part()` of each connected section and warns about a component with its own rules or that prints a `textarea` with `esc_html()`.
- Keep classes, attributes, animations hooks (`data-…`) and the markup exactly as they were: the look must not change.
- When a section already uses `wp-helper`, `wp-form`, `wp-modal` or `wp-accordion`, only the data changes; do not rewrite their markup.

## Order of work for one section

1. Read the section block of the spec and its template.
2. List every text, image, file and link in the template and match each one to a row of the table by its "valor actual".
3. Write the group into `inc/acf/seed/<page>.php` with those values.
4. Replace them in the template with the reads above.
5. Set `**ACF:** conectado` in the section of the spec.
6. Run `check.mjs` and `php -l`.

Texts the spec does not list (a visually hidden label, a decorative symbol) are not fields: leave them. If something that is content has no row in the table, do not invent a field: tell the main thread, who asks the user to update the spec.
