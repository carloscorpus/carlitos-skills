#!/usr/bin/env node
// Auditoría estática de la conexión con WooCommerce hecha por wp-woocommerce. Solo lee; sin dependencias.
//
// Uso (desde la raíz del tema):
//   node check.mjs [--target <dir>] [--specs specs] [--woo <raíz del plugin WooCommerce>] [--php <ruta a php>]
//
// Revisa:
//   - El spec: contenido con Origen woo y la tabla "WooCommerce" completa.
//   - La base (inc/woocommerce/base.php) instalada y cargada desde functions.php; los fragmentos si el mini-carrito
//     es clásico; src/css/woocommerce.css importado si alguna pieza va en bloques, y sin @layer.
//   - Cada plantilla de woocommerce/: sin marcadores `// woo:` sin conectar, con @version, igual a la de la
//     original de WooCommerce si se encuentra (--woo, o wp-content/plugins/woocommerce junto al tema), con todos los
//     do_action() de la original, y sin existir si su pieza va en bloques (WooCommerce la ignora).
//   - Todo el tema: ninguna pasarela, método de envío ni hook de pedidos (eso va en un plugin); los ganchos del
//     checkout clásico con el checkout en bloques son un aviso; salida sin escapar en las plantillas.
//   - Pendientes del spec (filtros de tienda, variaciones) como aviso.
//   - php -l de inc/woocommerce/*.php y de las plantillas, si hay php (en el PATH o con --php).
//
// Sale con JSON en stdout. Códigos: 0 ok (puede haber avisos), 1 error de uso, 4 hay errores.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { detectCssEntry, fail, skillVersion } from './lib/common.mjs';
import {
    BUSINESS_LOGIC, CLASSIC_CHECKOUT_ONLY, ENGINE_BASE, ENGINE_CSS, ENGINE_FRAGMENTS, compareOverrides, findWooCore, hasPageTemplate, needs, readWoo, themePhpFiles,
} from './lib/woo.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            woo: { type: 'string' },
            php: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
if (!existsSync(join(target, 'style.css')) || !existsSync(join(target, 'functions.php'))) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).');

const errors = [];
const warnings = [];
const error = (file, message) => errors.push({ file, message });
const warn = (file, message) => warnings.push({ file, message });
const text = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8').replace(/\r\n/g, '\n') : null);

// ---------- Spec ----------

const spec = readWoo(join(target, args.specs));
if (!spec.specs) fail(1, `Faltan ${args.specs}/_index.md o ${args.specs}/_shared.md: corre primero design-import.`);
if (!spec.contents.length) error('_shared.md', 'Ningún contenido tiene Origen woo: esta skill no hace falta.');
else if (!spec.woo) error('_shared.md', 'Falta la sección "WooCommerce" (clásico o bloques, variaciones, filtros de tienda): se pregunta con design-import.');
else if (spec.missingPieces.length) error('_shared.md', `En la tabla "WooCommerce" falta el modo de: ${spec.missingPieces.join(', ')}.`);
const decided = spec.contents.length > 0 && spec.woo && !spec.missingPieces.length;
const modes = decided ? spec.modes : {};
const need = decided ? needs(modes) : { fragments: false, css: false };

// ---------- Base ----------

const base = text(ENGINE_BASE);
if (decided) {
    if (base === null) error(ENGINE_BASE, 'Falta la base: corre install.mjs.');
    else if (!(text('functions.php') ?? '').includes('inc/woocommerce/base.php')) error('functions.php', 'No carga inc/woocommerce/base.php: corre install.mjs.');
    else {
        const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(base)?.[1] ?? null;
        const available = skillVersion(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
        if (installed !== available) warn(ENGINE_BASE, `Base ${installed ?? 'sin versión'} instalada, la skill trae ${available}: install.mjs --overwrite ${ENGINE_BASE}.`);
    }
    if (need.page && !hasPageTemplate(target)) error('page.php', 'El tema no tiene page.php ni singular.php: el carrito, el checkout y "Mi cuenta" salen vacíos (index.php no imprime el contenido de la página). Corre install.mjs.');
    if (need.fragments && text(ENGINE_FRAGMENTS) === null) error(ENGINE_FRAGMENTS, 'El mini-carrito es clásico y faltan los fragmentos: corre install.mjs.');
    if (need.css) {
        const css = text(ENGINE_CSS);
        const entry = detectCssEntry(target).entry;
        if (css === null) error(ENGINE_CSS, 'Hay piezas en bloques y falta el CSS: corre install.mjs.');
        else {
            const rules = css.replace(/\/\*[\s\S]*?\*\//g, ''); // los comentarios pueden nombrar @layer
            if (/@layer\b/.test(rules)) error(ENGINE_CSS, 'El CSS de los bloques no va dentro de @layer: los estilos de WooCommerce no tienen capa y le ganarían.');
            if (entry && !(text(entry) ?? '').includes('woocommerce.css')) error(entry, 'El CSS principal no importa woocommerce.css: corre install.mjs.');
            if (!entry) warn(ENGINE_CSS, 'No pude saber cuál es el CSS principal de Vite para ver si importa woocommerce.css.');
            if (!rules.includes('{')) warn(ENGINE_CSS, 'El CSS de los bloques todavía no tiene reglas: solo el comentario de la plantilla.');
        }
    }
}

// ---------- Plantillas de woocommerce/ ----------

const core = findWooCore(target, args.woo);
if (args.woo && !core) fail(1, `--woo "${args.woo}" no tiene una carpeta templates/.`);
const overrides = compareOverrides(target, core);
if (!core && overrides.length) warn('woocommerce/', 'No encontré la carpeta templates/ de WooCommerce: no puedo comparar @version ni hooks. Pasa --woo <raíz del plugin>.');
for (const o of overrides) {
    if (o.piece && modes[o.piece] === 'bloques') error(o.rel, `La pieza "${o.piece}" va en bloques y WooCommerce ignora esta plantilla: bórrala o cambia el modo en el spec.`);
    if (o.markers.length) error(o.rel, `Marcadores \`woo:\` sin conectar (${o.markers.length}): ${o.markers.join(', ')}.`);
    if (o.state === 'sin @version') error(o.rel, 'Falta el @version en el comentario del archivo (el de la plantilla original de WooCommerce).');
    if (o.state === 'desactualizada') error(o.rel, `@version ${o.version}, la original trae ${o.coreVersion}: compara el código con la original, incorpora lo nuevo y entonces cambia el @version.`);
    if (o.state === 'más nueva') warn(o.rel, `@version ${o.version} es mayor que el de la original (${o.coreVersion}): ¿se copió de otra versión de WooCommerce?`);
    if (o.state === 'sin original') warn(o.rel, 'WooCommerce no tiene una plantilla con esta ruta: ¿es un archivo propio del tema?');
    for (const hook of o.missingHooks) error(o.rel, `Falta do_action('${hook}'), que sí está en la original: plugins y pasarelas se enganchan ahí.`);
    // Salida sin escapar, salvo las líneas que son idénticas a las de la plantilla original (código de WooCommerce).
    const coreLines = new Set((o.coreSource ?? '').split('\n').map((line) => line.trim()));
    for (const line of o.source.split('\n')) {
        const m = /(?:\becho\s+|<\?=\s*)(\$[\w\->[\]'"]+)\s*;?/.exec(line);
        if (m && !coreLines.has(line.trim())) warn(o.rel, `Salida sin escapar: ${m[0].trim()} (usa esc_html, esc_attr o esc_url).`);
    }
}

// ---------- Todo el tema ----------

const themeFiles = themePhpFiles(target);
for (const rel of themeFiles) {
    const source = text(rel) ?? '';
    for (const [pattern, what] of BUSINESS_LOGIC) {
        if (pattern.test(source)) error(rel, `Hay ${what} en el tema: va en un plugin propio, para que sobreviva a un cambio de tema.`);
    }
    if (modes.checkout === 'bloques' && CLASSIC_CHECKOUT_ONLY.test(source)) {
        warn(rel, 'Gancho del checkout clásico con el checkout en bloques: no tiene efecto. Para campos extra usa la API de campos adicionales de WooCommerce (en un plugin).');
    }
}

// ---------- Pendientes del spec ----------

if (decided && spec.woo.shopFilters === 'sí') warn('_shared.md', 'Filtros de tienda: pendientes. wp-query todavía no acepta Origen woo; el formulario del diseño queda como marcado sin efecto.');
if (decided && spec.woo.variations === 'sí') warn('_shared.md', 'Variaciones: esta versión solo cubre productos simples; las plantillas de productos variables no están conectadas.');

// ---------- php -l ----------

function findPhp() {
    const candidates = args.php ? [args.php] : ['php'];
    return candidates.find((bin) => spawnSync(bin, ['-v'], { encoding: 'utf8' }).status === 0) ?? null;
}
const php = findPhp();
let phpLint = 'no disponible';
if (php) {
    const lintable = themeFiles.filter((rel) => rel.startsWith('inc/woocommerce/') || rel.startsWith('woocommerce/'));
    for (const rel of lintable) {
        const r = spawnSync(php, ['-l', join(target, rel)], { encoding: 'utf8' });
        if (r.status !== 0) error(rel, `php -l: ${(r.stdout + r.stderr).trim().split('\n')[0]}`);
    }
    phpLint = `${lintable.length} archivos`;
} else if (args.php) {
    fail(1, `--php "${args.php}" no se pudo ejecutar.`);
}

console.log(JSON.stringify({
    ok: errors.length === 0,
    modes: decided ? modes : null,
    core: core !== null,
    overrides: overrides.map(({ rel, piece, version, coreVersion, state, markers }) => ({ rel, piece, version, coreVersion, state, markers: markers.length })),
    php: phpLint,
    errors,
    warnings,
}, null, 2));
process.exit(errors.length ? 4 : 0);
