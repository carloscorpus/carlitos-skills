// Lectura de lo propio de WooCommerce: las decisiones del spec, las plantillas de woocommerce/ del tema y la
// copia de WooCommerce instalada (para comparar versiones y hooks). Solo lee; sin dependencias.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { WOO_PIECES, hasSpecs, loadSpecs, noAccent, parseWoo, read, unwrap } from './specs.mjs';

export const ENGINE_BASE = 'inc/woocommerce/base.php';
export const ENGINE_FRAGMENTS = 'inc/woocommerce/fragments.php';
export const ENGINE_CSS = 'src/css/woocommerce.css';

// Lo que el spec decidió: contenidos con Origen woo, la tabla "WooCommerce" y las páginas de esos contenidos.
// Devuelve { specs: false } si no hay specs; `woo` es null si falta la sección.
export function readWoo(specsDir) {
    if (!hasSpecs(specsDir)) return { specs: false };
    const { dynamic, all } = loadSpecs(specsDir);
    const contents = dynamic.filter((row) => row.origin === 'woo').map((row) => row.name);
    const woo = parseWoo(read(join(specsDir, '_shared.md')));
    const modes = woo ? Object.fromEntries(woo.pieces.map(({ piece, mode }) => [piece, mode])) : {};
    const pages = all
        .filter((page) => contents.includes(unwrap(page.labels.Contenido ?? '')))
        .map((page) => ({
            slug: page.slug,
            tipo: noAccent(unwrap(page.labels.Tipo ?? '')),
            contenido: unwrap(page.labels.Contenido ?? ''),
            plantilla: unwrap(page.labels.Plantilla ?? ''),
            state: page.labels.Estado ?? '',
        }));
    const missingPieces = woo ? WOO_PIECES.filter((piece) => !['clásico', 'bloques', 'no aplica'].includes(modes[piece])) : WOO_PIECES;
    return { specs: true, contents, woo, modes, missingPieces, pages };
}

// Qué decidió el spec que hay que instalar: el mini-carrito clásico necesita fragmentos y cualquier pieza en
// bloques necesita el CSS de bloques.
export function needs(modes) {
    return {
        fragments: modes['mini-carrito'] === 'clásico',
        css: WOO_PIECES.some((piece) => modes[piece] === 'bloques'),
        // Carrito, checkout y cuenta son páginas de WordPress con su contenido adentro: el tema necesita una plantilla
        // de página que lo imprima (index.php no lo hace).
        page: ['carrito', 'checkout', 'cuenta'].some((piece) => modes[piece] && modes[piece] !== 'no aplica'),
    };
}

// El tema ya tiene plantilla para las páginas con contenido (page.php o singular.php).
export const hasPageTemplate = (target) => existsSync(join(target, 'page.php')) || existsSync(join(target, 'singular.php'));

// Pieza a la que pertenece una plantilla de woocommerce/ (null: siempre es PHP: tienda, tarjeta, ficha…).
export function pieceOf(rel) {
    if (/^woocommerce\/cart\/mini-cart\.php$/.test(rel)) return 'mini-carrito';
    if (/^woocommerce\/cart\//.test(rel)) return 'carrito';
    if (/^woocommerce\/checkout\//.test(rel)) return 'checkout';
    if (/^woocommerce\/myaccount\//.test(rel)) return 'cuenta';
    return null;
}

function phpFilesUnder(dir) {
    const out = [];
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
        if (['node_modules', 'vendor', '.git', 'dist', 'specs'].includes(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...phpFilesUnder(path));
        else if (name.endsWith('.php')) out.push(path);
    }
    return out;
}
export const themePhpFiles = (target) => phpFilesUnder(target).map((path) => relative(target, path).split(sep).join('/'));

// Las plantillas del tema que sobrescriben las de WooCommerce.
export const listOverrides = (target) => themePhpFiles(target).filter((rel) => rel.startsWith('woocommerce/'));

// Marcadores que design-import deja donde va la lógica de WooCommerce: `// woo: precio`, `/* woo: … */`, `<!-- woo: … -->`.
export function markersIn(source) {
    return [...source.matchAll(/(?:\/\/|\/\*|<!--)\s*woo:\s*([^\n]*)/g)]
        .map((m) => m[1].replace(/\s*(?:\*\/|-->|\?>).*$/, '').trim())
        .filter(Boolean);
}

export const versionOf = (source) => /@version\s+(\d+(?:\.\d+)*)/.exec(source)?.[1] ?? null;

// -1, 0 o 1 comparando "9.4.0" con "9.10.0" número a número.
export function compareVersions(a, b) {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? 0) - (y[i] ?? 0);
        if (d) return d < 0 ? -1 : 1;
    }
    return 0;
}

// La carpeta templates/ del plugin WooCommerce: la que se pasa con --woo (la raíz del plugin) o la que está junto al
// tema (wp-content/themes/<tema> → wp-content/plugins/woocommerce). null si no se encuentra.
export function findWooCore(target, explicit) {
    const root = explicit ? resolve(explicit) : resolve(target, '..', '..', 'plugins', 'woocommerce');
    const templates = join(root, 'templates');
    return existsSync(templates) ? templates : null;
}

export const hooksOf = (source) => [...new Set([...source.matchAll(/do_action\(\s*['"]([\w-]+)['"]/g)].map((m) => m[1]))];

// Cada plantilla del tema frente a la original de WooCommerce.
export function compareOverrides(target, core) {
    return listOverrides(target).map((rel) => {
        const source = read(join(target, rel));
        const version = versionOf(source);
        const coreRel = rel.replace(/^woocommerce\//, '');
        const corePath = core ? join(core, coreRel) : null;
        const coreSource = corePath && existsSync(corePath) ? read(corePath) : null;
        const coreVersion = coreSource ? versionOf(coreSource) : null;
        let state;
        if (!version) state = 'sin @version';
        else if (!core) state = 'sin comparar';
        else if (coreSource === null) state = 'sin original';
        else if (!coreVersion) state = 'sin comparar';
        else {
            const c = compareVersions(version, coreVersion);
            state = c === 0 ? 'al día' : c < 0 ? 'desactualizada' : 'más nueva';
        }
        const missingHooks = coreSource ? hooksOf(coreSource).filter((hook) => !new RegExp(`do_action\\(\\s*['"]${hook}['"]`).test(source)) : [];
        return { rel, piece: pieceOf(rel), version, coreVersion, state, markers: markersIn(source), missingHooks, source, coreSource };
    });
}

// Lógica de negocio que no va en el tema (pagos, envíos, pedidos): va en un plugin.
export const BUSINESS_LOGIC = [
    [/extends\s+WC_Payment_Gateway\b/, 'una pasarela de pago'],
    [/extends\s+WC_Shipping_Method\b/, 'un método de envío'],
    [/['"]woocommerce_payment_gateways['"]/, 'el registro de pasarelas de pago'],
    [/['"]woocommerce_shipping_methods['"]/, 'el registro de métodos de envío'],
    [/\bwc_create_order\s*\(/, 'la creación de pedidos'],
    [/['"]woocommerce_(?:new_order|checkout_order_processed|payment_complete|order_status_[\w-]+)['"]/, 'un gancho de pedidos'],
    [/['"]woocommerce_checkout_process['"]/, 'la validación del checkout'],
];

// Ganchos del checkout clásico que no hacen nada con el checkout por bloques.
export const CLASSIC_CHECKOUT_ONLY = /['"]woocommerce_(?:checkout_fields|billing_fields|shipping_fields|before_checkout_form|checkout_before_customer_details)['"]/;
