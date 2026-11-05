# Changelog: wp-woocommerce

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.0.0] - 2026-11-05

### Agregado
- Skill nueva: conecta la tienda que `design-import` maquetó en `woocommerce/` sin perder el diseño y sin que se rompa al actualizar WooCommerce. Solo trabaja si el spec tiene contenido con `Origen: woo` y la tabla **WooCommerce** de `_shared.md` (clásico o bloques por pieza, variaciones, filtros de tienda); si falta algo de eso, no instala y manda a `design-import`.
- `scripts/install.mjs` (`--dry-run`, `--check`, `--overwrite`, `--skip`, `--css-entry`): según el spec copia `inc/woocommerce/base.php` (soporte del tema, sin estilos clásicos ni envoltorios por defecto), `fragments.php` (contador y total del mini-carrito clásico que se actualizan solos) y `src/css/woocommerce.css` (solo si hay piezas en bloques, importado en el CSS principal de Vite). Conecta `functions.php` y deja un bloque en `CLAUDE.md`. No instala la declaración de compatibilidad con HPOS ni bloques: va en el plugin de lógica de negocio.
- `scripts/status.mjs`: las decisiones del spec, la base instalada, cada plantilla de `woocommerce/` (pieza, `@version` frente a la original, marcadores `// woo:` sin conectar) y lo pendiente (filtros de tienda y variaciones en `sí`, sin WooCommerce para comparar).
- `scripts/check.mjs`: sin marcadores `woo:` sin conectar; `@version` presente e igual al de la original de WooCommerce (carpeta `templates/` junto al tema o `--woo`); todos los `do_action()` de la original presentes; ninguna plantilla para una pieza en bloques; el CSS de los bloques sin `@layer` e importado; sin pasarelas, métodos de envío ni ganchos de pedidos en el tema; aviso con los ganchos del checkout clásico cuando el checkout es en bloques; salida sin escapar; `php -l` si hay `php`.
- `references/conexion.md` (de cada marcador a la función de WooCommerce, cómo mantener una plantilla a salvo de las actualizaciones, qué no va en el tema y el brief del subagente) y `references/estilos-y-modos.md` (clásico o bloques, las reglas del CSS de los bloques y qué confirmar en Local).
- `base.php` quita lo que WooCommerce engancha por defecto en los ganchos de sus plantillas (`includes/wc-template-hooks.php`: enlace, imagen, título, precio, valoración y botón de la tarjeta; título, precio, extracto, botón, meta y pestañas de la ficha; total, orden y paginación de la tienda; envoltorio, migas y barra lateral). Sin esto, conservar los `do_action()` y además imprimir cada pieza con su llamada la duplicaría. Se quedan los avisos y "sin productos". El filtro `<prefijo>_woo_default_callbacks` agrega o quita filas por proyecto.
- `tests/check.mjs` con un tema de ejemplo y plantillas de WooCommerce falsas: 22 pruebas. Con `php` (`--php <ruta>`), `tests/base.php` carga la base con funciones de WordPress simuladas, siembra los ganchos por defecto de WooCommerce 11.2.2 y comprueba que solo quedan los avisos y "sin productos".

### Probado con WooCommerce 11.2.2 (plugin real de un sitio de Local)
- La comparación de versiones y de ganchos funciona con las plantillas reales: detectó `cart/cart.php` en `10.0.0` frente a `11.2.0` y los 25 `do_action()` que le faltaban a las plantillas de ejemplo.
- Corregido a partir de esa lectura: los avisos de la tienda y la ficha salen de `woocommerce_before_shop_loop` y `woocommerce_before_single_product` (no de `before_main_content`), y `content-product.php` trae una guarda (`is_visible()`) que la plantilla del tema debe conservar.

- Probado de punta a punta en un sitio de Local (WordPress 7.1.4, WooCommerce 11.2.2, ACF Pro 6.8, PHP 8.2, moneda PEN) con el tema real del proyecto y 4 productos de prueba:
  - **Tienda:** 4 tarjetas, 4 precios y 4 botones (ninguno duplicado), un solo `h1`, sin migas ni orden (el diseño no los imprime), sin avisos de PHP.
  - **Ficha:** un solo `h1`, pestañas, relacionados y el JSON-LD de SEO de WooCommerce conservado (sale de `woocommerce_single_product_summary`, que se mantiene).
  - **Carrito clásico:** el sitio usa la plantilla del tema (clases del diseño, filas, actualizar, cupón, totales, botón de pago, nonce).
  - **Checkout en bloques:** se muestra con los tres CSS de bloques de WooCommerce; el CSS del tema queda fuera de todo `@layer`, se carga después y tiene más especificidad.
  - **Mini-carrito:** la respuesta de `?wc-ajax=add_to_cart` trae `span[data-woo-cart-count]` con el número y `span[data-woo-cart-total]` con el total.
  - `check.mjs` sale con 0 errores y 0 avisos; `php -l` de 8 archivos.
- Corregido a partir de esa prueba:
  - `fragments.php` encola `wc-cart-fragments`: en WooCommerce 11.2.2 solo lo carga el widget del carrito y sin él el contador no se actualiza.
  - El contador es un `<span>` sin clases (la insignia va en un padre), porque el fragmento reemplaza el elemento entero.
  - La base también quita el encabezado por defecto de la tienda (`woocommerce_product_taxonomy_archive_header`), que imprime su propio `<h1>`.
  - Nuevo `page.php` (solo si el tema no tiene `page.php` ni `singular.php` y el spec tiene carrito, checkout o cuenta): `index.php` imprime solo el extracto y esas páginas salían vacías. `check.mjs` lo exige.
  - `check.mjs` ya no avisa de "salida sin escapar" en líneas idénticas a la plantilla original de WooCommerce.
  - Para ver el sitio hubo que desactivar el modo "próximamente" de WooCommerce (`woocommerce_coming_soon`): muestra una página de espera a los visitantes en todas las páginas de la tienda.

### Pendiente (próximas versiones)
- Filtros de tienda sin recargar: `wp-query` tiene que aceptar `Origen: woo` (consulta nativa de WooCommerce, precio contra su tabla `wc_product_meta_lookup`, categorías, etiquetas y atributos).
- Productos variables.
- Ver en un navegador el resultado a ancho de celular y de escritorio, y un pago real con la pasarela del proyecto. Si un tema debe declarar la compatibilidad HPOS o ya basta el plugin de negocio sigue sin confirmarse.
