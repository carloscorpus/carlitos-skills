# Changelog: img-webp

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.0] - 2026-11-04

### Agregado
- Primera versión. Convierte las imágenes PNG, JPG y JPEG de un proyecto (un tema WordPress o cualquier carpeta) a WebP. Independiente de las demás skills: no exige ninguna ni asume WordPress.
- `scripts/webp.mjs` con los modos `--check-encoder`, `--scan` (solo lectura), `--dry-run` (codifica en memoria y muestra el ahorro real y las referencias que cambiarían), `--apply` y `--restore`. Opciones `--max-width` (2000), `--quality` (80), `--backup`, `--no-refs`, `--force` y `--sharp-from`. Salida en JSON; códigos `0` ok, `1` uso, `5` sin codificador.
- El formato se decide por los bytes del archivo, no por la extensión (un `.png` que es un JPEG se detecta y se avisa). SVG, GIF, AVIF y WebP no se tocan.
- Cada imagen conserva sus medidas. Solo si el ancho que se ve pasa de 2000 px se reduce a 2000 px con la misma proporción; nunca se amplía. Calidad 80, conserva la transparencia, aplica la orientación Exif y quita los metadatos. Si el WebP no queda más liviano, se deja el original.
- Los originales se mueven a un respaldo (`src/img-originales/` si hay `src/`, que no se sube al servidor; si no, `img-originales/`), nunca se borran. Se guarda `img-webp.manifest.json` con lo convertido y las referencias cambiadas. Una segunda corrida no cambia nada.
- Actualiza las referencias (nombre del archivo en PHP, CSS, JS, HTML, MD, JSON, YAML y XML, suelto, con ruta relativa o como URL). La vista previa y la aplicación usan la misma función. Las referencias ambiguas no se tocan y se listan. No se editan `node_modules`, `dist`, el respaldo ni `specs/figma/lectura/`.
- `--restore` devuelve los originales, borra los `.webp` y deshace las referencias con el manifiesto.
- El codificador es `sharp`, que no va incluido: se toma del proyecto o de `--sharp-from`. Si falta, sale con `5` y da el comando exacto según el gestor (`pnpm add -D sharp`, `yarn add -D sharp` o `npm install --save-dev sharp`); no instala nada.
- Avisos en el informe: un tema WordPress debe subir `assets/` junto con `dist/`, y `wp-acf` identifica cada imagen por su ruta (una ruta `.webp` nueva crea un adjunto nuevo).
- Pruebas (`tests/check.mjs`) con imágenes de bytes crudos y un `sharp` falso; una prueba extra convierte de verdad si hay un `sharp` real (`IMG_WEBP_SHARP_FROM`). Verificado con las 10 imágenes reales de un tema de prueba: 32,7 MB pasaron a 970 KB, los logos conservaron la transparencia y `--restore` devolvió los originales idénticos.
