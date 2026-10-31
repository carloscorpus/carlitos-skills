# Changelog: wp-acf

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.5.0] - 2026-10-30

### Cambiado
- Las plantillas pasan `alt_fallback` a `<prefix>_image()` (`wp-helper` 1.3.0): si el cliente cambia una imagen y no escribe el alt, se usa el título de su sección (una imagen), título más posición (varias iguales) o el título de su tarjeta (cada imagen es una sub-sección). Las decorativas siguen con `'alt' => ''`. El campo alt vacío se pasa como `null`, no como `''`, para que el respaldo aplique.
- `references/plantillas.md`: regla nueva "Alt text of images" y ejemplo corregido; la regla de "sin texto de respaldo" admite el `alt_fallback` porque sale de un campo de contenido.

## [1.4.0] - 2026-10-30

### Cambiado
- Un título o párrafo de varias líneas es un solo campo `textarea`, no un campo por línea. Si el cliente escribe con Enter, la web muestra el salto: la plantilla lo imprime con `<prefix>_highlight()` de `wp-helper` 1.2.0, que también pone los colores. El campo de ACF queda sin formato de saltos (`new_lines` vacío) a propósito.
- `generate.mjs`: un textarea con `<br>` en "valor actual" suma a sus instrucciones "Usa Enter para pasar a otra línea."
- `references/plantillas.md`, `carga-contenido.md` (el salto va como `"…\n…"` en la carga), `mapeo-tipos.md`, el brief de subagentes y el bloque de `CLAUDE.md`.

### Agregado
- `status.mjs` lista en `lineas` los textos partidos en un campo por línea (`…_linea_1`, `…_linea_2`) y `next` pide unirlos en un textarea antes de generar, sin preguntar: el código de la plantilla ya muestra los saltos y los colores. Un salto que el diseño solo mostraba en escritorio queda en todas las pantallas; un color sin estilo en `wp-helper` se agrega solo (la clase del diseño, el nombre sin `text-` y el primer marcador libre). Al final se le dice al usuario qué se unió. `check.mjs` avisa lo mismo.
- `status.mjs` dice si el helper de texto del tema ya respeta los saltos (`textLineBreaks`) y pide actualizar `wp-helper` cuando hay textareas y no lo hace.
- `check.mjs` avisa cuando un textarea de una sección conectada se imprime con `esc_html()` (pierde los saltos), y lee bien un texto de la carga con `\n` entre comillas dobles.
- Motor 1.4.0: no cambia; solo sube su número de versión (reinstalarlo es opcional).

## [1.3.2] - 2026-10-22

### Cambiado
- `SKILL.md` y el bloque de `CLAUDE.md` nombran a `wp-query` como el paso siguiente para los listados, sus filtros y su paginación (antes decían `wp-contenido`). El motor no cambia.

## [1.3.1] - 2026-10-22

### Corregido
- `check.mjs`: un "valor actual" con `*` o `|` (por ejemplo "Los campos con * son obligatorios.") ya no da el error falso "no está en la carga". La carga se leía sin esos marcadores y el spec se comparaba con ellos; ahora se quitan de los dos lados.

### Cambiado
- `slugify` y las claves de las opciones de un campo (`fieldChoices`) pasan a `shared/specs.mjs`, para que `wp-query` arme las mismas claves que guarda ACF. El JSON generado no cambia.
- El motor no cambia; solo sube su número de versión (reinstalarlo con `install.mjs --overwrite inc/acf/runner.php` es opcional).

## [1.3.0] - 2026-10-22

### Agregado
- Páginas hijas: la etiqueta `Padre` del spec (design-import 1.5.0) llega a `inc/acf/paginas.php` como `'padre'`, cada padre va antes que sus hijas y el motor crea la hija debajo de él (`/servicios/diseno-web/`). Una página que una versión anterior del motor dejó en el primer nivel se cuelga del padre sin tocar su contenido. `generate.mjs` sale con `4` si el padre no se genera con los mismos estados o hay un ciclo.
- Motor 1.3.0: reinstala `inc/acf/runner.php` (`install.mjs`) en los temas que ya lo tienen.

## [1.2.0] - 2026-10-22

### Agregado
- `status.mjs`: una sola lectura del tema (solo lee) que dice si el motor está instalado y al día (versión), si existen los helpers de `wp-helper`, si el JSON está generado, el estado de cada página con sus secciones `conectado` y su carga, y la lista `next` de lo que falta. El paso 1 de `SKILL.md` lo corre primero y salta lo ya hecho (por ejemplo no repite `install.mjs`), en vez de explorar el tema.

## [1.1.0] - 2026-10-22

### Corregido
- `['_page' => 'slug']` de una carga ya no guarda la URL absoluta (`http://copam.local/…`) en la base de datos: guarda la ruta relativa (`/slug/`, `/` para la portada). Así el contenido no depende de si el sitio está en local o en producción.

### Agregado
- `check.mjs` da error si una carga de `inc/acf/seed/` trae una dirección de desarrollo (`localhost`, `127.0.0.1`, `*.local`, `*.test`) y pide una ruta relativa o `_page`.

### Nota
- Lo ya cargado con URL absoluta no se corrige solo (el motor nunca pisa lo cargado): cambia esas URLs una vez, por ejemplo con `wp search-replace 'http://copam.local' '' --all-tables`.

## [1.0.0] - 2026-10-21

### Agregado
- Primera versión. Pasa los specs de `design-import` a ACF Pro administrable: campos, tipos de contenido, taxonomías y páginas de opciones como ACF JSON (`acf-json/`), importados a la base de datos para poder editarlos desde el admin, y el contenido del diseño cargado como contenido real.
- `generate.mjs`: un `group_*.json` por página (cada sección es un campo `group`; repeaters y subcampos anidados; instrucciones y requerido desde la tabla), `post_type_*.json` y `taxonomy_*.json` de la tabla "Contenido dinámico" (origen `cpt`), `ui_options_page_*.json` por cada página de opciones nombrada en una `Ubicación`, e `inc/acf/paginas.php` con las páginas de WordPress. Claves estables a partir del nombre; `modified` solo cambia si cambia el contenido. `--dry-run`, `--overwrite` / `--skip` para los archivos que ya existen y son distintos (por ejemplo guardados desde el admin), `--page`, `--states`.
- Sin límites para el editor: ni `maxlength`, ni mínimos o máximos de filas, ni tamaños de imagen; la recomendación queda en las instrucciones del campo.
- `inc/acf/runner.php` (motor genérico, con el prefijo del tema): importa el JSON a la base como el botón "Sync" de ACF, crea las páginas con su plantilla, carga el contenido de `inc/acf/seed/*.php` (textos, imágenes y archivos subidos una sola vez a la biblioteca de medios, enlaces a páginas por slug, elementos de ejemplo de un contenido con sus términos), crea los menús, asigna el logo de Personalizar y registra las ubicaciones. Corre al activar el tema y desde Herramientas > Cargar contenido inicial; es idempotente y no pisa lo que el cliente ya editó.
- `install.mjs`: copia el motor, `inc/acf/sitio.php` (menús y logo) y `inc/acf/seed/`, conecta `functions.php` y agrega su bloque al `CLAUDE.md` del tema.
- `check.mjs`: el JSON coincide con los specs (campos, tipos, requerido, ubicación, claves únicas); cada sección con `ACF: conectado` lee su grupo con `get_field` (con `'option'` en las páginas de opciones), ya no trae el texto fijo y tiene su carga con el grupo, los textos y los archivos; el motor está instalado.
- Pasos por página en paralelo con un subagente por página (solo su carpeta y su carga).
- Referencias: JSON de ACF, mapeo de tipos, formato de la carga, plantillas, menús y logo, y paralelo.
- `tests/check.mjs` con un tema de ejemplo. El PHP del motor no se ejecuta en la prueba.

### Límites
- Tipos que aún no genera: `post_object`, `relationship`, `taxonomy`, `page_link`, `user`, `google_map`, `tab`, `accordion`, `flexible_content`, `clone`, `message`, `password` y los selectores de hora. Sin lógica condicional entre campos.
- No hace consultas, filtros, buscador ni paginación (`wp-contenido`) ni WooCommerce (`wp-woo`), ni multilenguaje.
