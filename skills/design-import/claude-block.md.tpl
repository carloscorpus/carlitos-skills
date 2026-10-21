## Specs de diseño (design-import {{ENGINE_VERSION}})
- Los specs viven en `specs/` (`_index.md`, `_shared.md` y un archivo por página). Son documentación del tema: no se suben al servidor.
- Aplica solo las páginas con estado `aprobado` en `specs/_index.md` y deja el estado en `aplicado` al terminar.
- Cada página es un grupo de campos ACF (`Grupo ACF` y `Ubicación` en su spec) y cada sección es un campo `group` (`home_hero`). Blog, catálogo y WooCommerce se describen en la tabla "Contenido dinámico" de `_shared.md`: no escribas consultas, filtros ni lógica de Woo hasta ese paso.
- Lo que se repite en todo el sitio (contacto, redes, textos del pie) está en `specs/opciones.md` y va en una página de opciones de ACF; el logo y el ícono son de Personalizar y los menús son menús de WordPress.
- Los campos ACF se nombran `<página>_<sección>_<campo>` en snake_case y en español. No pongas límites de caracteres ni de tamaño de imagen: la descripción del campo solo lo recomienda.
- El texto del diseño queda fijo en la plantilla y su campo está en el spec ("valor actual"): al pasarlo a ACF se reemplaza uno a uno.
