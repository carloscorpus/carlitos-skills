## Modales (wp-modal {{ENGINE_VERSION}})
- Cada modal es una vista en `template-parts/modals/<id>.php` que se muestra con `get_template_part('template-parts/modals/<id>')`.
- Abre el modal con `{{PREFIX}}_modal_start($id, [...])` y ciérralo con `{{PREFIX}}_modal_end()`; el contenido entre las dos llamadas es libre.
- Pon siempre `title` en `{{PREFIX}}_modal_start()`: es el nombre accesible del modal. Si no debe verse, usa `title_visible => false`.
- Abre cada modal con un `<button type="button">` o un `<a href>` que lleve `<?php {{PREFIX}}_modal_trigger_attrs($id); ?>`. Nunca agregues el atributo `open` al `<dialog>`.
- No edites el motor (`inc/modals.php`, `src/js/modules/modal.js`, `src/css/modal.css`): se actualiza desde la skill wp-modal. Para cambiar el aspecto, redefine las variables `--modal-*`.
- No abras un modal al cargar la página salvo que el proyecto lo pida; si lo pide, usa la opción `auto` del helper.
