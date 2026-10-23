# Acceptance criteria

Copy these into the form's spec; the verifier checks each one. Used in step 11 of SKILL.md.

- [ ] Matches the Figma frame on desktop and mobile.
- [ ] `install.mjs --check` exits `0`. In the browser's Network tab the form module (`form.js`) loads when the page has the form; typing a digit in a name field is not allowed and an empty submit shows the custom messages.
- [ ] Parity test (step 11) passes: every case equal in JS, PHP and expected.
- [ ] Empty submit: every required field shows its message, focus moves to the first one, status says "Revisa los campos marcados."
- [ ] Name rejects digits and symbols; phone made only of dashes or spaces is rejected; `<script>` in the message is rejected.
- [ ] Without JS rules (curl straight to `admin-ajax.php`), invalid data returns 422 with the same field messages; a missing or wrong nonce returns 403.
- [ ] Valid submit: the email arrives in Mailpit with the right recipients, subject and Reply-To; the form resets and shows the success text (or redirects to the thank-you page).
- [ ] If sending fails, the typed data stays in the form.
- [ ] The `<form>` has `method="post"` in the page source. With JavaScript disabled the `<noscript>` shows the other channel, and submitting never puts the data in the URL.
- [ ] With the network throttled to "Offline" after the token arrives (or a server that does not answer), the button comes back within 25 s and the status shows the retry message.
- [ ] Double click on submit sends one email.
- [ ] Filling the honeypot (`<prefix>_hp`) returns success and sends nothing; browser autofill on the real fields still sends.
- [ ] Sending under 3 s after the token is issued returns "Espera unos segundos…"; reusing a token after a successful submission returns "expired".
- [ ] Rate limit: with a **different message each time** (identical content is treated as a double submit), the 11th submission in an hour from one IP is refused by default (a form may configure a different `rate_limit`).
- [ ] Behind Cloudflare or a proxy: the `<prefix>_form_client_ip` filter is in place, so two different visitors do not share the limit.
- [ ] Keyboard only: every field reachable with Tab; labels, the radio group's legend, errors and the status are announced by a screen reader.
- [ ] Page source has no nonce (it is fetched on view); the form works with the page cached.
- [ ] Saved submissions (if `store` ≠ `none`): appear under "Envíos" with status Enviado / Correo no enviado; an Editor cannot see the menu; Tools → Export Personal Data finds them by email.
- [ ] `php -l` passes; `pnpm build` passes; Zod is the latest stable version and loads only on pages with a form.

Quick curl checks (replace the site URL and prefix):
```
curl -s -X POST https://<site>/wp-admin/admin-ajax.php -d action=<prefix>_form_submit -d form=<id>
# → 403 expired (no nonce)

T=$(curl -s -X POST https://<site>/wp-admin/admin-ajax.php -d action=<prefix>_form_token)
# use data.nonce and data.token from $T, wait 3 s, then post invalid fields → 422 with "fields"
```
