# Changelog: wp-manual

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

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
