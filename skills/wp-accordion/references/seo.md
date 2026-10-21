# SEO

An accordion does not improve SEO. The rules here make sure it does not hurt, and say when an accordion is the wrong tool.

## What helps

- **Print the content in the page HTML.** The panels are rendered by PHP inside the page, so the text is in the source, in the DOM from the first paint and available to assistive tech. Google indexes content in collapsed `<details>` as part of the page.
- **Short, real titles.** The `<summary>` text is the question or label; write it the way a person would search it.
- **Use real headings when the titles are headings** (`heading` option), in order and never `h1`. Otherwise leave them as plain labels.
- **Keep Core Web Vitals clean.** The panel has no fixed height and the engine animates with CSS only, so nothing shifts the layout beyond the item itself. In your view: `width` and `height` on images, `loading="lazy"` on heavy images and iframes (they would otherwise download while the item is closed), no render-blocking embeds.
- **Link to an item with `<a href="#id">`.** The engine opens it and scrolls to it; the link also works as a normal anchor without JavaScript.

## What hurts

- **Content that matters for ranking hidden in a closed item.** Text that needs a click may be given less weight. If it is the point of the page (the description of a service, the main text of a product), show it; use the accordion for secondary detail (questions, specs, conditions).
- **Hiding with `display: none` / `hidden`.** Use the closed `<details>`, which the browser can still search and open.
- **Loading panel content with `fetch`.** It is not in the initial HTML.
- **A whole page made of accordions.** Usability suffers and so does skimming. Past ~10 items, group them under headings.
- **Duplicated content.** The same text in an accordion and visible elsewhere on the page.

## Why there is no FAQ structured data

`FAQPage` markup (JSON-LD) used to give FAQ rich results in Google. Since August 2023 Google only shows them for well-known government and health sites; for the rest of the web it has no visible effect. The skill therefore does not print it: it adds code and a second copy of the text to keep in sync, for nothing the user can see.

If a project has a specific reason (a site in the health or government category, or a third-party tool that reads it), add it as part of the page's structured data, not in the accordion engine, and keep the JSON-LD identical to the visible text.

## Not covered by this skill

Structured data, meta tags and canonical URLs belong to the page, not to the accordion.
