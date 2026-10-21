# Acceptance criteria

Copy the base set into every section's "Criterios de aceptación" and add the ones specific to the section. Mark `- [x]` only after checking it.

## Base set (all sections)

- [ ] Un solo `h1` por página y los encabezados no saltan de nivel
- [ ] Sin estilos inline, `!important` ni manejadores `onclick=` en el HTML
- [ ] Controles correctos: acciones con `<button>`, navegación con `<a href>`, campos con `<label>`
- [ ] Imágenes con `alt` (vacío si son decorativas) y proporción fija (`aspect-ratio` + `object-cover`)
- [ ] Colores, tipografías, radios y sombras salen de los tokens del `_shared.md`; los valores sueltos están listados en "Comportamiento"
- [ ] Mismo aspecto que el original en escritorio y en móvil (espaciados, tamaños y colores iguales)
- [ ] Toda la salida PHP escapada (`esc_html`, `esc_url`, `esc_attr`) y el archivo empieza con `defined('ABSPATH') || exit;`
- [ ] `php -l` sin errores en cada archivo creado y `pnpm build` sin errores

## When it applies

- Section with images: `width`/`height` o `aspect-ratio` para no mover el layout; `loading="lazy"` salvo las que están en la primera pantalla.
- Section with links: destinos reales; los externos con `rel` seguro (helper de enlaces de `wp-helper`).
- Section with behavior: el JS vive en `src/js/modules/`, se activa por `data-` o clase, funciona con teclado y respeta `prefers-reduced-motion`.
- Section with a skill: pasa los criterios de esa skill (`wp-form`, `wp-modal`, `wp-accordion` y `wp-helper` tienen su `references/acceptance.md`).
- Repeated block: un solo componente con `$args`, usado en todos los lugares donde se repetía.
- Component: documentado en `_shared.md` con sus argumentos y dónde se usa.

## Page level (once, in the summary's notes)

- [ ] `check.mjs` sale con `0`
- [ ] Los enlaces internos apuntan a las páginas del tema, no a los `.html` del diseño
- [ ] `header.php` y `footer.php` no se repiten dentro de la plantilla de la página
