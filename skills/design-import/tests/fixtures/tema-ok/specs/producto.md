# Página: Producto

- **Resumen:** Ficha de un producto con su precio y el botón de WhatsApp.
- **Fuente:** `productos.html`
- **Plantilla:** `single-producto.php`
- **Tipo:** detalle
- **Contenido:** producto
- **Secciones (en orden):** ficha
- **Skills usadas:** wp-helper
- **Grupo ACF:** Producto
- **Ubicación:** tipo de contenido = producto
- **Notas de página:** el h1 es el título del producto
- **Estado:** pendiente

## Sección: ficha

- **Origen:** `productos.html` líneas 14-20
- **Destino:** `template-parts/pages/producto/ficha.php`
- **Grupo:** `producto_ficha`
- **Skill:** wp-helper
- **Comportamiento:** el botón abre WhatsApp con el nombre del producto; el número sale del campo global del sitio
- **Estado:** pendiente

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `producto_ficha_precio` | number | Precio en soles. Se muestra junto al título | 100 | sí |

**Criterios de aceptación**

- [ ] El enlace de WhatsApp pasa por el helper de enlaces
