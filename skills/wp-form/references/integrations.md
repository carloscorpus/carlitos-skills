# Proxy, CRM and email

Used in steps 8, 9 and 10 of SKILL.md. Read only the section that applies.

## Behind Cloudflare or a proxy (step 8)

The rate limit and the double-submit check use the visitor's real IP by themselves, with no server setup (works on a plain cPanel without `mod_remoteip` or `real_ip`). The engine trusts only Cloudflare's published ranges and private, loopback and reserved IPs (what a hosting proxy uses). If `REMOTE_ADDR` is not one of them, it is used as is and every header is ignored, so nobody changes their IP by sending headers. From Cloudflare it takes `CF-Connecting-IP`; from another trusted proxy it reads `X-Forwarded-For` from right to left, skipping trusted proxies, and never takes the leftmost value on its own (the client writes it).

Only for a proxy with public IPs that is not Cloudflare (step 2): add its ranges in `inc/forms/<id>.php`, after the definition:

```php
add_filter('<prefix>_form_trusted_proxies', function (array $ranges) {
    return array_merge($ranges, ['203.0.113.0/24', '2001:db8:10::/48']); // the proxy's CIDR ranges
});
```

The same filter can remove a range (`array_diff`). Cloudflare's ranges are written in `inc/forms.php` with the date they were copied from https://www.cloudflare.com/ips-v4 and /ips-v6; check them now and then (the skill updates them). To go back to `REMOTE_ADDR` only, define `<PREFIX>_FORM_TRUST_PROXIES` as `false` in `wp-config.php`. The `<prefix>_form_client_ip` filter still runs last; an old one that returns `CF-Connecting-IP` unconditionally should be removed, because it trusts the header even when the request did not come through Cloudflare.

## CRM / integrations (step 9)

Only if asked. Hook `<prefix>_form_submitted` (`$form_id, $data, $sent, $form`) in the same `inc/forms/<id>.php`, after the definition. Use `wp_remote_post` with a short timeout (5 s) and log failures with `<prefix>_form_log`. Data arrives already validated and sanitized; a `checkboxes` field is a list of option values (`['web', 'seo']`), use `<prefix>_form_value_text($form['fields'][$key], $value)` for its labels. Never show integration errors to the user.

## Email (step 10)

The engine only calls `wp_mail()`. Do not configure SMTP or set `From` in code. Locally, Local's Mailpit catches the emails (Local → site → Tools → Mailpit). In production, Fluent SMTP hooks into `wp_mail` and sets From to an address of the client's domain. The user's email goes only in Reply-To.
