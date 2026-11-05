#!/usr/bin/env node
// Dice en una sola lectura qué de wp-woocommerce ya está hecho en el tema, para no explorarlo a mano. Solo lee.
//
// Uso (desde la raíz del tema):
//   node status.mjs [--target <dir>] [--specs specs] [--woo <raíz del plugin WooCommerce>]
//
// Informa: las decisiones del spec (modo de cada pieza, variaciones, filtros de tienda), si la base está
// instalada y al día, cada plantilla de woocommerce/ (su pieza, @version frente a la original, marcadores
// `// woo:` sin conectar) y lo pendiente. `next` lista lo que falta, en orden.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { detectCssEntry, fail, skillVersion } from './lib/common.mjs';
import { detectTheme } from './lib/tema.mjs';
import { ENGINE_BASE, ENGINE_CSS, ENGINE_FRAGMENTS, compareOverrides, findWooCore, hasWpQuery, needs, readWoo } from './lib/woo.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            woo: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const theme = detectTheme(target);
if (!theme.isTheme) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).');

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = skillVersion(skillDir);
const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');
const next = [];

const spec = readWoo(join(target, args.specs));
if (!spec.specs) {
    next.push('No hay specs: design-import primero');
} else if (!spec.contents.length) {
    next.push('El spec no tiene contenido con Origen woo: esta skill no hace falta');
} else if (!spec.woo) {
    next.push('Falta la sección "WooCommerce" de _shared.md (clásico o bloques, variaciones, filtros de tienda): se pregunta con design-import');
} else if (spec.missingPieces.length) {
    next.push(`En la tabla "WooCommerce" falta el modo de: ${spec.missingPieces.join(', ')}`);
}
const decided = spec.specs && spec.contents.length > 0 && spec.woo && !spec.missingPieces.length;
const need = decided ? needs(spec.modes) : null;

const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read(ENGINE_BASE))?.[1] ?? null;
const cssEntry = need?.css ? detectCssEntry(target).entry : null;
const engine = {
    base: installed !== null,
    version: installed,
    requireLine: read('functions.php').includes('inc/woocommerce/base.php'),
    fragments: existsSync(join(target, ENGINE_FRAGMENTS)),
    css: existsSync(join(target, ENGINE_CSS)),
    cssImported: cssEntry ? read(cssEntry).includes('woocommerce.css') : null,
    upToDate: installed === skill,
};

const core = findWooCore(target, args.woo);
const overrides = compareOverrides(target, core).map(({ source, ...rest }) => ({ ...rest, markers: rest.markers.length ? rest.markers : [] }));

if (decided) {
    if (!engine.base || !engine.requireLine || (need.fragments && !engine.fragments) || (need.css && (!engine.css || engine.cssImported === false))) next.push('Instalar la base: install.mjs');
    else if (!engine.upToDate) next.push(`Actualizar la base (instalada ${installed ?? 'sin versión'}, skill ${skill}): install.mjs --overwrite ${ENGINE_BASE}${need.fragments ? `,${ENGINE_FRAGMENTS}` : ''}`);

    const classic = overrides.filter((o) => o.piece === null || spec.modes[o.piece] === 'clásico');
    const withMarkers = classic.filter((o) => o.markers.length);
    if (withMarkers.length) next.push(`Conectar las plantillas (marcadores \`// woo:\`): ${withMarkers.map((o) => `${o.rel} (${o.markers.length})`).join(', ')}`);
    const wrongMode = overrides.filter((o) => o.piece && spec.modes[o.piece] === 'bloques');
    if (wrongMode.length) next.push(`Plantillas de una pieza en bloques (WooCommerce las ignora): ${wrongMode.map((o) => o.rel).join(', ')}`);
    const versions = overrides.filter((o) => ['sin @version', 'desactualizada'].includes(o.state));
    if (versions.length) next.push(`Revisar contra la original y poner el @version: ${versions.map((o) => `${o.rel} (${o.state})`).join(', ')}`);
    if (need.css && spec.pages.length) next.push('Escribir el CSS de los bloques en src/css/woocommerce.css (references/estilos-y-modos.md)');
    if (spec.woo.shopFilters === 'sí' && !hasWpQuery(target)) next.push('Filtros de tienda: sí, y wp-query no está instalada en el tema: corre wp-query (install.mjs, generate.mjs y conectar la plantilla de la tienda)');
    if (spec.woo.variations === 'sí') next.push('Variaciones: pendientes (esta versión solo cubre productos simples)');
    if (!core) next.push('Sin la carpeta templates/ de WooCommerce para comparar versiones y hooks: pasa --woo <raíz del plugin> o corre desde wp-content/themes/<tema>');
}
if (!next.length) next.push('Nada que hacer: correr check.mjs');

console.log(JSON.stringify({
    ok: true,
    target,
    skill,
    prefix: theme.prefix,
    specs: spec.specs ? { contents: spec.contents, modes: decided ? spec.modes : null, variations: spec.woo?.variations ?? null, shopFilters: spec.woo?.shopFilters ?? null, pages: spec.pages } : null,
    engine,
    core: core !== null,
    overrides,
    next,
}, null, 2));
