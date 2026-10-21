# Acceptance

Copy the relevant items into the accordion's spec.

## Automatic

- `php -l` on every PHP file touched.
- `pnpm build` passes and the compiled stylesheet contains `.accordion__summary`.
- `node <skill>/scripts/install.mjs --check` exits `0`.
- `node <skill>/tests/check.mjs <page url | saved .html>` reports 0 errors (read the warnings).
- `node <skill>/tests/check.mjs --self-test` passes (only when the audit itself was changed).

## In the browser

Desktop and a phone (or the device toolbar), Chrome plus one of Safari/Firefox:

- [ ] Click and tap open and close each item; the whole row is clickable, not only the icon.
- [ ] Tab reaches each title in order; Enter and Space toggle; the focus ring is visible on every title and has contrast against the background.
- [ ] A screen reader reads each title as a button with its state (expanded / collapsed), and reads the panel when open.
- [ ] Exclusive mode (if any): opening one closes the others, also in the second browser.
- [ ] The items that should start open are open; no important content depends on a closed item.
- [ ] A link `<a href="#item-id">` (from the same page or from outside) opens that item and scrolls to it, with the page header not covering it (adjust `scroll-margin-top` in the project if there is a sticky header).
- [ ] Ctrl+F for a word inside a closed item opens it.
- [ ] The accordion matches the design at desktop and at the mobile frame (spacing, icon, title style, open state).
- [ ] 320 px wide and 400 % zoom: titles wrap, nothing is cut off, the icon stays on its side.
- [ ] A long title and a long unbroken word do not overflow.
- [ ] With "reduce motion" on in the OS: no animation.
- [ ] With JavaScript disabled: items still open and close.
- [ ] A panel with an image or an iframe: it does not download before the item is opened (lazy), and opening does not shift the page below unexpectedly.
- [ ] Lighthouse accessibility on the page with the accordion printed: no new findings.
