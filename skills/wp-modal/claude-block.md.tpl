## Modales (wp-modal {{ENGINE_VERSION}})
- Cada modal es una vista en `template-parts/modals/<id>.php` que se muestra con `get_template_part('template-parts/modals/<id>')`. Ábrelo con `{{PREFIX}}_modal_start($id, [...])` y ciérralo con `{{PREFIX}}_modal_end()`; el contenido entre las dos llamadas es libre.
- El diseño sale de Figma: `width` exacto, `mobile` según el frame móvil y las clases por parte (`class`, `header_class`, `title_class`, `close_class`, `body_class`). Lo que se repite en varios modales va una vez como variable `--modal-*` en el CSS del proyecto.
- Pon siempre `title` (es el nombre accesible; `title_hidden => true` si no debe verse). Abre con `<button>` o `<a href>` que lleve `<?php {{PREFIX}}_modal_trigger_attrs($id); ?>`. Nunca agregues `open` al `<dialog>`.
- No edites el motor (`inc/modals.php`, `src/js/modules/modal.js`, `src/css/modal.css`): se actualiza desde la skill wp-modal.
- No abras un modal al cargar la página salvo que el proyecto lo pida (opción `auto`). Un form dentro de un modal usa wp-form o el que el proyecto haya elegido.
