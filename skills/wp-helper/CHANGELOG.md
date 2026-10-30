# Changelog: wp-helper

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.2.0] - 2026-10-30

### Cambiado
- `<prefix>_highlight()` respeta los saltos de línea: el Enter que el editor escribe en un textarea sale como `<br>` en la web (un salto de Windows cuenta como uno). Así un título o párrafo de varias líneas es un solo campo, no un campo por línea. Una parte de color sigue dentro de una misma línea. Un texto de una sola línea sale igual que antes.
- `references/text-styles.md` y el bloque de `CLAUDE.md`: todo campo textarea se imprime con `<prefix>_highlight()`, con o sin colores; el campo de ACF queda sin formato de saltos (`new_lines` vacío).
- Motor de texto 1.2.0: los temas que ya lo tienen lo actualizan con `install.mjs --dry-run` y luego `--overwrite inc/helpers/text.php`.

## [1.1.0] - 2026-10-18

### Agregado
- Helper de enlaces (`inc/helpers/links.php`): `<prefix>_link()`, `<prefix>_link_attrs()` y `<prefix>_link_data()` para campos Link o URL de ACF. Solo permite `http`, `https`, `mailto` y `tel` (más relativos y anclas) y descarta enlaces vacíos, `#` o inseguros. `target="_blank"` va siempre con `rel="noopener"` (y `noreferrer` si es externo); `mailto`, `tel` y anclas nunca abren pestaña nueva; normaliza el teléfono; avisa a los lectores de pantalla de la pestaña nueva con un texto oculto (`sr-only`); sin nombre accesible no imprime el `<a>`. Nunca agrega `nofollow` por su cuenta; `rel`, `blank`, `label`, `download` y `aria-current` se piden por llamada.
- `references/links.md` y criterios de aceptación de enlaces; nota de contraste en `references/text-styles.md`.

### Cambiado
- `install.mjs` acepta `--helpers links`. El sello de versión de los tres motores pasa a 1.1.0 (`images` y `text` no cambian): `--check` avisa a los temas con 1.0.0.

## [1.0.0] - 2026-10-17

### Agregado
- Primera versión. Instala helpers PHP con el prefijo del tema en `inc/helpers/` y los conecta desde `functions.php`; pregunta cuál incluir (imágenes, texto, los dos) o crea uno local nuevo.
- Helper de imágenes (`inc/helpers/images.php`): `<prefix>_image_data()` y `<prefix>_image()` aceptan el array, el ID o la URL que entregue un campo de imagen de ACF, un `WP_Post`, o un valor vacío. Una imagen borrada, un PDF o una URL con protocolo no permitido dan `null` / `''` en vez de romper la vista. El `<img>` sale escapado y con `srcset`, `width`/`height`, `loading` y `fetchpriority`.
- Helper de texto de dos colores (`inc/helpers/text.php`): `<prefix>_highlight()` marca partes del texto con un carácter (`* | ~ ^ =`), con varios estilos a la vez. Escapa una sola vez (la versión original escapaba `&` dos veces) y el marcador no cuenta si toca letras o números, así `a|b|c` queda intacto. `-` y `_` no son marcadores: aparecen en texto normal (guiones, snake_case).
- Registro de estilos `inc/helpers/text-styles.php` (configuración del proyecto, nunca se pisa al reinstalar) y `install.mjs --add-style`, que falla si el nombre o el marcador ya están en uso y lista los libres.
- `install.mjs --list`, `--check` (con `engineVersion`), `--dry-run`, `--overwrite`, `--skip` y bloque corto en el `CLAUDE.md` del tema.
- `tests/check.mjs`: instala en un tema temporal y corre los casos en PHP real con WordPress simulado.
