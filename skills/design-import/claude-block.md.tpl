## Specs de diseño (design-import {{ENGINE_VERSION}})
- Los specs viven en `specs/` (`_index.md`, `_shared.md` y un archivo por página). Son documentación del tema: no se suben al servidor.
- Aplica solo las páginas con estado `aprobado` en `specs/_index.md` y deja el estado en `aplicado` al terminar.
- Los campos ACF se nombran `<página>_<sección>_<campo>` en snake_case y en español. No pongas límites de caracteres ni de tamaño de imagen: la descripción del campo solo lo recomienda.
- El texto del diseño queda fijo en la plantilla y su campo está en el spec ("valor actual"): al pasarlo a ACF se reemplaza uno a uno.
