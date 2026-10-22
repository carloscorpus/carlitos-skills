# Página: Productos

- **Resumen:** Lista los productos y deja filtrarlos por categoría.
- **Fuente:** `productos.html`
- **Plantilla:** `archive-producto.php`
- **Tipo:** listado
- **Contenido:** producto
- **Secciones (en orden):** cabecera
- **Skills usadas:** ninguna
- **Grupo ACF:** Productos
- **Ubicación:** página de opciones: archivo de producto
- **Notas de página:**
  - h1 en la cabecera del catálogo
- **Estado:** aplicado

## Sección: cabecera

- **Origen:** `productos.html` líneas 10-20
- **Destino:** `archive-producto.php`
- **Grupo:** `productos_cabecera`
- **Skill:** ninguna
- **Comportamiento:** título y bajada sobre la lista
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `productos_cabecera_titulo` | text | Título del catálogo. Recomendado: ~20 caracteres | Productos | sí |
| `productos_cabecera_bajada` | textarea | Frase bajo el título. Recomendado: ~100 caracteres | Muebles para casa y oficina | no |

**Criterios de aceptación**

- [ ] Cumple los criterios comunes de `_shared.md`
