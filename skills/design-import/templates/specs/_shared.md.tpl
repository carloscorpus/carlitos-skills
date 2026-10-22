# Compartido

Se define una sola vez y vale para todas las páginas.

- **Estado:** pendiente

## Alcance

Qué es cada página del diseño. Lo responde el usuario una sola vez; `analyze.mjs` solo propone candidatos (`dynamicCandidates`).

| Diseño | Qué es | Contenido |
|---|---|---|

`Qué es`: `estática`, `blog`, `catálogo` (tipo de contenido propio), `woocommerce` u `otro`. `Contenido`: `ninguno` o la fila de abajo que lo describe.

## Contenido dinámico

Una fila por tipo de contenido que se repite o se filtra (entradas, productos, proyectos). Solo se documenta: no se registra el tipo de contenido ni se escribe la consulta.

| Contenido | Origen | Taxonomías | Campos por elemento | Filtros | Plantillas | Acción |
|---|---|---|---|---|---|---|

- `Contenido`: nombre en singular, snake_case, sin tildes (`producto`, `proyecto`, `post`).
- `Origen`: `post` (entradas del blog), `cpt` (tipo de contenido propio, nuevo o ya existente) o `woo` (WooCommerce: solo se maqueta).
- `Taxonomías`: nombre, si es jerárquica y los términos de ejemplo del diseño (`categoria_producto` jerárquica: Sillas, Mesas).
- `Campos por elemento`: lo que cada elemento guarda (precio, galería, ficha). El detalle va en el spec del detalle.
- `Filtros`: los que muestra el diseño (categoría, marca, orden, buscador) o `ninguno`.
- `Plantillas`: archivo de listado, de detalle y de taxonomía (`archive-producto.php`, `single-producto.php`).
- `Acción`: qué hace el botón de cada elemento (WhatsApp con mensaje, formulario de consulta, contacto, carrito de Woo, ninguna) y de dónde sale el dato (campo global, campo del elemento).

## Sitio

Lo que se repite en todas las páginas (cabecera, menú, pie). Aquí solo se decide dónde vive cada cosa; los campos van en `specs/opciones.md`. Nada se crea en esta etapa.

- **Identidad del sitio** (Personalizar > Identidad del sitio, nativo de WordPress): logo principal, ícono del sitio, nombre y descripción. No son campos ACF.
- **Menús** (Apariencia > Menús): cada menú es una ubicación del tema, no un campo.
- **Todo lo demás que se repite** (logo alternativo, contacto, redes, copyright, textos fijos del pie, aviso superior): campos de la página de opciones "Ajustes del sitio", en `specs/opciones.md`.

### Menús

| Ubicación | Dónde se muestra | Enlaces del diseño |
|---|---|---|

## Tokens

Van en `@theme` del CSS principal. Todo valor repetido del diseño se reemplaza por su token.

| Token | Valor | Uso | Origen |
|---|---|---|---|

## Componentes compartidos

Cada componente vive en `template-parts/components/<nombre>.php` y recibe sus datos por `$args`.

### <nombre>

- **Origen:** archivo y líneas del diseño
- **Destino:** `template-parts/components/<nombre>.php`
- **Argumentos:** lista de `$args` (nombre, tipo, requerido)
- **Se usa en:** páginas y secciones

## Criterios comunes

Valen para todas las secciones y páginas. Cada sección lo declara con una sola línea ("Cumple los criterios comunes") y solo lista los suyos. Se marcan `[x]` en la sección cuando se comprueban.

### Todas las secciones

- [ ] Un solo `h1` por página y los encabezados no saltan de nivel
- [ ] Sin estilos inline, `!important` ni manejadores `onclick=` en el HTML
- [ ] Controles correctos: acciones con `<button>`, navegación con `<a href>`, campos con `<label>`
- [ ] Imágenes con `alt` (vacío si son decorativas) y proporción fija (`aspect-ratio` + `object-cover`)
- [ ] Colores, tipografías, radios y sombras salen de los tokens de este archivo; los valores sueltos están listados en "Comportamiento"
- [ ] Mismo aspecto que el original en escritorio y en móvil (espaciados, tamaños y colores iguales)
- [ ] Toda la salida PHP escapada (`esc_html`, `esc_url`, `esc_attr`) y el archivo empieza con `defined('ABSPATH') || exit;`
- [ ] `php -l` sin errores en cada archivo creado y `pnpm build` sin errores

### Según lo que tenga la sección

- Imágenes: `width`/`height` o `aspect-ratio` para no mover el layout; `loading="lazy"` salvo las de la primera pantalla.
- Enlaces: destinos reales; los externos con `rel` seguro (helper de enlaces de `wp-helper`).
- Comportamiento con JS: el JS vive en `src/js/modules/`, se activa por `data-` o clase, funciona con teclado y respeta `prefers-reduced-motion`.
- Con skill (`wp-form`, `wp-modal`, `wp-accordion`, `wp-helper`): pasa los criterios de esa skill.
- Bloque repetido: un solo componente con `$args`, usado en todos los lugares donde se repetía.

### Cada página (una vez, al final)

- [ ] `check.mjs` sale con `0`
- [ ] Los enlaces internos apuntan a las páginas del tema, no a los `.html` del diseño
- [ ] `header.php` y `footer.php` no se repiten dentro de la plantilla de la página

## Nomenclatura

- Un grupo de campos por página (`Grupo ACF`) con su regla de ubicación; cada sección es un campo de tipo `group` (`home_hero`) y sus subcampos se guardan como `<sección>_<campo>`.
- Campos ACF: `<página>_<sección>_<campo>` en snake_case y en español (`home_hero_titulo`), que es el nombre con el que ACF guarda el subcampo `titulo` del grupo `home_hero`.
- Repetidos (cards, ítems): un repeater `<página>_<sección>_<plural>` con subcampos sin prefijo (`home_servicios_items.titulo`).
- Página en español, sin tildes ni `ñ` en el nombre del campo.
- Sin límites impuestos: la descripción del campo trae una recomendación, no una validación.
