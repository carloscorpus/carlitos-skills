# Compartido

Se define una sola vez y vale para todas las páginas.

- **Estado:** aprobado

## Alcance

| Diseño | Qué es | Contenido |
|---|---|---|
| productos.html | catálogo | producto |
| producto.html | catálogo | producto |
| blog.html | blog | post |

## Contenido dinámico

| Contenido | Origen | Taxonomías | Campos por elemento | Filtros | Plantillas | Acción |
|---|---|---|---|---|---|---|
| producto | cpt | `categoria_producto` (jerárquica: Sillas, Mesas) | precio, material, colores | categoría, precio, material, colores, búsqueda, orden | `archive-producto.php`, `single-producto.php` | WhatsApp con "Hola, me interesa {producto}"; número en `opciones_contacto_whatsapp` |
| post | post | `category` | ninguno | categoría, fecha, búsqueda | `home.php`, `single.php` | ninguna |
