# Página: Nosotros

- **Resumen:** Cuenta quiénes somos.
- **Fuente:** `nosotros.html`
- **Plantilla:** `pages/template-nosotros.php`
- **Tipo:** estática
- **Contenido:** ninguno
- **Secciones (en orden):** historia
- **Skills usadas:** ninguna
- **Grupo ACF:** Nosotros
- **Ubicación:** plantilla pages/template-nosotros.php
- **Notas de página:**
  - h1 en la historia
- **Estado:** pendiente

## Sección: historia

- **Origen:** `nosotros.html` líneas 10-20
- **Destino:** `template-parts/pages/nosotros/historia.php`
- **Grupo:** `nosotros_historia`
- **Skill:** ninguna
- **Comportamiento:** título y texto
- **Estado:** pendiente

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `nosotros_historia_titulo` | text | Título de la sección. Recomendado: ~20 caracteres | Nuestra historia | sí |

**Criterios de aceptación**

- [ ] Cumple los criterios comunes de `_shared.md`
