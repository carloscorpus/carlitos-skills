# Classic or blocks, and the CSS of the blocks

## The decision (it is in the spec)

Cart, checkout, mini cart and account can be drawn by WooCommerce with PHP templates (classic: the shortcode, the widget) or with its own blocks. It is the project's decision, written in the **WooCommerce** table of `specs/_shared.md` (asked once by `design-import`): `clásico`, `bloques` or `no aplica`. Shop, product card and single product are always PHP templates.

| Mode | Markup | CSS | Extending it |
|---|---|---|---|
| `clásico` | the theme's template (`woocommerce/cart/cart.php`…), keeping the original's hooks | utilities / the design's CSS, like any other template | actions and filters of the original template |
| `bloques` | WooCommerce's: **no template** (it would be ignored) | `src/css/woocommerce.css` | WooCommerce's block APIs (additional checkout fields, Store API) in a plugin |
| `no aplica` | nothing | nothing | — |

When the design for a piece is far from the standard layout, `clásico` gives full control of the HTML; when it is close, `bloques` follows WooCommerce's direction (blocks are the default for new stores since WooCommerce 8.3, and the classic shortcodes keep working for stores that use them; no removal date has been announced). Check one thing before choosing: the project's payment gateway must support the mode. A gateway that only hooks into the classic checkout needs `clásico`; one built for blocks may not work with the shortcode. Never assume: look at the gateway's documentation or test it in Local.

A page uses one mode at a time: the cart page holds either the cart block or the `[woocommerce_cart]` shortcode, and the same for checkout. If cart and checkout are mixed, WooCommerce's own documentation advises reverting both to the classic version.

## CSS of the blocks

WooCommerce's guidance for themes, and the CSS cascade, give these rules. They are the reason the file has no `@layer`.

1. **No `@layer`.** WooCommerce's stylesheets are plain `<link>` tags, outside any cascade layer, and in CSS an unlayered rule beats any layered rule whatever its specificity. A rule of ours inside Tailwind's `@layer components` would lose.
2. **Scope everything to the block.** `.wc-block-cart …`, `.wc-block-checkout …`, `.wp-block-woocommerce-mini-cart …`. Nothing global.
3. **Only stable classes.** WooCommerce documents the `wc-block-components-*` prefix for components and treats the blocks' internal HTML as private: it can change in any release. Do not use selectors that depend on one block being inside another (merchants can rearrange blocks), nor `:nth-child` chains.
4. **Low specificity.** The blocks ship small resets for elements the theme styles; keep ours to one block class plus one component class so a later WooCommerce release (which changed some of its own selectors in 10.0) does not need a rewrite.
5. **Tokens, not values.** `var(--color-brand)`, `var(--radius-…)` from `@theme`. A value that is not a token is listed in the spec's "Comportamiento".
6. **Container, not viewport.** The cart and checkout blocks adapt to the width of their container (`is-large`, `is-medium`… classes, and container queries in recent versions). Use `@container` if the layout must change, not `@media`.
7. **Global styles first.** For colors, typography and spacing that apply to the whole site, `theme.json` styles reach the blocks without any selector. Write CSS only for what they cannot do.
8. **Do not dequeue the blocks' CSS.** Since WooCommerce Blocks 10.7 each block loads its own stylesheet, and removing it keeps the new markup without its styles. If a store page does not need blocks' CSS at all, that is WooCommerce's job.

The starting point is the comment at the top of the generated `src/css/woocommerce.css`. Write one section per piece, in the order cart, checkout, mini cart, account, each with a comment naming the spec section it comes from.

## Verified on a real site (WooCommerce 11.2.2)

- WooCommerce's block CSS has no `@layer` (`wc-blocks.css`, `checkout.css`: zero), so ours must not be inside one either.
- After `pnpm build` with Tailwind 4, the imported `woocommerce.css` stays **outside** any `@layer` in the compiled stylesheet.
- In the checkout page the theme's stylesheet is printed **after** `wc-blocks-style`, `wc-blocks-packages-style` and `wc-blocks-style-checkout`, and a scoped selector (`.wc-block-checkout .wc-block-components-…`, two classes) has more specificity than the block's own (`.wc-block-components-…`, one class). Both reasons make ours win without `!important`.
- Exception: WooCommerce does use `!important` in a few places (the notice banner's button, for example). To change those, ours needs `!important` too, only for that property.

## What still has to be checked by eye

These need a browser; the repository's tests and the checks above cannot see them:

- The result at phone and desktop width, and the computed color of the buttons (global styles of the site can also paint them).
- A real payment with the project's gateway reaching "pedido recibido".
