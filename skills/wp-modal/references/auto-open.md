# Auto-open

Used in steps 2 and 7 of SKILL.md. Whether a modal opens by itself depends on the project, so it is off by default and the agent asks. This file says what to ask, what to tell the user and how to configure it.

## What to ask (in one message)

1. **When:** `load` (as soon as the page is ready) | `delay` (after N ms) | `scroll` (after N % of the page).
2. **How often:** `always` (every page view) | `session` (once per browser session) | `days:N` (again after N days).
3. **Which pages:** only the home, a landing, everywhere. The modal is printed with `get_template_part()` only on those pages (use the usual conditionals: `is_front_page()`, `is_page('x')`).
4. **On mobile too?** If not, set `min_width` (for example `768`): the engine then opens it only on screens at least that wide. The check runs in the browser, so it works with any page cache (do not use `wp_is_mobile()` or other server-side device checks for this).

## What to tell the user

- **Mobile pop-ups and SEO.** Google demotes mobile pages whose content is covered by an intrusive pop-up, mostly when it shows right after the visitor arrives from a search result. Legal notices (cookies, age checks) and small banners are exempt. It is a ranking risk, not a bug; the choice is the project's. Source: secondary articles on Google's policy; check Search Central for the current wording.
- **Focus and screen readers.** An auto-opened modal takes the focus without the visitor asking. Prefer `delay` (a few seconds) or `scroll` over `load`, and keep the content short.
- **Storage.** `repeat => 'session'` and `days:N` store a small flag in `sessionStorage` / `localStorage` (key `wp-modal:<id>`, no personal data) to avoid showing it again. If the project is under a consent regulation, confirm with whoever owns the privacy policy that this flag is acceptable; with `always` nothing is stored.
- **Not in v1:** exit-intent (mouse leaving the window). It has no equivalent on mobile and is very intrusive.

## Configuration

```php
<?php {{PREFIX}}_modal_start('promo', [
    'title' => '...',
    'auto' => [
        'on' => 'delay',      // delay | load | scroll   (default: delay)
        'delay' => 4000,      // ms, for 'delay'          (default: 3000)
        'scroll' => 50,       // %, for 'scroll'          (default: 50)
        'min_width' => 768,   // px; only open on screens at least this wide (default: 0 = always)
        'repeat' => 'days:7', // always | session | days:N (default: session)
    ],
]); ?>
```

The engine never opens it on top of another open modal and never opens it if it was already shown according to `repeat`. The visitor can always close it (Esc, the close button, a click outside).

## Test it

In the browser console, `sessionStorage.clear()` and `localStorage.removeItem('wp-modal:<id>')` reset the flag to see it again.
