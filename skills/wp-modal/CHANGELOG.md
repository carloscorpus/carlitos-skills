# Changelog: wp-modal

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.1.0] - 2026-10-17

El diseño sale de Figma, no de la skill. Sin las opciones nuevas, el HTML que genera `_modal_start()` es idéntico al de 1.0.0.

### Agregado
- Opción `width`: el ancho exacto del frame de Figma (`'45rem'`, `'720px'`, `'80%'`; un número sin unidad son píxeles, `720` = `'720px'`). Gana a `size`, no desborda en móvil y también vale para los paneles laterales. Un valor inválido se ignora y se avisa.
- Opción `mobile`: `center`, `sheet` (hoja inferior que se desliza opaca desde abajo) o `fullscreen`, según el frame móvil. Sin ella, todo se ve como en 1.0.0.
- Clases por parte: `header_class`, `title_class`, `description_class`, `close_class` y `body_class` (además de `class`, que ya existía), para aplicar el texto, el color y el espaciado de Figma con clases de Tailwind.
- Variables nuevas con los valores de antes por defecto: `--modal-title-size`, `--modal-title-weight`, `--modal-title-leading`, `--modal-header-gap` y `--modal-drawer-radius`.
- `references/figma-mapping.md` y un paso nuevo en la skill ("Map the design"): qué va a `width`, a `mobile`, a las clases de cada parte y a los tokens del proyecto, y cuándo parar y avisar si el diseño pide algo que el motor no hace.
- Los ejemplos muestran el camino con diseño (`width`, `mobile`, clases por parte); `size` queda como respaldo sin diseño.

### Cambiado
- `size` (`sm`, `md`, `lg`, `xl`, `full`) pasa a ser solo un respaldo para modales sin diseño.
- La estructura de `SKILL.md` suma el paso 3 y renumera los siguientes.

### Corregido
- Animación: el `<dialog>` cambiaba de opacidad y el panel la heredaba, así que se veía translúcido mientras se deslizaba. Ahora cada parte se anima por separado: el fondo se desvanece, el modal centrado se desvanece y sube un poco, y los paneles laterales y la hoja inferior se deslizan opacos (300 ms, `--modal-slide-duration` y `--modal-slide-easing`).
- Al cerrar, el panel saltaba a la esquina superior izquierda porque su posición dependía del atributo `open`, y el `<dialog>` tapaba la página hasta terminar la animación.
- Bloqueo de scroll: la página saltaba 15 px al abrir un modal en una página sin barra de scroll. Ahora el espacio de la barra solo se reserva si la página la tenía.

## [1.0.0] - 2026-10-17

### Agregado
- Primera versión: motor de modales con el `<dialog>` nativo. `inc/modals.php` (`_modal_start()`, `_modal_end()`, `_modal_trigger_attrs()`), `src/js/modules/modal.js` y `src/css/modal.css`.
- Estructura fija y accesible (título con `aria-labelledby`, botón de cerrar de 44 px con `<form method="dialog">`, cuerpo con scroll) y contenido libre. Opciones de tamaño, posición, modo (`modal` o `non-modal`) y rol (`dialog` o `alertdialog`).
- Se abre sin JavaScript con `command`/`commandfor`; el JS cubre los navegadores sin Invoker Commands, los enlaces `<a href>` y el modo no modal. Clic fuera para cerrar (no en `alertdialog`), Esc en modo no modal y eventos `modal:open` / `modal:close`.
- Apertura automática opcional (`load`, `delay` o `scroll`; `always`, `session` o `days:N`; `min_width`), apagada por defecto.
- `install.mjs` detecta el JS y el CSS principales de Vite (`--entry`, `--css`), conecta `functions.php`, el JS y el CSS sin duplicar, sella la versión del motor y agrega su bloque al `CLAUDE.md` del tema.
- Ejemplos (contenido, confirmación, lightbox, drawer, formulario) y referencias (tipo de panel, accesibilidad y SEO, apertura automática, criterios de aceptación).
- `tests/check.mjs`: auditoría estática del HTML renderizado, con `--self-test` y fixtures.
