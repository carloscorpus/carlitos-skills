# Cobertura de wp-manual

Qué cubre el manual, qué cubre a medias y qué falta. Cada versión que cambia algo lo anota aquí y en el `CHANGELOG.md` (columna «Desde»).

✅ cubre · 🟡 parcial · ⬜ pendiente

## Contenido del manual

| Estado | Qué | Desde | Nota |
|---|---|---|---|
| ✅ | Portada, contenido (solo partes principales), login | 1.0.0 | La dirección real del panel sale de `_manual.md`. |
| ✅ | Reglas generales con captura: guardar, obligatorios, filas, imágenes | 1.0.0 | Solo aparecen las que tienen captura. |
| ✅ | Regla fija «Lo que no se edita en cada página» (migas, encabezado y pie) | 1.1.0 | Una sola vez, en vez de una nota en cada capítulo. |
| ✅ | Quitar un capítulo (`- **Incluir:** no`) | 1.1.0 | Por ejemplo «Menús y logo» cuando el cliente no lo administra. |
| ✅ | Capítulos extra escritos a mano (`extra-<nombre>.md`) con sus capturas | 1.1.0 | Captura por URL del admin y selector, o una imagen propia. |
| ✅ | Envíos guardados de `wp-form` | 1.1.0 | `init.mjs` crea `extra-envios.md` ya redactado. Solo los ve un administrador. |
| ✅ | Portada sin fecha | 1.1.0 | La fecha es opcional. |
| ✅ | Páginas con grupo de ACF (una hoja por sección, campos numerados) | 1.0.0 | Convención design-import: un `group` por sección. Si no, el grupo entero es una sección. |
| ✅ | Páginas que comparten plantilla o grupo: un solo capítulo | 1.0.0 | Nombra todas las páginas que lo usan. |
| ✅ | Páginas de opciones (y subpáginas) | 1.0.0 | Ruta en el menú del admin incluida. |
| ✅ | Entradas y tipos de contenido: listado, campos de WordPress, grupos de ACF | 1.0.0 | Se captura el primer elemento publicado. |
| ✅ | Menús y logo (si el tema los registra) | 1.0.0 | Textos fijos, iguales en todos los proyectos. |
| ✅ | Resaltado (*asteriscos*, \|barras\|) solo en los campos que lo usan | 1.0.0 | Se detecta `<prefijo>_highlight` en la plantilla de la sección. |
| ✅ | Listas dentro de listas (2.5.1) | 1.0.0 | |
| 🟡 | Referencia web por sección | 1.1.0 | Páginas: la raíz de la plantilla de la sección (`id`, `data-`, clase) y, si no, la sección de `<main>` en esa posición (aunque esté dentro de un `div`); opciones: aviso, pie y header por nombre. Avisa si dos secciones caen en el mismo elemento. Sin animaciones y con lo sticky o invisible a la vista. Corta en una pantalla. |
| 🟡 | Listas sin filas | 1.0.0 | No se ven en la captura (no se agregan filas para no tocar el formulario); el texto sí va. |
| 🟡 | `flexible_content` | 1.0.0 | Se numeran los campos de todos los bloques; la captura solo muestra los bloques que existan. |
| 🟡 | Pestañas de ACF (`tab`) | 1.0.0 | No llevan número; solo se ve la pestaña abierta. |
| 🟡 | Campos de taxonomías (categorías con campos ACF) | 1.0.0 | Aparecen en el reporte como no cubiertos. |
| ⬜ | WooCommerce (productos, variaciones, pedidos, cupones) | — | Solo cuando el proyecto lo usa. |
| ⬜ | Ayuda dentro del admin (widget con el PDF y pestaña «Ayuda» por pantalla) | — | Reutilizaría los mismos borradores. |
| ⬜ | Videos o GIF de las acciones comunes | — | No van en el PDF; serían para la ayuda del admin. |
| ⬜ | Bloques de Gutenberg propios del tema | — | |
| ⬜ | Otros plugins | — | Se pueden agregar como capítulo extra escrito a mano. |

## Herramienta

| Estado | Qué | Desde | Nota |
|---|---|---|---|
| ✅ | Solo lectura en el admin (se bloquea todo lo que no sea GET, salvo el login) | 1.0.0 | Al abrir una pantalla de edición WordPress marca «en edición» un rato, como siempre. |
| ✅ | `.env.manual` creado vacío, en `.gitignore`, login a mano si falta usuario | 1.0.0 | |
| ✅ | Formatos horizontal, vertical o ambos | 1.0.0 | |
| ✅ | Imagen web debajo, junto al texto o al lado, sin pasar la columna | 1.1.0 | Horizontal. `build.mjs` mide los solapes de cada hoja. |
| ✅ | Dos secciones cortas en una hoja (`--juntar`) | 1.1.0 | Solo horizontal; solo si las dos quedan legibles. |
| ✅ | Capturas lisas (un solo color): se repiten y `check.mjs` las marca | 1.1.0 | |
| ✅ | `playwright-core` sin capa extra; captchas y terceros bloqueados | 1.1.0 | `--bloquear` / `MANUAL_BLOQUEAR`. |
| ✅ | `reporte.pdf` aparte (para el equipo) | 1.0.0 | |
| 🟡 | Logos NERD | 1.0.0 | Versiones transparentes sacadas de PNG pequeños; reemplazar por el SVG original en `assets/marca/`. |
