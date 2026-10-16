# Proxy, CRM and email

Used in steps 8, 9 and 10 of SKILL.md. Read only the section that applies.

## Behind Cloudflare or a proxy (step 8)

Only if the answer in step 2 was yes. Add to `inc/forms/<id>.php`, after the definition, so the rate limit sees each visitor's real IP:

```php
add_filter('<prefix>_form_client_ip', function ($ip) {
    return isset($_SERVER['HTTP_CF_CONNECTING_IP'])
        ? sanitize_text_field(wp_unslash($_SERVER['HTTP_CF_CONNECTING_IP']))
        : $ip;
});
```

Use the header your proxy sets (`CF-Connecting-IP` for Cloudflare). Only do this when all traffic goes through that proxy: otherwise anyone can send the header and dodge the limit. The engine discards values that are not a valid IP.

## CRM / integrations (step 9)

Only if asked. Hook `<prefix>_form_submitted` (`$form_id, $data, $sent, $form`) in the same `inc/forms/<id>.php`, after the definition. Use `wp_remote_post` with a short timeout (5 s) and log failures with `<prefix>_form_log`. Data arrives already validated and sanitized. Never show integration errors to the user.

## Email (step 10)

The engine only calls `wp_mail()`. Do not configure SMTP or set `From` in code. Locally, Local's Mailpit catches the emails (Local → site → Tools → Mailpit). In production, Fluent SMTP hooks into `wp_mail` and sets From to an address of the client's domain. The user's email goes only in Reply-To.
