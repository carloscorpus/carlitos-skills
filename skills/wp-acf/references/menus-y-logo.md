# Menus and the logo

These are WordPress features, not ACF fields (see `design-import`'s `sitio-global.md`): menus are theme locations managed in Appearance > Menus, and the main logo and site icon come from Customizer > Site Identity. `wp-acf` only sets them up so the client can edit them.

## `inc/acf/sitio.php`

The only per-project data besides the seeds. The main thread writes it from the "Menús" table of `_shared.md` and the design's own menu data. `install.mjs` creates it empty.

```php
return [
    'menus' => [
        'principal' => [
            'nombre' => 'Menú principal',
            'items'  => [
                ['titulo' => 'Inicio', 'pagina' => 'home'],                         // 'pagina' = a page spec slug
                ['titulo' => 'Nosotros', 'pagina' => 'nosotros', 'hijos' => [
                    ['titulo' => 'Compromiso ambiental', 'pagina' => 'compromiso-ambiental'],
                ]],
                ['titulo' => 'Reglamentos', 'url' => '#', 'clases' => 'subtitulo'], // no link
                ['titulo' => 'OSITRAN', 'url' => 'https://www.ositran.gob.pe/'],     // external
            ],
        ],
        'pie'   => ['nombre' => 'Menú del pie', 'items' => [/* … */]],
        'legal' => ['nombre' => 'Menú legal', 'items' => [/* … */]],
    ],
    'logo' => 'assets/img/logo.webp',
];
```

- The location keys are the ones of the "Menús" table (`principal`, `pie`, `legal`). The engine registers them (`register_nav_menus`) on every request. Remove or rename the scaffold's `primary` in `inc/setup.php` so the theme has the same locations as the spec, and print each menu where the table says (`header.php`, `footer.php`) with `wp_nav_menu(['theme_location' => 'principal', …])`.
- The design's menu usually lives in a JS array (`menus`, `footLinks`): read it as data and translate it; never run it. Links to the design's own pages (`nosotros.html`) become `'pagina' => 'nosotros'`; the entries with `#` text in the design are subtitles without link.
- The first time, the engine creates each menu with its items and assigns it to its location. A page that does not exist yet (not applied) is skipped and reported; load again after it is created. A location that already has a menu is left alone; so is a menu that already exists by name (it is only assigned).
- Classes in `'clases'` are added to the menu item so the theme can style a subtitle or a button.

## Logo

`'logo'` is a file of the theme (`assets/img/…`). The engine uploads it once and sets it as the Customizer logo, and the theme declares `add_theme_support('custom-logo')`. Print it in the header with `the_custom_logo()` or `wp_get_attachment_image(get_theme_mod('custom_logo'), …)`, through the image helper when the design needs a specific markup. An SVG is rejected by WordPress unless a plugin allows it: the engine reports it and the client uploads it in Customizer; tell the user.

The alternative logo of the footer, if the design has one, is a field of the `opciones` spec (`opciones_pie_logo`, type `image`), not Customizer.

## What stays out

The site icon, the site name and the tagline are set in Customizer by hand; the skill does not set them.
