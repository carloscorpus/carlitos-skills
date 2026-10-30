# Field types and definition keys

Used in step 5 of SKILL.md, when writing `inc/forms/<id>.php`.

`<id>` is lowercase (`contacto`, `cotizacion`); it becomes the form's HTML id. Field keys are lowercase snake_case. Reserved keys: `action`, `form`, `nonce`, `token` and `<prefix>_hp` (the honeypot). The engine ignores a field with a reserved key and logs it, so pick another name.

| `type` | For | Rules (defaults) | Typing filter |
|---|---|---|---|
| `name` | People's names | letters (any language, accents, ñ), space, `.` `'` `-`; `min` 2, `max` 100 | removes other chars |
| `text` | Short free text (company, subject, website) | no `<` `>` or control chars; `max` 150 | — |
| `email` | Email | same rules as WordPress `is_email()`; `max` 254 | — |
| `phone` | Phone | digits, spaces, `+ ( ) -`; `min_digits` 7, `max_digits` 15; stored as `+` and digits only | removes other chars |
| `digits` | Only numbers (DNI, RUC, code) | digits only; set `min` = `max` for fixed length | removes non-digits |
| `textarea` | Message | no `<` `>` or control chars, newlines allowed; `max` 1000 | — |
| `select` / `radio` | One option | value must be one of `options` (whitelist) | — |
| `checkbox` | Yes/no (one box) | boolean | — |
| `checkboxes` | Several options ("elige uno o más") | every value must be one of `options` (whitelist); `required` = at least one; `min` / `max` count checked options (`max` 0 = no limit); stored as a list in the order of `options` | — |
| `consent` | Privacy consent | always required | — |

For `checkboxes`, `min` and `max` are numbers of options, not characters, and the default messages say so ("Elige al menos 2 opciones.", "Elige como máximo 3 opciones."). The email and the saved submission show the labels joined with commas.

Every field accepts `label` (used in the email and admin), `required`, `min`, `max`, `autocomplete` and `messages` (`required`, `invalid`, `min`, `max`) to override the default Spanish messages. Form keys: `title`, `subject`, `to`, `reply_to` (field whose value goes in Reply-To, usually `email`), `store`, `redirect`, `success`, `rate_limit` (submissions per IP per hour, default 10).
