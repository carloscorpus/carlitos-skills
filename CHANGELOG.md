# Changelog: carlitos-skills

Cambios del plugin completo. El detalle de cada skill está en `skills/<skill>/CHANGELOG.md`.

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
