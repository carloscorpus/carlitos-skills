---
name: wp-form
description: Build a secure, accessible form in a WordPress theme created with wp-vite-theme (contact, quote, newsletter, lead forms). Validation with Zod in the front and the same rules in PHP, nonce, sanitizing, anti-spam, double-submit protection, wp_mail (Mailpit local, Fluent SMTP prod) and optional saved submissions in the admin. Use when a spec says `skill: wp-form`, or the user asks for a form, "formulario", "form de contacto", "cotización", "arma el form", or gives a Figma frame of a form.
---

# wp-form

One definition per form drives everything. `inc/forms/<id>.php` declares the fields and their rules once; from it come the HTML attributes, the Zod schema in the browser and the PHP validation. Both sides share the same rules, the same check order and the same messages, and `tests/` proves it with one set of cases run on both. Where they could still differ, the server decides: its error comes back to the field (HTTP 422).

The engine files are generic and are **not edited per project**. A new form only needs its definition and its view.

| File | Created by | Per project? |
|---|---|---|
| `inc/forms.php` | `scripts/install.mjs` | No, engine: rules, validation, nonce, spam, mail, HTML helpers |
| `src/js/modules/form.js` | `scripts/install.mjs` | No, engine: Zod schema from rules, errors, states, AJAX submit |
| `inc/forms-entries.php` | `scripts/install.mjs --entries` | No, optional: "Envíos" menu in the admin |
| `inc/forms/<id>.php` | you, from `examples/` | Yes: fields, recipients, store, redirect |
| `template-parts/forms/<id>.php` | you, from `examples/` + Figma | Yes: the markup and classes |
| `tests/` (stays in the skill) | — | Run against the theme to check front/back parity |

If the engine needs a change, change the template in this skill (and bump the plugin version), never the copy in a theme.

## Steps

1. **Read context.** From the theme root: read `CLAUDE.md` (prefix, slug) and the form's spec if there is one. If a Figma link is given, read the frame through the Figma MCP for the view (follow the Figma server's design-to-code instructions). The spec says what the form does; Figma says how it looks. If they contradict (fields, required ones), stop and ask: do not decide.

2. **Ask what is missing.** Ask only what the spec and `CLAUDE.md` do not answer, in one message (AskUserQuestion when available):
   - **Recipients:** which emails receive it (`to`). Empty means the site's admin email; confirm that is intended.
   - **Thank-you page:** yes (its URL, goes in `redirect`) | no (success text under the button).
   - **Saved submissions in the admin:** no | all, with status sent or failed | only failed. Maps to `store`: `none` | `all` | `failed`.
   - **CRM or other integration:** none | which one and its endpoint/docs.
   - **Cloudflare or a proxy in front of the site:** yes | no. If yes, step 8 applies; without it, every visitor shares one IP and the rate limit becomes site-wide.
   - **Privacy policy page:** check `get_privacy_policy_url()` in WP. If empty, ask for the page; the consent checkbox needs that link.
   - **Fields:** only if neither spec nor Figma list them: name, type, required, limits.
   Do not ask about cache: the token is always fetched fresh, so it works with and without page cache.

3. **Install the engine** (only the first form of the theme). From the theme root, `<skill>` = this skill's folder:
   ```
   node <skill>/scripts/install.mjs --dry-run [--entries]
   ```
   Add `--entries` if any form stores submissions (it can be added later by re-running with `--entries`). The JSON lists `create`, `unchanged` and `conflicts`. If `conflicts` is non-empty, show them and ask file by file: overwrite or keep. Then run without `--dry-run`, with `--overwrite` / `--skip` covering every conflict. Exit codes: `0` ok, `1` invalid input, slug not starting with a letter or not a wp-vite-theme theme, `2` unresolved conflicts, `3` leftover placeholders (fix the template, not the output), `4` (`--check` only) something is not wired.

4. **Wire it up** (first form only). The installer from step 3 already does the first two points, once, without duplicating them when re-run; confirm in its `wired` output. Without them the form has no JavaScript: no custom errors, no typing filters, and nothing warns you.
   - `functions.php`: `require_once get_theme_file_path('/inc/forms.php');` after the other requires. `forms.php` loads `inc/forms/*.php` and `inc/forms-entries.php` by itself.
   - `src/js/main.js`: loads the module only on pages that have a form, so Zod is not downloaded elsewhere (the `.catch` makes an import failure visible in the console):
     ```js
     if (document.querySelector('form[data-form]')) {
         import('./modules/form.js').then(({ initForms }) => initForms()).catch(console.error);
     }
     ```
   - **Zod: you install it, the script does not, and you do not ask the user** (the form does not work without it). If pnpm blocks it (`strictDepBuilds` for a dependency script, or `minimumReleaseAge` for a version that is too new), report it; never lower the protection or approve blindly.
   - **Zod, always the latest stable version.** Check it first with `pnpm view zod dist-tags` (`latest` is the stable one; never `next`, `beta`, `alpha` or `canary`), then `pnpm add zod@latest`. Same pnpm rules as wp-vite-theme: respect `minimumReleaseAge`, never bypass it, never use npm/yarn/npx; if pnpm resolves an older version because the newest is too recent, report which one it installed. The module uses the Zod 4 API (`z.object`, `z.string().trim()`, `z.boolean()`, `.refine(fn, { error, abort })`, `.safeParse`). If `latest` is a new major, read its migration guide, check those calls still exist, run `tests/` (step 11) and update `form.js.tpl` in this skill if anything changed.
   - **Close the step with `node <skill>/scripts/install.mjs --check`.** It must exit `0` (engine copied, `functions.php` and `main.js` wired, `zod` in `package.json` and in `node_modules`). Exit `4` lists what is missing in `hints`. Do not call the form done before this passes.

5. **Write the definition** `inc/forms/<id>.php` from `examples/inc/forms/contacto.php`, replacing `{{PREFIX}}` with the theme prefix. `<id>` is lowercase (`contacto`, `cotizacion`); it becomes the form's HTML id. Field keys are lowercase snake_case. Reserved keys: `action`, `form`, `nonce`, `token` and `<prefix>_hp` (the honeypot). The engine ignores a field with a reserved key and logs it, so pick another name.

   | `type` | For | Rules (defaults) | Typing filter |
   |---|---|---|---|
   | `name` | People's names | letters (any language, accents, ñ), space, `.` `'` `-`; `min` 2, `max` 100 | removes other chars |
   | `text` | Short free text (company, subject, website) | no `<` `>` or control chars; `max` 150 | — |
   | `email` | Email | same rules as WordPress `is_email()`; `max` 254 | — |
   | `phone` | Phone | digits, spaces, `+ ( ) -`; `min_digits` 7, `max_digits` 15; stored as `+` and digits only | removes other chars |
   | `digits` | Only numbers (DNI, RUC, code) | digits only; set `min` = `max` for fixed length | removes non-digits |
   | `textarea` | Message | no `<` `>` or control chars, newlines allowed; `max` 1000 | — |
   | `select` / `radio` | One option | value must be one of `options` (whitelist) | — |
   | `checkbox` | Yes/no | boolean | — |
   | `consent` | Privacy consent | always required | — |

   Every field accepts `label` (used in the email and admin), `required`, `min`, `max`, `autocomplete` and `messages` (`required`, `invalid`, `min`, `max`) to override the default Spanish messages. Form keys: `title`, `subject`, `to`, `reply_to` (field whose value goes in Reply-To, usually `email`), `store`, `redirect`, `success`, `rate_limit` (submissions per IP per hour, default 5).

6. **Write the view** `template-parts/forms/<id>.php` from `examples/template-parts/forms/contacto.php`. Classes and layout come from Figma and the `@theme` tokens; the contract does not change:
   - `<form ... <?php <prefix>_form_attrs($id); ?>>`: sets id, `data-form`, `data-ajax-url`, `data-rules` and `novalidate`. Errors are shown by the module, not by browser bubbles.
   - Every field: `<label for="<?php echo esc_attr(<prefix>_field_id($id, 'key')); ?>">` + the input with `<?php <prefix>_field_attrs($id, 'key'); ?>` (name, id, type, required, maxlength, inputmode, autocomplete, aria-describedby) + `<p <?php <prefix>_error_attrs($id, 'key'); ?>></p>`. Never hand-write those attributes.
   - **Radios** always inside `<fieldset>` with a `<legend>` (the question), one `<label>` per option wrapping its input `<prefix>_field_attrs($id, 'key', $value)`, and one shared error box inside the fieldset.
   - Select and radio options come from `<prefix>_field_options($id, 'key')`. A select starts with an empty `<option value="">`.
   - **Required fields:** a visible legend at the top ("Los campos con * son obligatorios.") plus `*` next to each required label. The `*` can be `aria-hidden`: screen readers already announce `required`.
   - **Consent:** the label links to the privacy policy page only when `get_privacy_policy_url()` is not empty; otherwise the text goes without a link (never `href=""`), and tell the user the page is missing.
   - `<?php <prefix>_form_honeypot(); ?>` inside the form.
   - Submit: `<button type="submit" data-loading-label="Enviando...">` with the text in `<span data-submit-label>`. It gets `disabled` and `data-loading` while sending (style with `data-loading:`).
   - Status: `<p data-form-status role="status" aria-live="polite"></p>` near the button. It gets `data-state="success|error"` (style with `data-[state=error]:`). Plain text only: **no modal** (that is a separate skill).
   - Inputs at least 16px font (`text-base`) so iOS does not zoom; controls at least 44px tall (`min-h-11`).
   Escape everything printed: `esc_html`, `esc_attr`, `esc_url`.

7. **Place it** where the spec says: `get_template_part('template-parts/forms/<id>');`.

8. **Behind Cloudflare or a proxy** (only if the answer in step 2 was yes). Add to `inc/forms/<id>.php`, after the definition, so the rate limit sees each visitor's real IP:
   ```php
   add_filter('<prefix>_form_client_ip', function ($ip) {
       return isset($_SERVER['HTTP_CF_CONNECTING_IP'])
           ? sanitize_text_field(wp_unslash($_SERVER['HTTP_CF_CONNECTING_IP']))
           : $ip;
   });
   ```
   Use the header your proxy sets (`CF-Connecting-IP` for Cloudflare). Only do this when all traffic goes through that proxy: otherwise anyone can send the header and dodge the limit. The engine discards values that are not a valid IP.

9. **CRM / integrations** (only if asked). Hook `<prefix>_form_submitted` (`$form_id, $data, $sent, $form`) in the same `inc/forms/<id>.php`, after the definition. Use `wp_remote_post` with a short timeout (5 s) and log failures with `<prefix>_form_log`. Data arrives already validated and sanitized. Never show integration errors to the user.

10. **Email.** The engine only calls `wp_mail()`. Do not configure SMTP or set `From` in code. Locally, Local's Mailpit catches the emails (Local → site → Tools → Mailpit). In production, Fluent SMTP hooks into `wp_mail` and sets From to an address of the client's domain. The user's email goes only in Reply-To.

11. **Verify.** `php -l` every PHP file touched, `pnpm build`, then the parity test and the acceptance criteria below. Parity test (the theme must be active):
    ```
    php <skill>/tests/check.php <path to wp-load.php> <prefix> > forms-php.json
    node <skill>/tests/check.mjs <theme folder> forms-php.json
    ```
    Run the PHP half from the site's shell (Local → site → "Open site shell"), where the database is reachable; from a plain terminal `wp-load.php` usually cannot connect to Local's MySQL. It runs `tests/cases.json` through PHP and through the theme's Zod schema; every case must give the same result on both sides and match what is expected. Delete `forms-php.json` afterwards. When a rule or field type changes in the engine, add cases to `tests/cases.json`.

## Built into the engine (do not re-implement or remove)

- **Shared rules.** Rules travel in `data-rules`; `form.js` builds the Zod schema, `forms.php` validates with the same checks in the same order (required → max → format → min) and the same messages. Lengths count real characters (`mb_strlen` / code points), trimming removes the same whitespace on both sides (including Unicode spaces), spaces in patterns are plain spaces, and the email check in JS is a copy of WordPress `is_email()`.
- **Sanitizing all fields** by type after validation (`sanitize_text_field`, `sanitize_textarea_field`, `sanitize_email`, phone normalized, select/radio whitelist). Undefined POST fields are ignored. Invalid UTF-8 and arrays are rejected.
- **No HTML in text.** `<` and `>` are rejected in every text field, front and back. Output is escaped in the admin; the email is plain text.
- **Nonce + time token, fetched fresh** by AJAX when the form scrolls into view (or on first focus). Nothing secret lives in the cached HTML, so page cache never breaks the form.
- **Anti-spam, basic layers** (they stop simple bots, not a determined attacker):
  - Honeypot named `<prefix>_hp`, with ignore attributes for password managers. A name like "website" would be filled by browser autofill and lose real leads. Bots that fill it get a fake success and nothing is sent.
  - Minimum 3 s between issuing the token and sending.
  - The token works for one real submission; reusing it returns "expired". It is not a strong anti-replay: a bot can ask for a new token each time.
  - Rate limit per IP and form (default 5 per hour). This is the main limit, so behind a proxy step 8 is required.
  - Cloudflare Turnstile is not included: add it only for critical forms, when asked.
- **Double submit:** button disabled while sending (front); identical content from the same IP within 2 minutes is accepted once (back); a duplicate never creates a second entry (DB).
- **States:** errors per field with `aria-invalid` and focus on the first one; status text for success and errors. On error the data stays; on success the form resets, or redirects to the thank-you page. No page reload. Typing filters keep the cursor in place and wait for IME composition to finish.
- **Server errors never leak details** to the user. Details go to the log only with `WP_DEBUG`.
- **Saved submissions** (`inc/forms-entries.php`): only administrators (`manage_options`) see them; read-only (no editing, quick edit or status change; deleting is allowed); backslashes and special characters are kept as typed; no automatic deletion by age (delete from the list when no longer needed); connected to WordPress Tools → Export / Erase Personal Data, which finds entries by the form's `email` field, so a form without one has to be deleted by hand.
- **Transport:** `admin-ajax.php` with `FormData` and native `fetch`. No REST route, no axios.

## Response contract (admin-ajax)

- Success: `{ success: true, data: { message, redirect } }`.
- Invalid fields: HTTP 422, `{ success: false, data: { message, fields: { key: message } } }`.
- Expired, forged or reused token, or bad nonce: 403, `code: "expired"` (the module fetches a new token; the user sends again).
- Too fast: 429, `code: "too_fast"`. Rate limit: 429, `code: "rate_limit"`.
- Mail failed: 500, generic message; the submission is stored if `store` is `all` or `failed`.

## Acceptance criteria

Copy these into the form's spec; the verifier checks each one.

- [ ] Matches the Figma frame on desktop and mobile.
- [ ] `install.mjs --check` exits `0`. In the browser's Network tab the form module (`form.js`) loads when the page has the form; typing a digit in a name field is not allowed and an empty submit shows the custom messages.
- [ ] Parity test (step 11) passes: every case equal in JS, PHP and expected.
- [ ] Empty submit: every required field shows its message, focus moves to the first one, status says "Revisa los campos marcados."
- [ ] Name rejects digits and symbols; phone made only of dashes or spaces is rejected; `<script>` in the message is rejected.
- [ ] Without JS rules (curl straight to `admin-ajax.php`), invalid data returns 422 with the same field messages; a missing or wrong nonce returns 403.
- [ ] Valid submit: the email arrives in Mailpit with the right recipients, subject and Reply-To; the form resets and shows the success text (or redirects to the thank-you page).
- [ ] If sending fails, the typed data stays in the form.
- [ ] Double click on submit sends one email.
- [ ] Filling the honeypot (`<prefix>_hp`) returns success and sends nothing; browser autofill on the real fields still sends.
- [ ] Sending under 3 s after the token is issued returns "Espera unos segundos…"; reusing a token after a successful submission returns "expired".
- [ ] Rate limit: with a **different message each time** (identical content is treated as a double submit), the 6th submission in an hour from one IP is refused.
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

## Do not

- Do not edit `inc/forms.php` or `src/js/modules/form.js` in a theme. Change the skill's templates.
- Do not add modals, REST routes, axios, translatable strings (`__()`), Turnstile or SMTP config unless the user asks.
- Do not hand-write `name`, `id`, `required`, `maxlength` or `aria-*` on fields: the helpers print them from the definition.
- Do not trust the front: every rule must exist in the definition so PHP enforces it.
- Do not install a Zod version other than the latest stable.
- Do not consider the form finished while `install.mjs --check` does not exit `0`.
