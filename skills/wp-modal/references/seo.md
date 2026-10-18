# SEO

A modal does not improve SEO. The rules here make sure it does not hurt, and say when a modal is the wrong tool.

## What helps

- **Print the content in the page HTML.** The modal markup is rendered by PHP inside the page, so it is in the source. Search engines see it; it is also available to assistive tech and to users with slow JavaScript.
- **Use `<a href>` as the trigger when the content has (or should have) its own URL** (`['link' => true]`). The URL is crawlable, shareable and works without JavaScript; the modal is only an enhancement.
- **Keep Core Web Vitals clean.** The engine avoids layout shift when the scrollbar disappears. In your view: `width` and `height` on images, `loading="lazy"` on heavy images and iframes (they would otherwise download while the modal is closed), no render-blocking embeds.
- **Use real headings and alt text** inside the modal (`h2`/`h3`, never `h1`).

## What hurts

- **Content that matters for ranking inside a modal.** Text that only appears after a click may be given less weight. If the content is the point of the page, make it a page.
- **Intrusive interstitials.** Google demotes pages where a popup covers the main content right after arriving from search, especially on mobile. See `auto-open.md`: avoid `load` on mobile, prefer `delay`/`scroll`, keep a visible close button, and exclude legally required dialogs (cookies, age) from the concern.
- **Loading modal content with `fetch`.** It is not in the initial HTML.
- **Triggers like `<a href="#">`.** They are not links to anything; the audit warns about them.
- **Hiding the main navigation or forms of a page only in a modal.**

## Not covered by this skill

Structured data, meta tags and canonical URLs belong to the page, not to the modal. If a modal opens a URL that should rank, the page behind that URL carries them.
