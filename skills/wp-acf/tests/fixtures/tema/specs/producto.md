# Página: Producto

- **Resumen:** Muestra un producto con su ficha.
- **Fuente:** `producto.html`
- **Plantilla:** `single-producto.php`
- **Tipo:** detalle
- **Contenido:** producto
- **Secciones (en orden):** ficha
- **Skills usadas:** ninguna
- **Grupo ACF:** Producto
- **Ubicación:** tipo de contenido = producto
- **Notas de página:**
  - el h1 es el título del producto
- **Estado:** aplicado

## Sección: ficha

- **Origen:** `producto.html` líneas 10-40
- **Destino:** `single-producto.php`
- **Grupo:** `producto_ficha`
- **Skill:** ninguna
- **Comportamiento:** precio, material y galería del producto
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `producto_ficha_precio` | number | Precio en soles | 120 | no |
| `producto_ficha_material` | select | Material principal. Opciones: Madera, Metal, Tela | Madera | no |
| `producto_ficha_galeria` | gallery | Fotos del producto | — | no |
| `producto_ficha_destacado` | true_false | Se muestra en la portada | no | no |

**Criterios de aceptación**

- [ ] Cumple los criterios comunes de `_shared.md`
