# Página: Productos

- **Resumen:** Lista los productos con filtros por categoría y orden.
- **Fuente:** `productos.html`
- **Plantilla:** `archive-producto.php`
- **Tipo:** listado
- **Contenido:** producto
- **Secciones (en orden):** catalogo
- **Skills usadas:** ninguna
- **Grupo ACF:** Productos
- **Ubicación:** página de opciones: archivo de producto
- **Notas de página:** h1 en la cabecera del catálogo; los filtros se conectan en la fase de contenido dinámico
- **Al filtrar:** sin recargar
- **Paginación:** números
- **Por página:** 12
- **Filtros en móvil:** panel
- **Estado:** pendiente

**Filtros**

| Filtro | Tipo | Fuente | Varios | Conteo | Vista |
|---|---|---|---|---|---|
| `categoria` | taxonomía | `categoria_producto` | sí (o) | dinámico | checkbox |
| `precio` | rango | `producto_ficha_precio` | no | — | dos casillas |
| `q` | búsqueda | título y contenido | — | — | campo |
| `orden` | orden | reciente, az, `producto_ficha_precio` asc, `producto_ficha_precio` desc | — | — | select |

## Sección: catalogo

- **Origen:** `productos.html` líneas 9-26
- **Destino:** `template-parts/pages/productos/catalogo.php`, `template-parts/components/producto-card.php`
- **Grupo:** `productos_catalogo`
- **Skill:** ninguna
- **Comportamiento:** rejilla de tarjetas con los 6 productos de ejemplo fijos; los filtros (categoría y orden) son solo maquetado y no usan wp-form
- **Estado:** pendiente

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `productos_catalogo_titulo` | text | Título del catálogo. Recomendado: ~20 caracteres | Productos | sí |

**Criterios de aceptación**

- [ ] Las tarjetas usan el componente `producto-card` con `$args`
- [ ] Los filtros no usan wp-form y no envían nada
