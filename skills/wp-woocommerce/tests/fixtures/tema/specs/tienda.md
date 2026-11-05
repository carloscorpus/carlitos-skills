# Página: Tienda

- **Resumen:** Tienda con rejilla de productos de WooCommerce.
- **Fuente:** `tienda.html`
- **Plantilla:** `woocommerce/archive-product.php`
- **Tipo:** listado
- **Contenido:** producto
- **Secciones (en orden):** catalogo
- **Skills usadas:** ninguna
- **Grupo ACF:** Tienda
- **Ubicación:** página de opciones: archivo de producto
- **Notas de página:**
  - el contenido sale de WooCommerce
- **Estado:** aplicado

## Sección: catalogo

- **Origen:** `tienda.html` líneas 10-60
- **Destino:** `woocommerce/archive-product.php`, `woocommerce/content-product.php`
- **Grupo:** `tienda_catalogo`
- **Skill:** ninguna
- **Comportamiento:** título y rejilla de tarjetas
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `tienda_catalogo_titulo` | text | Título de la tienda. Recomendado: ~20 caracteres | Tienda | sí |

**Criterios de aceptación**

- [x] Cumple los criterios comunes de `_shared.md`
