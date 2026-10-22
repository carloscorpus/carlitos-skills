# Compartido

- **Estado:** aprobado

## Sitio

- **Identidad del sitio:** logo principal e ícono en Personalizar.

### Menús

| Ubicación | Dónde se muestra | Enlaces del diseño |
|---|---|---|
| principal | cabecera (`header.php`) | Inicio, Nosotros |

## Alcance

| Diseño | Qué es | Contenido |
|---|---|---|
| index.html | estática | ninguno |
| productos.html | catálogo | producto |

## Contenido dinámico

| Contenido | Origen | Taxonomías | Campos por elemento | Filtros | Plantillas | Acción |
|---|---|---|---|---|---|---|
| producto | cpt | `categoria_producto` (jerárquica: Sillas, Mesas) | precio, galería | categoría, orden | `archive-producto.php`, `single-producto.php` | WhatsApp con "Hola, me interesa {producto}"; número en un campo global |

## Tokens

| Token | Valor | Uso | Origen |
|---|---|---|---|
| `--color-brand` | `#ff6600` | botones y acentos | styles.css |

## Criterios comunes

### Todas las secciones

- [ ] Un solo `h1` por página y los encabezados no saltan de nivel
- [ ] Sin estilos inline, `!important` ni manejadores `onclick=` en el HTML
- [ ] Controles correctos: acciones con `<button>`, navegación con `<a href>`, campos con `<label>`
- [ ] Imágenes con `alt` (vacío si son decorativas) y proporción fija (`aspect-ratio` + `object-cover`)
- [ ] `php -l` sin errores en cada archivo creado y `pnpm build` sin errores
