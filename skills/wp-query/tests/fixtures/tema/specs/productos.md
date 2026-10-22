# Página: Productos

- **Resumen:** Lista los productos y deja filtrarlos por categoría, precio, material y color.
- **Fuente:** `productos.html`
- **Plantilla:** `archive-producto.php`
- **Tipo:** listado
- **Contenido:** producto
- **Secciones (en orden):** catalogo
- **Skills usadas:** ninguna
- **Grupo ACF:** Productos
- **Ubicación:** página de opciones: archivo de producto
- **Notas de página:**
  - h1 en la cabecera del catálogo
- **Al filtrar:** sin recargar
- **Paginación:** números
- **Por página:** 12
- **Filtros en móvil:** panel
- **Estado:** aplicado

**Filtros**

| Filtro | Tipo | Fuente | Varios | Conteo | Vista |
|---|---|---|---|---|---|
| `categoria` | taxonomía | `categoria_producto` | sí (o) | dinámico | checkbox |
| `precio` | rango | `producto_ficha_precio` | no | — | dos casillas |
| `material` | opciones | `producto_ficha_material` | sí (y) | fijo | chips |
| `colores` | opciones | `producto_ficha_colores` | sí (o) | ninguno | checkbox |
| `destacado` | opciones | `producto_ficha_destacado` | no | — | interruptor |
| `q` | búsqueda | título y contenido | — | — | campo |
| `orden` | orden | reciente, az, `producto_ficha_precio` asc, `producto_ficha_precio` desc | — | — | select |

## Sección: catalogo

- **Origen:** `productos.html` líneas 10-60
- **Destino:** `archive-producto.php`, `template-parts/components/producto-card.php`
- **Grupo:** `productos_catalogo`
- **Skill:** ninguna
- **Comportamiento:** título, filtros a la izquierda y rejilla de tarjetas con paginación
- **ACF:** conectado
- **Query:** conectado
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `productos_catalogo_titulo` | text | Título del catálogo. Recomendado: ~20 caracteres | Productos | sí |

**Criterios de aceptación**

- [x] Cumple los criterios comunes de `_shared.md`
