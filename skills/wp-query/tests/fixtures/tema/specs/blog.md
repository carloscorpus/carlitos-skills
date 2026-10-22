# Página: Blog

- **Resumen:** Lista las entradas del blog con filtro por categoría y año.
- **Fuente:** `blog.html`
- **Plantilla:** `home.php`
- **Tipo:** listado
- **Contenido:** post
- **Secciones (en orden):** entradas
- **Skills usadas:** ninguna
- **Grupo ACF:** Blog
- **Ubicación:** página de opciones: archivo de post
- **Notas de página:**
  - h1 "Blog"
- **Al filtrar:** botón aplicar
- **Paginación:** cargar más
- **Por página:** 9
- **Filtros en móvil:** igual
- **Estado:** aplicado

**Filtros**

| Filtro | Tipo | Fuente | Varios | Conteo | Vista |
|---|---|---|---|---|---|
| `tema` | taxonomía | `category` | no | fijo | select |
| `anio` | fecha | `post_date` | — | — | select de año |
| `q` | búsqueda | título y contenido | — | — | campo |

## Sección: entradas

- **Origen:** `blog.html` líneas 5-40
- **Destino:** `home.php`
- **Grupo:** ninguno
- **Skill:** ninguna
- **Comportamiento:** rejilla de entradas con filtros arriba y botón "cargar más"
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|

**Criterios de aceptación**

- [x] Cumple los criterios comunes de `_shared.md`
