# Acceptance criteria

Used in step 8 of SKILL.md. Copy the items that apply into the modal's spec. Two parts: an automatic audit and a browser checklist, because focus and animation can only be seen in a real browser.

## 1. Static audit (automatic)

```
node <skill>/tests/check.mjs <page url | saved .html>
node <skill>/tests/check.mjs --self-test      # the audit's own fixtures
```
It must report no errors (exit `0`). The rules are listed in [accessibility.md](accessibility.md). Run it on every page that prints a modal, with the modal printed in the HTML (a modal that only exists after a user action is not in the audit).

## 2. Browser checklist (real browser)

Do each item with the keyboard first, then with the mouse. Mark the ones that could not be tested instead of assuming them.

**Open and close**
- [ ] The trigger opens the modal. With JavaScript disabled, a `<button>` still opens it in a current browser and an `<a href>` goes to its page.
- [ ] Esc closes it and the focus returns to the trigger.
- [ ] The close button closes it (mouse and Enter/Space).
- [ ] A click on the dimmed background closes it (not an `alertdialog`, not a non-modal dialog). Selecting text inside and releasing outside does **not** close it.

**Keyboard and screen reader**
- [ ] Tab and Shift+Tab stay inside a modal; the page behind is not reachable.
- [ ] The first focus lands where reading should start (the first control, or the `autofocus` one; Cancel in an `alertdialog`).
- [ ] The focus ring is always visible. The reading order matches the visual order.
- [ ] A screen reader announces the title as the dialog's name (and the description if there is one).

**Layout**
- [ ] At 390 px wide: nothing overflows horizontally; a long content scrolls inside the modal, not the page; the close button is reachable.
- [ ] At 1440 px wide: the size and placement match the design.
- [ ] The page behind does not scroll while a modal is open, and does not jump when it opens or closes.
- [ ] Zoom at 200 % and a landscape phone: the content is still reachable by scrolling inside the modal.
- [ ] With "reduce motion" enabled in the system, the modal appears without animation.
- [ ] Animation, opening and closing: a drawer or bottom sheet slides in **opaque** (never see-through) while only the dimmed background fades; the centered modal fades and rises slightly; on closing, nothing jumps to a corner and the page is clickable again right away.

**Design fidelity (against the Figma frames)**
- [ ] Desktop: width, radius, padding, colors, shadow, dimmed background, title style and close button match the frame (measure with the browser's inspector, not by eye).
- [ ] Mobile: it matches the mobile frame (`mobile` set as the design shows); the width never exceeds the screen.
- [ ] Values shared by several modals live once in the project CSS as `--modal-*` tokens, not repeated in each view; no `size` preset was used where a design exists.
- [ ] The close button is still at least 44 × 44 px after applying `close_class`.

**Auto-open (only if the project asked for it)**
- [ ] It opens when and where agreed, not over another open modal.
- [ ] With `repeat` `session` or `days:N`, it does not open again after the first time (reset it as in [auto-open.md](auto-open.md) to see it once more).
- [ ] On mobile it matches what the user decided.

**Non-modal dialog (only if used)**
- [ ] The page behind stays usable and scrolls; Esc closes it when the focus is inside; the focus returns to the trigger.
