# Panel type

Decide from the Figma frame, not from the user's word ("popup" can be any of these). Ask only if the frame does not settle it.

| The frame shows | Type | Options |
|---|---|---|
| A card centered over a dimmed page, free content | Centered modal | `placement => 'center'` |
| A short question with two choices (cancel / confirm) | Confirmation | `role => 'alertdialog'`, `backdrop_close => false`, `autofocus` on the least destructive button |
| A full-height panel attached to the right or left edge | Drawer | `placement => 'right'` or `'left'` |
| A panel attached to the bottom edge (usually the mobile frame) | Bottom sheet | `placement => 'bottom'`, or `mobile => 'sheet'` on a centered modal |
| One image or video over a dark backdrop, little chrome | Lightbox | `placement => 'center'`, `title_hidden => true`, `alt` on the image |
| The page stays usable next to the panel (filters, chat) | Not a modal | A plain `<aside>`, no dialog. Tell the user: this skill is for panels that block the page |

Notes:
- **The desktop and mobile frames can differ.** A centered modal on desktop that becomes a bottom sheet or a full screen on mobile is one modal with `mobile => 'sheet'` or `'fullscreen'`, not two modals.
- **Lightbox:** one image or one video. A gallery with arrows and thumbnails is not covered: tell the user instead of improvising.
- **A modal that only exists to show a page that already has its own URL** is better as a link to that page (see `seo.md`). Say so, and let the user decide.
- If the frame needs a close button outside the panel, no close button, or one modal opening another, stop and tell the user (see `SKILL.md`, step 3).
