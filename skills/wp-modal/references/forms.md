# A form inside a modal

Ask first (step 2): **no form | wp-form | independent**. Do not assume.

## With wp-form (recommended for contact, quote, newsletter, lead forms)

Requires wp-form 1.3.0 or later (its engine emits `wp-form:success` / `wp-form:error`). Check with `node <wp-form>/scripts/install.mjs --check`; if the engine is older, tell the user and ask before updating it.

1. Build the form as wp-form says (definition in `inc/forms/<id>.php`, view in `template-parts/forms/<id>.php`). The form view is the modal's content: print it between `_modal_start()` and `_modal_end()` with `get_template_part('template-parts/forms/<id>')`.
2. Do not add a second close button or status area: the modal brings its close button; the form brings its own `data-form-status`.
3. **After a successful send**, ask: keep the thank-you text visible (`form_success => 'keep'`) or close the modal after 2 s (`'close'`). If the form has a thank-you page (`redirect`), the page changes and the modal option does not matter.
4. Put `autofocus` on the first field of the view so focus goes there and not to the close button.
5. wp-form requests its security token when the form is first focused (the form is hidden until the modal opens), so nothing else is needed.
6. Verify: open, submit empty (errors appear in the fields and focus goes to the first), submit valid, close and reopen (the form is still usable).

## Independent form (another plugin, a different handler, or a custom form)

Ask which one, and who owns validation, anti-spam and mail. The modal only provides the container. Rules that still apply:

- Labels on every field, errors announced (`aria-live`), `aria-invalid` on invalid fields, submit button disabled while sending.
- `autofocus` on the first field.
- Do not dismiss the modal on an error. If the data would be lost by an accidental click outside, set `backdrop_close => false`.
- If the plugin loads its own JS only on pages with its shortcode, confirm it runs when the modal is printed; hidden fields may need re-initialization on `modal:open` (the event bubbles from the `<dialog>`).
- State clearly to the user what was left to the other plugin.

## Large forms

A long or multi-step form is a poor fit for a modal. Recommend `mobile => 'fullscreen'` at least, and offer a dedicated page (a `<a href>` trigger keeps it working either way). Let the user decide.
