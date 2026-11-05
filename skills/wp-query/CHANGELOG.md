# Changelog: wp-query

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.2.0] - 2026-11-05

### Agregado
- **Tienda de WooCommerce** (`Origen: woo`): filtros combinados, conteos, paginación y actualización sin recargar sobre la consulta que WooCommerce ya armó. La definición lleva `post_type: product` y `woo: true`; el motor corre después de WooCommerce (prioridad 20) y le suma lo suyo, en vez de reemplazarla.
  - Filtros admitidos: `taxonomía` (`product_cat`, `product_tag` y atributos `pa_<nombre>`), `rango` sobre `precio`, `búsqueda` y `orden`. Un filtro de `opciones` o de `fecha` (campos ACF) se rechaza con el motivo: se usa un atributo.
  - **Precio:** contra la tabla de búsqueda de WooCommerce llamando a su propio `price_filter_post_clauses` (con los impuestos), presentándole un instante los valores del motor y devolviendo `$_GET` como estaba. Sin ese método usa la misma condición escrita en el motor. Los parámetros nativos `min_price` y `max_price` siguen funcionando y se combinan con "y".
  - **Orden:** `precio` asc/desc, `popularidad` y `valoracion` los calcula WooCommerce (`get_catalog_ordering_args`); `reciente`, `az`, etc. como siempre.
  - **Conteos y límites del rango** solo ven lo visible del catálogo (`get_tax_query`): lo oculto y, si la tienda lo configuró, lo agotado quedan fuera, también con el conteo `fijo`.
  - Sin tabla "Filtros" (`Filtros de tienda: no`) no hay nada que conectar: no se genera definición y `status.mjs` no lo pide ni lo deja pendiente.
- `tests/motor-woo.php`: carga el motor con WordPress y WooCommerce simulados y ejecuta de verdad el enganche a `pre_get_posts` y el filtro del precio (con y sin `price_filter_post_clauses`): 33 comprobaciones. Con 3 pruebas nuevas del generador.
- Probado en un sitio de Local con WooCommerce 11.2.2: tienda y archivo de categoría, los cuatro órdenes, rango de precio, búsqueda, conteos con un producto oculto y otro agotado, paginación, la respuesta parcial y la combinación con `min_price`.

### Cambiado
- `shared/specs.mjs`: `ORDER_KEYWORDS` suma `popularidad` y `valoracion` (solo valen en una tienda de WooCommerce; en otro contenido `generate.mjs` y `design-import` lo rechazan).
- `references/filtros.md` (sección WooCommerce) y `SKILL.md`.

## [1.1.1] - 2026-11-03

### Cambiado
- `SKILL.md`: una corrección que cambia un filtro, la paginación o los ítems por página va primero a la tabla "Filtros" o a las etiquetas del spec, y después `generate.mjs`.
- `tests/check.mjs` lee la versión del motor desde `SKILL.md` en vez de tenerla escrita (`1.1.0`): antes, subir la versión de la skill rompía la prueba.

## [1.1.0] - 2026-10-22

### Agregado
- **Filtrar sin recargar:** `src/js/modules/query.js`, que se importa solo en las páginas con `data-query="resultados"`. Funciona así:
  - Al cambiar un filtro, o al enviar si el spec dice `Al filtrar: botón aplicar`, pide la misma URL y reemplaza solo las zonas `data-query`.
  - En la búsqueda, el número y el rango espera 300 ms después de la última tecla.
  - La URL se actualiza con comas (`?categoria=sillas,mesas`) y el botón atrás vuelve al filtro anterior.
  - No se pierde el foco ni lo que se está escribiendo.
  - Mientras carga, marca `aria-busy`; al terminar anuncia el total.
  - Con `prefers-reduced-motion` no hace el desplazamiento suave.
  - "Cargar más" e "infinito" agregan la página siguiente.
  - Si algo falla, abre la página normal.
  - Al terminar avisa con el evento `wp-query:update`.
- **Respuesta parcial en el motor PHP:** con el encabezado `X-WP-Query: 1`, el listado se arma con su plantilla de siempre y responde un JSON con el HTML de cada zona (una sola fuente de HTML). Envía `Vary: X-WP-Query` para que una caché no mezcle el JSON con la página. Si una caché devuelve la página completa, el JS saca las zonas de ese HTML.
- **Ajustes del listado para el JS:** `Al filtrar` y `Paginación` van en `<script id="wp-query-config">`.
- **Instalación y revisión:**
  - `install.mjs` copia el JS y agrega el `import()` al JS principal de Vite (se detecta, o se indica con `--entry`); `--check` revisa ese import.
  - `check.mjs` y `status.mjs` informan si el JS está copiado, importado y al día.
- **Pruebas:** la URL limpia que arma el JS (en Node) y cómo el motor encuentra las zonas en el HTML (en PHP).

### Cambiado
- Para instalar, el tema necesita Vite, o el JS principal indicado con `--entry`.

## [1.0.0] - 2026-10-22

### Agregado
- Skill para hacer funcionar los listados de posts y tipos de contenido propios desde los specs de `design-import` (tabla **Filtros**). Va después de `wp-acf`.
- `inc/query/motor.php` (motor genérico, con el prefijo del tema):
  - **La consulta:** trabaja sobre la consulta principal (`pre_get_posts`) del archivo del contenido, sus taxonomías y la página de entradas.
  - **Los valores de la dirección:** solo acepta los filtros del spec y valores conocidos.
  - **Los filtros:** taxonomías, opciones de ACF (select, radio, button_group, checkbox y true_false), rangos numéricos, fechas, búsqueda y orden, combinados con "y" entre filtros y "o" o "y" dentro de uno.
  - **Los conteos:** fijos o dinámicos, con caché que se renueva sola al editar contenido.
  - **La paginación:** de números, "cargar más" o infinita, siempre con los filtros puestos.
  - **Los relacionados:** de la misma categoría.
  - **El SEO:** las páginas filtradas salen con `noindex` y su canonical apunta al listado sin filtros (en WordPress, Yoast y Rank Math).
- Helpers para la vista que entregan datos y no HTML: `_query_filters`, `_query_filter`, `_query_active`, `_query_reset_url`, `_query_total`, `_query_pagination`, `_query_related`, `_query_is_filtered`. El aspecto lo pone el diseño.
- `generate.mjs`: escribe `inc/query/<contenido>.php` desde la tabla Filtros, las etiquetas del listado y el spec de detalle. Las claves de las opciones son las mismas que guarda ACF. Un archivo editado a mano es un conflicto, y un spec con errores sale con 4.
- `install.mjs` (con `--check`), `check.mjs` (zonas `data-query`, el `name` de cada filtro, sin `query_posts`, sin un `WP_Query` que reemplace el archivo, salida escapada, `php -l`) y `status.mjs`.
- Pruebas de los scripts con un tema de ejemplo y del motor en PHP con funciones de WordPress simuladas.

No incluye todavía filtrar sin recargar (el JS del motor): por ahora los filtros funcionan como un formulario normal que recarga la página.
