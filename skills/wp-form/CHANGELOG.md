# Changelog: wp-form

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.6.0] - 2026-11-26

### Cambiado
- **El límite de envíos por hora usa la IP real de la visitante detrás de Cloudflare o de un proxy del hosting.** La clave del límite (y la del doble envío) sale de `<prefix>_form_client_ip()`, que devolvía `REMOTE_ADDR` y dejaba el resto a un filtro que ningún proyecto registraba. Detrás de Cloudflare, o de un proxy inverso que no restaura `REMOTE_ADDR`, todas las visitantes tenían la IP del proxy y compartían un solo límite: con 10 envíos (spam o no) el formulario quedaba bloqueado una hora para todas. Lo marcó una auditoría de seguridad de un proyecto que usa la skill (sin confirmar: depende del despliegue). Muchos clientes solo tienen cPanel y no pueden configurar `mod_remoteip` ni `real_ip`, así que el motor lo resuelve solo:
  - Parte de `REMOTE_ADDR` validada (`FILTER_VALIDATE_IP`); si no es válida queda vacía, como antes. Una IPv4 escrita como IPv6 (`::ffff:1.2.3.4`) se pasa a IPv4.
  - **Proxies de confianza:** los rangos publicados de Cloudflare (IPv4 e IPv6, copiados el 2026-11-26 de cloudflare.com/ips-v4 y /ips-v6, escritos en el código) y las IP privadas, loopback y reservadas (las que rechaza `FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE`). El filtro nuevo `<prefix>_form_trusted_proxies` (lista de CIDR) agrega o quita rangos.
  - Si `REMOTE_ADDR` no es de confianza, se usa tal cual y se ignora toda cabecera: nadie cambia su IP mandando cabeceras.
  - Si es de Cloudflare y `CF-Connecting-IP` trae una IP válida, se usa esa.
  - Si no, `X-Forwarded-For` se lee de derecha a izquierda saltando los proxies de confianza, y se queda con la primera válida que no lo es. Nunca toma sola la de la izquierda (la escribe el cliente). Un valor inválido corta la lectura (lo que está a su izquierda pudo escribirlo el cliente); si todas son de confianza o no hay ninguna válida, queda `REMOTE_ADDR`.
  - Al final se aplica el filtro `<prefix>_form_client_ip` de siempre. La constante `<PREFIX>_FORM_TRUST_PROXIES` en `false` (en `wp-config.php`) apaga la detección y vuelve a solo `REMOTE_ADDR`.
  - La comparación CIDR es una función propia (`inet_pton` y bits, IPv4 e IPv6), sin dependencias.
- `install.mjs --check` avisa que hay una actualización si el motor instalado es anterior a 1.6.0.
- Documentación: `SKILL.md` (pasos 2, 8 y 11), `references/integrations.md` ("Behind Cloudflare or a proxy": ya no se copia un filtro, solo se agregan rangos de un proxy propio con IP públicas), `references/engine-behavior.md`, `references/acceptance.md` y el bloque de `CLAUDE.md`.
- Prueba nueva `tests/ip.php`: arma el motor desde la plantilla con un WordPress simulado (sin sitio ni base de datos) y prueba la IP sin proxy con cabeceras falsas, Cloudflare con `CF-Connecting-IP` válido e inválido, `X-Forwarded-For` de derecha a izquierda, saltando proxies, con basura o vacío, IPv6 dentro y fuera de Cloudflare, los dos filtros y la constante apagada (43 comprobaciones). Uso: `php <skill>/tests/ip.php`.

El motor sube a 1.6.0 (`inc/forms.php`, `inc/forms-entries.php` y `form.js` llevan la versión; solo `inc/forms.php` cambia de comportamiento). Validación, tokens, honeypot, duplicados y correo no cambian.

En cada proyecto: `install.mjs --overwrite inc/forms.php,src/js/modules/form.js` (más `inc/forms-entries.php` si el tema guarda envíos; los dos últimos solo cambian la versión), `pnpm build` y publicar. **No hay que tocar las definiciones de los formularios** (`inc/forms/<id>.php`). Si alguna tiene el filtro `<prefix>_form_client_ip` que devolvía `CF-Connecting-IP` (el de la versión anterior de `references/integrations.md`), quítalo: confía en la cabecera aunque el pedido no venga de Cloudflare.

## [1.5.0] - 2026-10-30

### Agregado
- Tipo de campo `checkboxes`: varias opciones ("elige uno o más"). Se define con `options` como un select o un radio; `required` pide al menos una, y `min` / `max` cuentan opciones marcadas (`max` 0 = sin límite). Las mismas reglas, en el mismo orden y con los mismos mensajes en Zod y en PHP: obligatorio → opción válida → máximo → mínimo.
- La vista lo arma como los radios: `<fieldset>` + `<legend>`, una casilla por opción con `<prefix>_field_attrs($id, 'clave', $valor)` (imprime `name="clave[]"`) y un solo contenedor de error. El helper no pone `required` en cada casilla (pediría marcarlas todas).
- El correo y los envíos guardados muestran las etiquetas elegidas separadas por comas (`<prefix>_form_value_text()`, que también usan los integradores). Un valor que no es una opción, una lista anidada o una opción repetida no pasan: lo repetido cuenta una vez y se guarda en el orden de las opciones.
- Casos nuevos en `tests/cases.json` (72 en total), un campo de ejemplo "Temas de interés" en `examples/` y un criterio de aceptación.

El motor sube a 1.5.0 (`inc/forms.php`, `inc/forms-entries.php` y `form.js`): `install.mjs --check` avisa a los temas con el anterior. Los forms ya hechos siguen igual; el tipo nuevo solo se usa si se define. Si el tema guarda envíos y va a usar `checkboxes`, actualiza también `inc/forms-entries.php` (sale como conflicto en `--dry-run`): el anterior guardaría la lista como "Array".

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
