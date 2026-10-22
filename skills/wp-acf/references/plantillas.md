# From fixed text to `get_field`

A section's template stops holding the design's text. It reads its group once and prints the values.

```php
<?php
defined('ABSPATH') || exit;

$hero = get_field('home_hero') ?: [];
?>
<section …>
    <h1><?= esc_html($hero['titulo_linea_1'] ?? '') ?></h1>
    <p><?= <prefix>_highlight($hero['descripcion'] ?? '') ?></p>
    <?php foreach ((array) ($hero['slides'] ?? []) as $slide) : ?>
        <?= <prefix>_image($slide['imagen'] ?? null, ['class' => 'size-full object-cover', 'alt' => $slide['alt'] ?? '']) ?>
    <?php endforeach; ?>
    <?= <prefix>_link($hero['boton'] ?? null, ['class' => '…']) ?>
</section>
```

## Rules

- One `get_field('<group>')` per section (the group is the section's `Grupo`). Its keys are the subfield names. Options-page groups: `get_field('<group>', 'option')`; the check fails without `'option'`.
- No fixed text and no fallback text in the code: an empty field prints nothing. Layout words that are not content (a visually hidden label such as "se abre en una pestaña nueva") stay in the template and in `__()`.
- Images through `<prefix>_image($campo, [...])` and links through `<prefix>_link()` / `<prefix>_link_attrs()` of `wp-helper`; never `$campo['url']` or `wp_get_attachment_image_url()` in a view. Pass `'loading' => 'eager'` on the first screen's main image. An image or link that is empty must not leave a broken element: wrap it in a condition when the surrounding markup would be empty.
- Text with highlighted parts: `<prefix>_highlight()` (already escaped); everything else `esc_html()`, `esc_url()`, `esc_attr()`.
- A repeater is a `foreach` over `(array) ($group['<repeater>'] ?? [])`. A repeated card stays a component (`get_template_part('template-parts/components/…', null, $args)`) fed from the rows.
- A component receives its data by `$args`, as before: the section reads ACF and passes the values down. A component never calls `get_field` itself, unless its only job is to print one site-wide option.
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
