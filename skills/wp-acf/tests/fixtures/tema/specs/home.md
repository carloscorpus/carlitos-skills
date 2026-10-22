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
- **Estado:** aplicado

## Sección: hero

- **Origen:** `index.html` líneas 14-20
- **Destino:** `template-parts/pages/home/hero.php`
- **Grupo:** `home_hero`
- **Skill:** ninguna
- **Comportamiento:** una foto del slider a la vez
- **Estado:** aplicado
- **ACF:** conectado

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `home_hero_titulo` | text | Título principal de la portada. Recomendado: ~30 caracteres | Hacemos crecer tu negocio | sí |
| `home_hero_boton` | link | Botón principal: texto y destino | Cotizar | no |
| `home_hero_slides` | repeater | Fotos del slider | — | sí |
| `home_hero_slides.imagen` | image | Foto del slider. Recomendado: 1920 × 1080 px (16:9) | — | sí |
| `home_hero_slides.alt` | text | Descripción de la foto. Recomendado: ~60 caracteres | Equipo de trabajo en la oficina | sí |

**Criterios de aceptación**

- [x] Cumple los criterios comunes de `_shared.md`
