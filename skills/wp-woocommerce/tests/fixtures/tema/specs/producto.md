# Página: Producto

- **Resumen:** Ficha de un producto de WooCommerce.
- **Fuente:** `producto.html`
- **Plantilla:** `woocommerce/single-product.php`
- **Tipo:** detalle
- **Contenido:** producto
- **Secciones (en orden):** ficha
- **Skills usadas:** ninguna
- **Grupo ACF:** Producto
- **Ubicación:** tipo de contenido = producto
- **Notas de página:**
  - el precio y el botón son de WooCommerce
- **Estado:** aplicado

## Sección: ficha

- **Origen:** `producto.html` líneas 5-50
- **Destino:** `woocommerce/single-product.php`
- **Grupo:** `producto_ficha`
- **Skill:** ninguna
- **Comportamiento:** galería, título, precio y botón
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `producto_ficha_garantia` | text | Texto de garantía. Recomendado: ~30 caracteres | 2 años de garantía | no |

**Criterios de aceptación**

- [x] Cumple los criterios comunes de `_shared.md`
