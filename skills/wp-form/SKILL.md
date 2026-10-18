---
name: wp-form
description: 'Build a secure, accessible form in a WordPress theme with Vite and pnpm (contact, quote, newsletter, lead): Zod in the front and the same rules in PHP, nonce, anti-spam, double-submit protection, wp_mail and optional saved submissions. Use when a spec says `skill: wp-form`, or the user asks for a form, "formulario", "form de contacto", "cotización", "arma el form", or gives a Figma frame of a form.'
metadata:
  version: "1.3.1"
---

# wp-form

One definition per form drives everything. `inc/forms/<id>.php` declares the fields and their rules once; from it come the HTML attributes, the Zod schema in the browser and the PHP validation. Both sides share the same rules, the same check order and the same messages, and `tests/` proves it with one set of cases run on both. Where they could still differ, the server decides: its error comes back to the field (HTTP 422).

The engine files are generic and are **not edited per project**. A new form only needs its definition and its view.

| File | Created by | Per project? |
|---|---|---|
| `inc/forms.php` | `scripts/install.mjs` | No, engine: rules, validation, nonce, spam, mail, HTML helpers |
| `src/js/modules/form.js` | `scripts/install.mjs` | No, engine: Zod schema from rules, errors, states, AJAX submit |
| `inc/forms-entries.php` | `scripts/install.mjs --entries` | No, optional: "Envíos" menu in the admin |
| wp-form block in `CLAUDE.md` | `scripts/install.mjs` (from `claude-block.md.tpl`) | No: do not edit it by hand, the next install replaces it |
| `inc/forms/<id>.php` | you, from `examples/` | Yes: fields, recipients, store, redirect |
| `template-parts/forms/<id>.php` | you, from `examples/` + Figma | Yes: the markup and classes |
| `tests/` (stays in the skill) | — | Run against the theme to check front/back parity |

If the engine needs a change, change the template in this skill, bump `metadata.version` in its SKILL.md and note it in its CHANGELOG.md; never the copy in a theme.

Detail lives in `references/` and is read only by the step that points to it.

## Steps

1. **Read context.** From the theme root: read `CLAUDE.md` if the theme has one (prefix, slug) and the form's spec if there is one. Without `CLAUDE.md`, the prefix is the theme folder name with `-` turned into `_` (`install.mjs` prints it as `values.PREFIX`); if the theme's existing PHP functions use another prefix, ask the user and pass it with `--slug`. The theme only needs `style.css`, `functions.php` and `vite.config.*`: it does not have to come from `wp-vite-theme`. If a Figma link is given, read the frame through the Figma MCP for the view (follow the Figma server's design-to-code instructions). The spec says what the form does; Figma says how it looks. If they contradict (fields, required ones), stop and ask: do not decide.

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
   Add `--entries` if any form stores submissions (it can be added later by re-running with `--entries`). The installer finds Vite's main JS file by reading `vite.config.*` and prints it as `entry`. If it exits `1` with `candidates` (or none), ask the user which file is the theme's main JS and re-run with `--entry <path relative to the theme root>`. The JSON lists `create`, `unchanged` and `conflicts`, and `claudeMd`: the installer keeps a short wp-form block (between `<!-- wp-form:start -->` and `<!-- wp-form:end -->`) in the theme's `CLAUDE.md` so future sessions know how the forms are organized. `added` / `updated` / `unchanged` are fine; `missing` means the theme has no `CLAUDE.md` (it is not created: tell the user). If `conflicts` is non-empty, show them and ask file by file: overwrite or keep. Then run without `--dry-run`, with `--overwrite` / `--skip` covering every conflict. Exit codes: `0` ok, `1` invalid input, slug not starting with a letter, theme without `functions.php` / `vite.config.*`, or main JS not found (see `--entry`), `2` unresolved conflicts, `3` leftover placeholders (fix the template, not the output), `4` (`--check` only) something is not wired.

4. **Wire it up** (first form only). The installer from step 3 already does the first two points, once, without duplicating them when re-run; confirm in its `wired` output. Without them the form has no JavaScript: no custom errors, no typing filters, and nothing warns you.
   - `functions.php`: `require_once get_theme_file_path('/inc/forms.php');` after the other requires. `forms.php` loads `inc/forms/*.php` and `inc/forms-entries.php` by itself.
   - The theme's main JS (`entry` in the installer output; `src/js/main.js` in a wp-vite-theme theme): loads the module only on pages that have a form, so Zod is not downloaded elsewhere (the `.catch` makes an import failure visible in the console). The path is computed from `entry` to `src/js/modules/form.js`:
     ```js
     if (document.querySelector('form[data-form]')) {
         import('./modules/form.js').then(({ initForms }) => initForms()).catch(console.error);
     }
     ```
   - **Zod: you install it, the script does not, and you do not ask the user** (the form does not work without it). If pnpm blocks it (`strictDepBuilds` for a dependency script, or `minimumReleaseAge` for a version that is too new), report it; never lower the protection or approve blindly.
   - **Zod, always the latest stable version.** Check it first with `pnpm view zod dist-tags` (`latest` is the stable one; never `next`, `beta`, `alpha` or `canary`), then `pnpm add zod@latest`. pnpm rules: respect `minimumReleaseAge`, never bypass it, never use npm/yarn/npx; if pnpm resolves an older version because the newest is too recent, report which one it installed. The module uses the Zod 4 API (`z.object`, `z.string().trim()`, `z.boolean()`, `.refine(fn, { error, abort })`, `.safeParse`). If `latest` is a new major, read its migration guide, check those calls still exist, run `tests/` (step 11) and update `form.js.tpl` in this skill if anything changed.
   - **Close the step with `node <skill>/scripts/install.mjs --check`.** It must exit `0` (engine copied, `functions.php` and the main JS wired, `zod` in `package.json` and in `node_modules`). Exit `4` lists what is missing in `hints`. It also prints `engineVersion` (installed vs this skill's): when they differ, the theme has an older engine; run `--dry-run`, show the conflicts and ask before overwriting (never overwrite silently). Do not call the form done before this passes.

5. **Write the definition** `inc/forms/<id>.php` from `examples/inc/forms/contacto.php`, replacing `{{PREFIX}}` with the theme prefix. Read [references/field-types.md](references/field-types.md) for the field types, their default rules, the reserved keys and the form-level keys.

6. **Write the view** `template-parts/forms/<id>.php` from `examples/template-parts/forms/contacto.php`. Read [references/view-contract.md](references/view-contract.md) first: the helpers that print the attributes, radios, required marks, consent, honeypot, submit button, status text and minimum sizes. Never hand-write the attributes the helpers print.

7. **Place it** where the spec says: `get_template_part('template-parts/forms/<id>');`.

8. **Behind Cloudflare or a proxy** (only if the answer in step 2 was yes). Add the `<prefix>_form_client_ip` filter to `inc/forms/<id>.php`; the exact code and its caveat are in the "Behind Cloudflare" section of [references/integrations.md](references/integrations.md). Skip otherwise.

9. **CRM / integrations** (only if asked). Use the `<prefix>_form_submitted` hook; see the "CRM" section of [references/integrations.md](references/integrations.md).

10. **Email.** The engine only calls `wp_mail()`: no SMTP and no `From` in code (Mailpit locally, Fluent SMTP in production). See the "Email" section of [references/integrations.md](references/integrations.md) if the user asks about mail setup.

11. **Verify.** `php -l` every PHP file touched, `pnpm build`, then the parity test and the acceptance criteria in [references/acceptance.md](references/acceptance.md) (copy them into the form's spec). Parity test (the theme must be active):
    ```
    php <skill>/tests/check.php <path to wp-load.php> <prefix> > forms-php.json
    node <skill>/tests/check.mjs <theme folder> forms-php.json
    ```
    Run the PHP half from the site's shell (Local → site → "Open site shell"), where the database is reachable; from a plain terminal `wp-load.php` usually cannot connect to Local's MySQL. It runs `tests/cases.json` through PHP and through the theme's Zod schema; every case must give the same result on both sides and match what is expected. Delete `forms-php.json` afterwards. When a rule or field type changes in the engine, add cases to `tests/cases.json`.

## Reference

- [references/engine-behavior.md](references/engine-behavior.md): what the engine already does (shared rules, sanitizing, nonce and token, anti-spam layers and their limits, double submit, saved submissions) and the admin-ajax response codes. Read it before re-implementing anything or changing the engine templates.

## Do not

- Do not edit `inc/forms.php` or `src/js/modules/form.js` in a theme. Change the skill's templates.
- Do not add REST routes, axios, translatable strings (`__()`), Turnstile or SMTP config unless the user asks. A form inside a modal is built with the `wp-modal` skill (it prints the form view inside the modal); do not build the modal here.
- Do not hand-write `name`, `id`, `required`, `maxlength` or `aria-*` on fields: the helpers print them from the definition.
- Do not trust the front: every rule must exist in the definition so PHP enforces it.
- Do not install a Zod version other than the latest stable.
- Do not consider the form finished while `install.mjs --check` does not exit `0`.
