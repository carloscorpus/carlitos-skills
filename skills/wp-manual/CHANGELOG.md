# Changelog: wp-manual

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.1.0] - 2026-11-11

Correcciones que salieron al hacer el manual de Copam con 1.0.0.

### Agregado
- **`build.mjs --juntar`:** dos secciones cortas seguidas del mismo capítulo van en una hoja, en dos franjas, solo si el texto cabe, el admin queda de 380 px o más (y de al menos la mitad de su ancho) y la web de 300 px o más. La cabecera queda «Capítulo · 01 X · 02 Y», el aviso «Actualizar» va una vez y se renumeran las hojas y el índice. Solo horizontal (en Copam: de 175 a 164 páginas).
- **Capítulos extra** (`extra-<nombre>.md`, `- **Tipo:** extra`): escritos a mano, con sus secciones y números, al final del manual. Cada sección indica su captura: `- **Admin:**` (URL del admin; `#primero` abre el primer elemento de la lista) con `- **Selector:**` opcional, o `- **Captura:**` con una imagen propia. Sin captura, la sección es una hoja de solo texto.
- **Envíos de `wp-form`:** si el tema guarda los envíos (`inc/forms-entries.php`), `init.mjs` crea `extra-envios.md` ya redactado y lo propone; `status.mjs` y `check.mjs` lo mencionan.
- **`- **Incluir:** no`** en un borrador quita ese capítulo (por ejemplo «Menús y logo» si el cliente no lo administra). `init.mjs` lo conserva y el reporte lo muestra como omitido.
- **Regla general fija «Lo que no se edita en cada página»:** las migas de pan son fijas y el encabezado y el pie se editan en la página de opciones. Reemplaza la nota que se repetía en cada capítulo; `check.mjs` avisa si una nota se repite en 3 capítulos o más.
- **Capturas lisas:** `capture.mjs` detecta una captura de un solo color (falla de pintado en listas altas del admin, o un elemento web todavía invisible), la repite una vez y, si sigue lisa, la marca en `mapa.json`. `check.mjs` la da como error.
- **Revisión de solapes:** `build.mjs` mide cada hoja antes de imprimir y lista las imágenes que pisan el texto o se salen de la hoja (`solapes` y `salida/revision-<formato>.json`, que `check.mjs` también lee).
- `--bloquear <parte-de-url,…>` y `MANUAL_BLOQUEAR` en `.env.manual` para no cargar terceros durante las capturas.

### Corregido
- **Captura web en blanco** de elementos sticky o con animación de entrada (índice lateral): sin animaciones ni transiciones, el elemento sticky o fixed pasa a `position: static`, lo que quedó invisible (opacidad ~0) se muestra sin desplazamiento, y la foto es del elemento (`locator.screenshot`), no un recorte de la página completa.
- **Selector web por posición equivocado:** la sección se busca por la raíz de su plantilla (`id`, atributo `data-` o clase) y, si no, por su posición entre las `section` de primer nivel de `<main>`, aunque estén dentro de un `div`. Avisa si dos secciones caen en el mismo elemento.
- **Barras invertidas visibles en el PDF:** `inline()` respeta los escapes de Markdown (`\*`, `\|`, `\~`…), así `**\*asteriscos\***` sale en negrita con sus asteriscos.
- **«Cómo llegar» de una página** nombra el botón: «Busca **X** en la lista y haz clic en **Editar** (aparece al pasar el mouse sobre el nombre).»
- **Fecha de la portada opcional:** `init.mjs` la deja vacía y, vacía, no se imprime ni deja una línea de más.
- **Imagen «Así se ve en la web» chica o encima del texto:** en horizontal va debajo del admin si este queda de 560 px o más; si no, bajo el texto si cabe con 420 px o más; si no, al lado, sin pasar los 940 px de la columna.
- **`--playwright-from` sin capa extra:** `playwright-core` funciona tal cual (exportación CommonJS); lo que no es GET recibe un 403 local en vez de cancelarse, para que la espera de red no se cuelgue; reCAPTCHA, hCaptcha y Turnstile reciben una respuesta vacía.

## [1.0.0] - 2026-11-08

### Agregado
- **Manual de administración del cliente en PDF**, armado desde `acf-json/`, la lista de páginas (`inc/acf/paginas.php` o `specs/_index.md`) y las plantillas. Nace del piloto con la página Inicio de copam.
- **Capítulos:** login, reglas generales (guardar, obligatorios, filas, imágenes, cada una con su captura), páginas de opciones, una parte por página (las que comparten grupo van juntas), entradas y tipos de contenido (campos de WordPress + sus grupos), menús y logo.
- **Una hoja por sección:** captura del admin con cada campo numerado (1, 2… 7.1, 2.5.1), filas extra plegadas y sin la ayuda gris, más grande que la referencia web (máximo una pantalla). Al lado o debajo, el resumen y el texto de cada número.
- **Dos formatos:** horizontal 16:9 y vertical A4 (en vertical, las imágenes ocupan el alto que deja el texto). Portada y separadores negros con los logos NERD; tipografía Archivo Black + Inter incluida en la skill.
- **Borradores revisables** en `specs/manual/<capítulo>.md`: `init.mjs` los crea con la numeración y conserva los textos al volver a correrlo.
- **`check.mjs`:** textos que faltan, sin cantidad de caracteres, recomendación uniforme de imágenes («hasta 2000 px en el lado más largo»), resaltado solo donde la plantilla usa `<prefijo>_highlight`.
- **`capture.mjs` de solo lectura:** el navegador bloquea todo envío salvo el login. Usa Edge o Chrome instalados y `playwright-core` del proyecto o de `--playwright-from`.
- **`.env.manual`** en la raíz del proyecto (creado vacío, en `.gitignore`); sin usuario se inicia sesión a mano. Al terminar se recuerda borrarlo.
- **`reporte.pdf` aparte** para el equipo: capítulos, capturas, lo que no se cubrió y por qué, errores y avisos.
- `--out` y `--env` para trabajar sin escribir nada en el tema.
- `COBERTURA.md` con lo que cubre, lo parcial y lo pendiente.
