# Changelog: wp-form

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.3.0] - 2026-10-17

### Agregado
- El motor JS avisa con los eventos `wp-form:success` y `wp-form:error` (burbujean desde el `<form>`), para que un modal de `wp-modal` pueda cerrarse o reaccionar sin tocar el motor del form. No cambia el comportamiento de ningún form existente. El motor sube a 1.3.0: `install.mjs --check` avisa a los temas con el anterior (no sobrescribe sin preguntar).

### Cambiado
- La documentación ya no dice "no modal": un form dentro de un modal se arma con `wp-modal`.

## [1.2.0] - 2026-10-17

### Agregado
- `install.mjs` agrega al `CLAUDE.md` del tema un bloque corto de wp-form (entre `<!-- wp-form:start -->` y `<!-- wp-form:end -->`): dónde está cada definición y vista, qué archivos no se editan y la regla de Zod. Se actualiza al reinstalar sin duplicarse y sin tocar el resto del archivo. Si el tema no tiene `CLAUDE.md`, no lo crea (`claudeMd: "missing"`).

## [1.1.0] - 2026-10-17

### Agregado
- `install.mjs --entry <ruta>`: indica el JS principal de Vite cuando no se puede detectar.
- El motor (`inc/forms.php` y `src/js/modules/form.js`) lleva la línea `Versión del motor: x.y.z`; `--check` informa `engineVersion` (instalada frente a la de la skill) y avisa si el motor del tema es anterior.

### Cambiado
- Ya no depende de `wp-vite-theme`: pide solo `style.css`, `functions.php` y `vite.config.*`. El JS principal se detecta leyendo `vite.config.*` y la ruta del `import()` se calcula desde él.
- Sin `CLAUDE.md`, el prefijo sale del nombre de la carpeta del tema (se puede forzar con `--slug`).
- El código común (slug, plantillas, conflictos, edición de archivos) viene de `scripts/lib/common.mjs`, copia generada desde `shared/common.mjs`.

## [1.0.0] - 2026-10-15

### Agregado
- Primera versión estable: motor de formularios con una definición por form (`inc/forms/<id>.php`), validación Zod en el navegador y las mismas reglas en PHP, nonce, antispam con límite de intentos, doble envío, `wp_mail` y envíos guardados opcionales. Pruebas de paridad PHP/JS en `tests/`.
