# Accessibility and SEO rules

Used in step 5 of SKILL.md, before writing the view. These are the rules `tests/check.mjs` audits and the reasons behind them. The helpers already follow them; they matter when writing the content between `_modal_start()` and `_modal_end()`.

## Accessibility

- **Native `<dialog>` opened with `showModal()`.** It gives, for free, the focus trap, the inert background, Esc and the focus return to the trigger. Never write the `open` attribute: that opens it as non-modal, without any of that.
- **A name.** `aria-labelledby` points to the `<h2>` that `_modal_start()` prints from `title`. A modal without `title` has no accessible name. Hide it with `title_visible => false`, never remove it.
- **A description (optional).** `description` becomes a `<p>` linked with `aria-describedby`. Useful for confirmations.
- **Heading levels.** The modal title is an `<h2>`; headings inside the content start at `<h3>`. Never an `<h1>`: the page already has one.
- **Close button.** The helper prints a 44×44 px button with an accessible name (`close_label`, "Cerrar" by default) inside a `<form method="dialog">`, which closes without JavaScript. Do not remove it, not even in a lightbox.
- **Confirmations are `alertdialog`.** `role => 'alertdialog'` announces the content right away and does not close on a click outside. Put `autofocus` on the least destructive button (Cancel), not on the confirm one.
- **First focus.** The browser focuses the first focusable element, or the one with `autofocus`. For long content, do not let the first thing be a distant button: put `autofocus` where reading should start.
- **Triggers are real controls.** A `<button type="button">` (always set `type`, or it submits the form it sits in) or an `<a href>`. Never a `<div>` or a `<span>`. `_modal_trigger_attrs()` adds `aria-haspopup="dialog"` and `aria-controls`.
- **Motion.** The animation is skipped with `prefers-reduced-motion: reduce`. Do not add your own animations without the same guard.
- **Touch targets** at least 44 px; text and focus rings with enough contrast on the modal background; the focus ring is never removed.
- **Anything that must be visible above an open modal** (a cookie banner, a toast) has to live inside the modal or be a popover: the modal is in the top layer and ignores `z-index`.
- **No `tabindex` greater than 0** and no keyboard traps of your own: the browser already confines the focus.

## SEO (what the skill avoids, not what it adds)

A modal does not improve SEO. These rules keep it from hurting.

- **The content stays in the page.** It is printed in the HTML, hidden by the closed `<dialog>`; Google can still read it. Do not load it with `fetch` on open. Anything the page must rank for belongs in the visible page, not only in a modal.
- **A crawlable link when there is a real page.** If the modal shows content that also exists at a URL, make the trigger an `<a href="/that-url/">` with `_modal_trigger_attrs($id, ['link' => true])`: it works without JavaScript, can be crawled and opens in a new tab with a middle click.
- **No intrusive interstitials.** Google demotes pages that show a pop-up covering the content on mobile, especially one that appears on arrival (cookie and age notices required by law are exempt). That is why opening on load is a per-project decision: see [auto-open.md](auto-open.md). Source: secondary articles on Google's policy; check Search Central before relying on the details.
- **Images in modals are lazy** (`loading="lazy"`): a closed modal must not cost bandwidth. Give them `width` and `height`.
- **Titles and `alt`.** Every `<img>` has an `alt` (empty if decorative). Every `<iframe>` has a `title`.

## What the audit checks

Errors (the audit exits 1): `<dialog>` with `open`; no accessible name or a broken `aria-labelledby` / `aria-describedby`; an `<h1>` inside a modal; no close control with a name; duplicate ids; a trigger that points to a missing modal; an `<img>` without `alt`; an `<iframe>` without `title`; `tabindex` greater than 0; `role="dialog"` on something that is not a `<dialog>`.

Warnings: a trigger `<button>` without `type`; an `<a href="#">` trigger; an `<img>` or `<iframe>` in a modal without `loading="lazy"`; an `alertdialog` without `autofocus`; auto-open present (confirm it was asked for); a `<dialog>` without `data-modal`.
