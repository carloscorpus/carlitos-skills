# Changelog: wp-acf

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

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
