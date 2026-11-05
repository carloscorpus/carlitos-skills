# Compartido

- **Estado:** aprobado

## Alcance

| Diseño | Qué es | Contenido |
|---|---|---|
| tienda.html | woocommerce | producto |

## Contenido dinámico

| Contenido | Origen | Taxonomías | Campos por elemento | Filtros | Plantillas | Acción |
|---|---|---|---|---|---|---|
| producto | woo | `product_cat` (jerárquica: Sillas, Mesas) | precio, galería | categoría, orden | `woocommerce/archive-product.php`, `woocommerce/single-product.php` | carrito de Woo |

## WooCommerce

| Pieza | Modo |
|---|---|
| carrito | clásico |
| checkout | bloques |
| mini-carrito | clásico |
| cuenta | no aplica |

- **Variaciones:** no
- **Filtros de tienda:** no

## Tokens

| Token | Valor | Uso | Origen |
|---|---|---|---|
| `--color-brand` | `#ff6600` | botones y acentos | styles.css |
