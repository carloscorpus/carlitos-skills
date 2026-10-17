## Formularios (wp-form {{ENGINE_VERSION}})
- Cada form son dos archivos: la definición `inc/forms/<id>.php` y la vista `template-parts/forms/<id>.php`. Muéstralo con `get_template_part('template-parts/forms/<id>')`.
- No edites el motor (`inc/forms.php`, `inc/forms-entries.php`, `src/js/modules/form.js`): se actualiza desde la skill wp-form.
- Define los campos, las reglas y los mensajes solo en la definición.
- No escribas a mano `name`, `id`, `required`, `maxlength` ni `aria-*` en los campos: los imprimen los helpers `{{PREFIX}}_*`.
- Instala Zod con `pnpm add zod@latest`.
