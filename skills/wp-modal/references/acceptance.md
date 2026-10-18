# Acceptance

Copy the relevant items into the modal's spec.

## Automatic

- `php -l` on every PHP file touched.
- `pnpm build` passes and the compiled stylesheet contains `.modal__panel`.
- `node <skill>/scripts/install.mjs --check` exits `0`.
- `node <skill>/tests/check.mjs <page url | saved .html>` reports 0 errors (read the warnings).
- `node <skill>/tests/check.mjs --self-test` passes (only when the audit itself was changed).

## In the browser

Desktop and a phone (or the device toolbar), Chrome plus one of Safari/Firefox:

- [ ] Every trigger opens the right modal; the page behind does not scroll and does not jump when it opens or closes.
- [ ] The first Tab stays inside; Shift+Tab from the first control goes to the last, never to the page; Esc closes; focus returns to the trigger.
- [ ] Clicking the backdrop closes it (unless `backdrop_close` is false); selecting text inside and releasing outside does not close it.
- [ ] A confirmation does not close on backdrop click and focuses its safe button.
- [ ] A screen reader reads the title when it opens.
- [ ] The panel matches Figma at desktop and at the mobile frame (width, radius, spacing, close button).
- [ ] Content taller than the screen scrolls inside the body, with the header visible.
- [ ] 320 px wide and 400 % zoom: nothing is cut off.
- [ ] With "reduce motion" on in the OS: only a fade, no movement.
- [ ] With JavaScript disabled, `<a href>` triggers still reach the real page.
- [ ] Auto-open (if any): opens once, respects `repeat` and `min_width`, never over another modal.
- [ ] Form (if any): see `forms.md`, step 6.
- [ ] Lighthouse accessibility on the page with the modal printed: no new findings.
