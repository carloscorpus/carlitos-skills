# Página: Ajustes del sitio

- **Resumen:** Datos que se repiten en todas las páginas: pie, contacto y redes.
- **Fuente:** `index.html`
- **Plantilla:** `header.php`
- **Tipo:** global
- **Contenido:** ninguno
- **Secciones (en orden):** pie
- **Skills usadas:** ninguna
- **Grupo ACF:** Ajustes del sitio
- **Ubicación:** página de opciones: Ajustes del sitio
- **Notas de página:** el logo principal viene de Identidad del sitio y el menú es la ubicación `principal`
- **Estado:** pendiente

## Sección: pie

- **Origen:** `index.html` líneas 48-49
- **Destino:** `footer.php`
- **Grupo:** `opciones_pie`
- **Skill:** ninguna
- **Comportamiento:** el pie muestra el copyright en todas las páginas; el enlace a Nosotros es el menú `pie`
- **Estado:** pendiente

**Campos ACF**

| Campo | Tipo | Descripción | Valor actual | Requerido |
|---|---|---|---|---|
| `opciones_pie_copyright` | text | Texto de derechos del pie, en todas las páginas. Recomendado: ~20 caracteres | © Demo | sí |

**Criterios de aceptación**

- [ ] El pie no se repite dentro de ninguna plantilla de página
