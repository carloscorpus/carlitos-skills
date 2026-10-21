# Site-wide content: header, menus, footer, shared blocks

Some content is the same on every page: the logo, the menu, the footer's contact data and social links, a top notice. It is not part of any page's spec. It is documented once, in `_shared.md` ("Sitio") and in `specs/opciones.md`. Nothing here is created by this skill.

## Where each thing lives

| What | Lives in | Why |
|---|---|---|
| Main logo, site icon (favicon), site name and tagline | **Customizer > Site Identity** (WordPress native: `custom-logo`, site icon) | WordPress already does it, with live preview, and plugins read it. Never duplicate it as an ACF field. |
| Menus (main, footer, legal) | **WordPress menus** (Appearance > Menus), one theme location each | Native. The spec lists the location and the design's links; they are not ACF fields. |
| Everything else that repeats | **An ACF options page**, "Ajustes del sitio" | The editor changes it without code, on the same screen style as the page fields. |

The options page holds, as the design needs: alternative logo (the white one in the footer), contact (phone, email, address), social links, the site-wide WhatsApp number, footer texts (copyright, legal links not in a menu), a top notice, and texts that repeat on many pages (a "Contáctanos" button label).

Rule of thumb: if it is a **logo or the icon** it is Customizer (the alternative logo is the exception, an options field); if it is a **list of links to pages** it is a menu; **anything else** that repeats is an options field. The footer often mixes the three: the logo from Customizer, the links from a menu, the contact and social data from options.

## The `opciones` spec

`init.mjs --page opciones --title "Ajustes del sitio" --source index.html --template header.php --type global` creates `specs/opciones.md`: same format as any page, with `Tipo: global`, `Contenido: ninguno` and `Ubicación: página de opciones: Ajustes del sitio`. The slug is always `opciones`, so every field starts with `opciones_`.

- **One section per area**, each a `group`: `cabecera`, `pie`, `contacto`, `redes`, `aviso`. Groups are `opciones_pie`, `opciones_contacto`, and so on; fields `opciones_pie_copyright`, `opciones_contacto_telefono`, `opciones_contacto_whatsapp`. Social links are a repeater: `opciones_redes_items.red`, `opciones_redes_items.enlace`.
- **Destino**: `header.php`, `footer.php` or the component the block lives in (`template-parts/components/aviso-superior.php`).
- Same rules as any section: description, recommendations (never limits), "valor actual" as the exact current text, acceptance criteria. Menus and the Customizer logo appear in `Comportamiento` ("el logo viene de Identidad del sitio; el menú es la ubicación `principal`"), with no field.
- The pages **reference** it instead of repeating it: a catalog button says "número en `opciones_contacto_whatsapp`".
- Read later with `get_field('opciones_contacto_telefono', 'option')`.

## What to propose

`analyze.mjs` returns `siteWide`: `chrome` (header, nav, footer: the files that have them, their texts, links and images, with `logo: true` on images that look like a logo) and `repeated` (blocks identical across pages that are not chrome, such as a call to action). Propose from it, and ask the user about what is unclear (is that image the logo? is this link list a menu or fixed?). Then:

1. Write the "Menús" table of `_shared.md`: one row per menu with its location (`principal`, `pie`), where it shows and the design's links.
2. Say in `Sitio` which images come from Customizer.
3. Register and fill `specs/opciones.md` with the fields of the rest.
4. In the pages' specs, do not write the header or footer sections: they are in `opciones`.

The user approves all this with the rest of `_shared.md`.

## Not done here

Registering the menu locations (`register_nav_menus`), `add_theme_support('custom-logo')`, creating the options page or its fields, or printing menus with `wp_nav_menu`. The templates keep the design's text and links fixed; each field and menu says what replaces it.
