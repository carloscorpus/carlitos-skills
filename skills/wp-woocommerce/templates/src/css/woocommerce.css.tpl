/*
 * Bloques de WooCommerce (carrito, checkout, mini-carrito) con el diseño del proyecto. Skill wp-woocommerce {{ENGINE_VERSION}}.
 *
 * Reglas (documentación de WooCommerce y el cascado de CSS):
 *   - CSS normal, SIN @layer: los estilos de WooCommerce no están en ninguna capa y un estilo sin capa
 *     le gana a uno con capa, aunque el segundo sea más específico.
 *   - Todo acotado al bloque (.wc-block-cart, .wc-block-checkout, .wp-block-woocommerce-mini-cart…) y solo con
 *     clases estables `wc-block-components-*`. Nunca selectores que dependan de la estructura interna.
 *   - Valores desde los tokens (var(--color-…)), no valores sueltos.
 *   - Los bloques miden su contenedor (container queries), no la pantalla: no uses @media para su disposición.
 */
