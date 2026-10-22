# Página: Inicio

- **Resumen:** Presenta la empresa y lleva al visitante a pedir una cotización.
- **Fuente:** `index.html`
- **Plantilla:** `front-page.php`
- **Tipo:** estática
- **Contenido:** ninguno
- **Secciones (en orden):** hero
- **Skills usadas:** ninguna
- **Grupo ACF:** Inicio
- **Ubicación:** página de inicio (front page)
- **Notas de página:**
  - h1 en el hero
  - título SEO "Inicio"
- **Estado:** aplicado

## Sección: hero

- **Origen:** `index.html` líneas 14-20
- **Destino:** `template-parts/pages/home/hero.php`
- **Grupo:** `home_hero`
- **Skill:** ninguna
- **Comportamiento:** el botón lleva a la sección contacto
- **Estado:** aplicado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `home_hero_titulo` | text | Título principal de la portada. Se muestra en grande. Recomendado: ~50 caracteres | Hacemos crecer tu negocio | sí |
| `home_hero_bajada` | textarea | Frase bajo el título. Recomendado: ~120 caracteres | Estrategia, diseño y desarrollo en un solo equipo | no |
| `home_hero_imagen` | image | Imagen de fondo. Recomendado: 1920 × 1080 px (16:9) | — | sí |

**Criterios de aceptación**

- [x] Cumple los criterios comunes de `_shared.md`
- [x] La imagen de fondo se recorta con `object-cover` sin deformarse
