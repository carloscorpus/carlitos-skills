# Engine behavior and response contract

Read when you need to know what the engine already does (so you do not re-implement it), when debugging a submit, or before changing the templates of this skill.

## Built into the engine (do not re-implement or remove)

- **Shared rules.** Rules travel in `data-rules`; `form.js` builds the Zod schema, `forms.php` validates with the same checks in the same order (required → max → format → min) and the same messages. Lengths count real characters (`mb_strlen` / code points), trimming removes the same whitespace on both sides (including Unicode spaces), spaces in patterns are plain spaces, and the email check in JS is a copy of WordPress `is_email()`.
- **Sanitizing all fields** by type after validation (`sanitize_text_field`, `sanitize_textarea_field`, `sanitize_email`, phone normalized, select/radio whitelist). Undefined POST fields are ignored. Invalid UTF-8 and arrays are rejected.
- **No HTML in text.** `<` and `>` are rejected in every text field, front and back. Output is escaped in the admin; the email is plain text.
- **Nonce + time token, fetched fresh** by AJAX when the form scrolls into view (or on first focus). Nothing secret lives in the cached HTML, so page cache never breaks the form.
- **Anti-spam, basic layers** (they stop simple bots, not a determined attacker):
  - Honeypot named `<prefix>_hp`, with ignore attributes for password managers. A name like "website" would be filled by browser autofill and lose real leads. Bots that fill it get a fake success and nothing is sent.
  - Minimum 3 s between issuing the token and sending.
  - The token works for one real submission; reusing it returns "expired". It is not a strong anti-replay: a bot can ask for a new token each time.
  - Rate limit per IP and form (default 10 per hour). This is the main limit, so behind a proxy step 8 is required. It is **not atomic** (read, then write a transient): a burst of parallel requests from one IP can let a few more submissions through than the limit. Users on a shared IP can consume the same limit. For a critical form, add Cloudflare rate limiting or Turnstile (Turnstile only when asked).
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
