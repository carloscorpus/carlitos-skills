# Compartido

Se define una sola vez y vale para todas las páginas.

- **Estado:** aprobado

## Alcance

| Diseño | Qué es | Contenido |
|---|---|---|
| productos.html | catálogo | producto |
| producto.html | catálogo | producto |
| index, nosotros (.html) | estática | ninguno |

## Contenido dinámico

| Contenido | Origen | Taxonomías | Campos por elemento | Filtros | Plantillas | Acción |
|---|---|---|---|---|---|---|
| producto | cpt | `categoria_producto` (jerárquica: Sillas, Mesas) | precio, galería | categoría | `archive-producto.php`, `single-producto.php` | WhatsApp con "Hola, me interesa {producto}"; número en `opciones_contacto_whatsapp` |

## Tokens

| Token | Valor | Uso | Origen |
|---|---|---|---|
| `--color-brand` | `#ff6600` | botones | styles.css |
