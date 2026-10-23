# Changelog: wp-form

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.4.0] - 2026-10-23

### Corregido
- `<prefix>_form_attrs()` imprime `method="post"`. Antes, si el JavaScript no había cargado (red lenta, otro script con error, un bloqueador), el navegador enviaba el form por GET y los datos (DNI, dirección, mensaje) quedaban en la URL, el historial, los logs del servidor y la analítica.
- El motor JS corta cada pedido a los 25 s (`AbortSignal.timeout`). Antes, si el servidor se colgaba, el botón quedaba en "Enviando..." para siempre. Ahora vuelve, los datos se mantienen y el estado avisa que el envío pudo no llegar (`wp-form:error` con `code: 'timeout'`).

### Agregado
- La vista lleva un `<noscript>` con otro canal (correo o teléfono) para quien no tiene JavaScript. El paso 2 pregunta cuál; el ejemplo y el contrato de la vista lo incluyen.
- Dos criterios de aceptación: `method="post"` sin JavaScript y el corte por tiempo.

El motor sube a 1.4.0: `install.mjs --check` avisa a los temas con el anterior. Las vistas ya hechas no se tocan solas: hay que agregarles el `<noscript>` a mano.

## [1.3.2] - 2026-10-21

### Cambiado
- El paso 1 acepta como referencia visual el HTML de un diseño (carpeta de `design-import`) además de un frame de Figma. Sin cambios en el motor: la versión sube solo porque se sella en él, así que `install.mjs --check` avisa a los temas con 1.3.1.

## [1.3.1] - 2026-10-17

### Cambiado
- La regla para cambiar el motor dice "sube `metadata.version` y anótalo en el `CHANGELOG.md`" (antes hablaba de "plugin version").
- `description` más corta, con los mismos disparadores. Sin cambios en el motor: la versión sube solo porque se sella en él, así que `install.mjs --check` avisa a los temas con 1.3.0.

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
