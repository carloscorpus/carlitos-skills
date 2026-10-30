# View contract

Used in step 6 of SKILL.md, when writing `template-parts/forms/<id>.php` from `examples/template-parts/forms/contacto.php`. Classes and layout come from Figma and the `@theme` tokens; the contract does not change:

- `<form ... <?php <prefix>_form_attrs($id); ?>>`: sets id, `method="post"`, `data-form`, `data-ajax-url`, `data-rules` and `novalidate`. Errors are shown by the module, not by browser bubbles. Never add `method` or `action` by hand: the form is only sent by the module; `method="post"` is there so that, if the JavaScript did not load, the browser never puts the data in the URL.
- **No JavaScript:** a `<noscript>` at the top of the form with another way to reach them (email or phone). Ask the user which channel goes there; never invent one or use the admin email without asking. Without it, a visitor without JavaScript fills the form and nothing arrives.
- Every field: `<label for="<?php echo esc_attr(<prefix>_field_id($id, 'key')); ?>">` + the input with `<?php <prefix>_field_attrs($id, 'key'); ?>` (name, id, type, required, maxlength, inputmode, autocomplete, aria-describedby) + `<p <?php <prefix>_error_attrs($id, 'key'); ?>></p>`. Never hand-write those attributes.
- **Radios** always inside `<fieldset>` with a `<legend>` (the question), one `<label>` per option wrapping its input `<prefix>_field_attrs($id, 'key', $value)`, and one shared error box inside the fieldset.
- **Several options (`checkboxes`)** the same as radios: `<fieldset>` with a `<legend>` (the question, with `*` if required), one `<label>` per option wrapping its input `<prefix>_field_attrs($id, 'key', $value)` (it prints `type="checkbox"`, `name="key[]"` and its own id), and one shared error box inside the fieldset. The helper never prints `required` on these boxes (it would ask to check all of them): the legend's `*` and the module do it.
- Select, radio and checkboxes options come from `<prefix>_field_options($id, 'key')`. A select starts with an empty `<option value="">`.
- **Required fields:** a visible legend at the top ("Los campos con * son obligatorios.") plus `*` next to each required label. The `*` can be `aria-hidden`: screen readers already announce `required`.
- **Consent:** the label links to the privacy policy page only when `get_privacy_policy_url()` is not empty; otherwise the text goes without a link (never `href=""`), and tell the user the page is missing.
- `<?php <prefix>_form_honeypot(); ?>` inside the form.
- Submit: `<button type="submit" data-loading-label="Enviando...">` with the text in `<span data-submit-label>`. It gets `disabled` and `data-loading` while sending (style with `data-loading:`).
- Status: `<p data-form-status role="status" aria-live="polite"></p>` near the button. It gets `data-state="success|error"`. If the server does not answer in 25 s the module stops waiting, shows a retry message and re-enables the button (event `wp-form:error` with `code: 'timeout'`) (style with `data-[state=error]:`). Plain text only: no modal for the status. The form can live inside a modal built with the `wp-modal` skill; the engine emits `wp-form:success` / `wp-form:error` (bubbling from the `<form>`) so the modal can react, and `autofocus` on the first field puts the focus there instead of on the modal's close button.
- Inputs at least 16px font (`text-base`) so iOS does not zoom; controls at least 44px tall (`min-h-11`).

Escape everything printed: `esc_html`, `esc_attr`, `esc_url`.
