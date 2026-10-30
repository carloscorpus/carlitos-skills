# Changelog: carlitos-skills

Cambios del plugin completo. El detalle de cada skill está en `skills/<skill>/CHANGELOG.md`.

## [1.21.0] - 2026-10-30

### Cambiado
- Textos de varias líneas: un título o párrafo que el diseño parte con `<br>` es un solo campo textarea, no un campo por línea. El cliente pasa de línea con Enter y la web muestra el salto, con las partes de otro color.
  - `wp-helper` 1.2.0: `<prefix>_highlight()` convierte los saltos de línea en `<br>`.
  - `design-import` 1.7.0: los specs nuevos escriben el salto como `<br>` en "valor actual"; `check.mjs` avisa si ve `…_linea_1`, `…_linea_2`.
  - `wp-acf` 1.4.0: detecta los specs viejos con un campo por línea (`status.mjs`, `check.mjs`) y los une sin preguntar, con sus colores (un salto que solo se veía en escritorio queda también en celular; un color nuevo se agrega solo al helper); avisa si el helper de texto del tema no respeta los saltos o si un textarea se imprime con `esc_html()`.
- `shared/specs.mjs`: `lineSplits()`, `breaks` en cada campo y lectura de `\n` en textos PHP entre comillas dobles. `shared/tema.mjs`: `textLineBreaks`.

## [1.20.1] - 2026-10-23

### Corregido
- `wp-form` 1.4.0: el `<form>` sale con `method="post"`, así que sin JavaScript los datos ya no quedan en la URL; cada envío se corta a los 25 s en vez de quedar en "Enviando..." para siempre; la vista lleva un `<noscript>` con otro canal de contacto. Detalle en `skills/wp-form/CHANGELOG.md`.

## [1.20.0] - 2026-10-22

### Agregado
- `wp-query` 1.1.0: skill nueva que hace funcionar los listados de posts y tipos de contenido propios desde la tabla **Filtros** de `design-import`. Va después de `wp-acf`.
  - Filtros combinados: taxonomías, opciones de ACF, rangos, fechas, búsqueda y orden.
  - Conteos fijos o dinámicos.
  - Paginación de números, "cargar más" o infinita.
  - Relacionados en el detalle.
  - SEO: las páginas filtradas salen con `noindex` y su canonical apunta al listado sin filtros.
  - Filtrar sin recargar, con la URL y el botón atrás funcionando. Sin JavaScript funciona igual, recargando.
  - El motor trabaja sobre la consulta principal y el diseño pone el HTML.
  - Detalle en `skills/wp-query/CHANGELOG.md`.

### Cambiado
- `design-import` 1.6.1: etiqueta `Query: pendiente | conectado` en las secciones de listados y detalles.
- `wp-acf` 1.3.2: nombra a `wp-query` como el paso siguiente.

### Corregido
- `wp-acf` 1.3.1: `check.mjs` ya no da un error falso con un "valor actual" que trae `*` o `|`.

## [1.19.0] - 2026-10-22

### Agregado
- `design-import` 1.6.0: tabla **Filtros** en los specs de listado (tipo, fuente, varios valores, conteo y vista de cada filtro), validada por `check.mjs`. Prepara la skill `wp-query`.
- `shared/specs.mjs`: `parseFilters()` lee esa tabla para todas las skills.

## [1.18.0] - 2026-10-22

### Agregado
- Páginas hijas: `design-import` 1.5.0 anota el `Padre` de cada página en el spec y `wp-acf` 1.3.0 la crea debajo de él (`/servicios/diseno-web/`).

## [1.17.0] - 2026-10-22

### Agregado
- `status.mjs` en `wp-acf` 1.2.0 y `design-import` 1.4.1: una lectura del tema que dice qué ya está hecho y qué sigue, para que el agente no explore ni pregunte lo que ya se sabe. Código común en `shared/tema.mjs`.

## [1.16.0] - 2026-10-22

### Corregido
- `wp-acf` 1.1.0: `_page` guarda la ruta relativa del enlace, no la URL absoluta de local o producción, y `check.mjs` marca las direcciones de desarrollo en las cargas. Detalle en `skills/wp-acf/CHANGELOG.md`.
- `shared/common.mjs`: `claudeBlock` ya no mezcla saltos de línea cuando la plantilla del bloque viene con CRLF (git en Windows); repetir `install.mjs` volvía a marcar el bloque como actualizado. La copia se sincronizó en todas las skills.

## [1.15.0] - 2026-10-21

### Agregado
- `wp-acf` 1.0.0: pasa los specs de `design-import` a ACF Pro administrable. Genera el ACF JSON (grupos, tipos de contenido, taxonomías y páginas de opciones), lo sincroniza con la base de datos y carga el contenido del diseño, los menús y el logo; deja las plantillas leyendo de ACF. Detalle en `skills/wp-acf/CHANGELOG.md`.

### Cambiado
- `design-import` 1.4.0: etiqueta opcional `ACF: pendiente | conectado` por sección (con `conectado`, `check.mjs` no compara el valor actual con la plantilla) y exige la fila del repetidor antes de sus subcampos. El lector de specs pasa a `shared/specs.mjs`.

## [1.14.1] - 2026-10-21

### Corregido
- `design-import` 1.3.1: `check.mjs` ya no da falsos errores cuando el texto fijo de una plantilla está en una variable PHP o en un atributo `alt`. Detalle en `skills/design-import/CHANGELOG.md`.

## [1.14.0] - 2026-10-21

### Cambiado
- `design-import` 1.3.0: los criterios de aceptación comunes van una sola vez en `_shared.md` y las notas de página son una lista, para que los specs sean más cortos y fáciles de revisar. Detalle en `skills/design-import/CHANGELOG.md`.

## [1.13.0] - 2026-10-21

### Agregado
- `design-import` 1.2.0: contenido de todo el sitio (logo de Personalizar, menús de WordPress y un spec `opciones` con los campos de cabecera, pie, contacto y redes). Detalle en `skills/design-import/CHANGELOG.md`.

## [1.12.0] - 2026-10-21

### Agregado
- `design-import` 1.1.0: alcance del diseño (blog, catálogo, WooCommerce) que se pregunta una vez y se documenta en `_shared.md`; páginas `listado` y `detalle`; grupos de ACF por página y por sección; los filtros ya no se confunden con formularios. Detalle en `skills/design-import/CHANGELOG.md`.

## [1.11.0] - 2026-10-21

### Agregado
- `wp-accordion` 1.0.0: skill nueva para acordeones y FAQ sobre el `<details>` nativo. El diseño sale de Figma (o del HTML de `design-import`); incluye accesibilidad, reglas de SEO, movimiento de altura solo con CSS que respeta `prefers-reduced-motion`, modo exclusivo, abrir por `#ancla`, versión en una llamada para listas (repeater de ACF) y auditoría estática. Sin datos estructurados `FAQPage` (Google ya no los muestra a sitios normales).

### Cambiado
- `design-import` 1.0.1: delega los acordeones a `wp-accordion` y `analyze.mjs` la sugiere.

## [1.10.0] - 2026-10-21

### Agregado
- `design-import` 1.0.0: reordena el diseño exportado por Claude Design (HTML + CSS + JS con malas prácticas) en tokens, componentes, secciones y plantillas del tema, con un spec por página (campos ACF documentados) y aplicando solo lo aprobado.

### Cambiado
- `wp-form` 1.3.2 y `wp-modal` 1.0.3: aceptan como referencia visual el HTML de un diseño (de `design-import`) además de un frame de Figma.

## [1.9.0] - 2026-10-21

### Cambiado
- `wp-vite-theme` 1.3.0: el tema trae `template-parts/pages/<página>/` para las secciones de cada página y `template-parts/components/` para las piezas reutilizables.

## [1.8.0] - 2026-10-20

### Cambiado
- `wp-vite-theme` 1.2.0: la portada es `front-page.php` y el tema crea la página "Inicio" al activarse; las demás plantillas van en `pages/`.

## [1.7.0] - 2026-10-18

### Agregado
- `wp-helper` 1.1.0: helper de enlaces para campos Link o URL de ACF, con `rel`, protocolos permitidos, aviso de pestaña nueva y nombre accesible por defecto.

## [1.6.0] - 2026-10-17

### Agregado
- `wp-helper` 1.0.0: skill nueva que instala helpers PHP con el prefijo del tema. Helper de imágenes seguras para campos de ACF (array, ID, URL o vacío) y helper de texto con partes de otro color, con marcadores configurables y sin choques entre estilos. Pregunta cuál incluir o crea uno local nuevo.
- `shared/common.mjs`: `ensureRequireLine()` (conecta un `require_once` en `functions.php` sin duplicarlo), copiada a cada skill.

### Cambiado
- `wp-vite-theme` 1.1.1: ofrece `wp-helper` al inicio y la corre al final si está disponible.

## [1.5.2] - 2026-10-17

### Cambiado
- `wp-form` 1.3.1 y `wp-modal` 1.0.2: la regla de versión dice lo mismo en ambas (`metadata.version` + `CHANGELOG.md`) y las `description` quedan más cortas con los mismos disparadores. Sin cambios en los motores.
- `wp-modal` 1.0.2: `wp-form` es opcional de forma explícita; si su skill no está disponible, no se ofrece y se usa el form independiente.

## [1.5.1] - 2026-10-17

### Corregido
- `wp-modal` 1.0.1: el drawer ya no rebota al abrir (`overflow: clip` en el `<dialog>`) y el movimiento usa los tiempos y curvas de Material (entrada 225 ms, salida 195 ms).

## [1.5.0] - 2026-10-17

### Agregado
- `wp-modal` 1.0.0: skill nueva para modales, confirmaciones, drawers, hojas inferiores y lightbox sobre el `<dialog>` nativo. El diseño sale de Figma; incluye accesibilidad, reglas de SEO, catálogo de movimiento, apertura automática opcional, auditoría estática y la pregunta de `wp-form` o form independiente.
- `shared/common.mjs`: `detectCssEntry()` (CSS principal de Vite), copiada a cada skill.

### Cambiado
- `wp-form` 1.3.0: eventos `wp-form:success` / `wp-form:error` en el motor JS para usarlo dentro de un modal.

## [1.4.0] - 2026-10-17

### Cambiado
- `wp-vite-theme` 1.1.0: el tema nuevo incluye `page-templates/template-inicio.php` ("Página de inicio") y un `CLAUDE.md` más corto.
- `wp-form` 1.2.0: agrega su bloque al `CLAUDE.md` del tema. Convención para las skills nuevas: cada una mantiene su propio bloque corto (`claudeBlock` en `shared/common.mjs`).

## [1.3.0] - 2026-10-17

### Agregado
- `shared/common.mjs`: código común de las skills (un solo original). `scripts/sync-shared.mjs` lo copia a `skills/<skill>/scripts/lib/` para que cada skill funcione aunque se copie sola; `--check` falla si alguna copia no coincide.
- Versión por skill (`metadata.version` en `SKILL.md`) y un `CHANGELOG.md` por skill.

### Cambiado
- `wp-form` 1.1.0: ya no exige un tema creado con `wp-vite-theme`.
- `wp-vite-theme` 1.0.1: usa el código común.

## [1.2.0]
Último estado antes de llevar changelog. Para versiones anteriores, ver `git log`.
