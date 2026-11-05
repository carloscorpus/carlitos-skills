#!/usr/bin/env node
// Instala la base de WooCommerce de wp-woocommerce en un tema WordPress con Vite. Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node install.mjs [--target <dir>] [--specs specs] [--slug <slug>] [--css-entry <ruta>] [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --check [--target <dir>] [--specs specs] [--css-entry <ruta>]
//
// Lee la tabla "WooCommerce" de specs/_shared.md y copia solo lo que el proyecto necesita:
//   - inc/woocommerce/base.php (siempre): soporte de WooCommerce, sin estilos clásicos ni envoltorios por defecto.
//   - inc/woocommerce/fragments.php (si el mini-carrito es clásico): contador y total que se actualizan solos.
//   - src/css/woocommerce.css (si alguna pieza va en bloques): el CSS de los bloques, importado en el CSS principal
//     de Vite (se detecta en vite.config.*; si hay duda, --css-entry).
// Agrega el require_once a functions.php y mantiene un bloque corto en CLAUDE.md (entre <!-- wp-woocommerce:start -->
// y <!-- wp-woocommerce:end -->). No instala nada si el spec no tiene contenido con Origen woo o falta la tabla
// "WooCommerce": esas decisiones no se infieren (las pregunta design-import).
//
// --check no escribe nada: verifica que lo que el spec necesita esté copiado y conectado.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con conexiones faltantes. Nunca escribe nada si sale con código
// distinto de 0.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, detectCssEntry, ensureRequireLine, fail, findViteConfig, patchFile,
    planFiles, prefixFromSlug, relativeImport, renderString, renderTemplates, skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';
import { ENGINE_BASE, ENGINE_CSS, ENGINE_FRAGMENTS, hasPageTemplate, needs, readWoo } from './lib/woo.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');
const REQUIRE_LINE = "require_once get_theme_file_path('/inc/woocommerce/base.php');";

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            slug: { type: 'string' },
            'css-entry': { type: 'string' },
            check: { type: 'boolean', default: false },
            'dry-run': { type: 'boolean', default: false },
            overwrite: { type: 'string' },
            skip: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const missingBase = ['style.css', 'functions.php'].filter((name) => !existsSync(join(target, name)));
if (!findViteConfig(target) && !args['css-entry']) missingBase.push('vite.config.*');
if (missingBase.length) fail(1, 'No parece un tema WordPress con Vite (ejecuta desde la raíz del tema).', { missing: missingBase });

// Lo que decidió el spec. Sin eso no se instala nada: la skill no infiere clásico o bloques.
const spec = readWoo(join(target, args.specs));
if (!spec.specs) fail(1, `Faltan ${args.specs}/_index.md o ${args.specs}/_shared.md: corre primero design-import.`);
if (!spec.contents.length) fail(1, 'El spec no tiene contenido con Origen woo: esta skill no hace falta (un catálogo con WhatsApp o formulario es wp-acf + wp-query).');
if (!spec.woo) fail(1, 'Falta la sección "WooCommerce" de _shared.md (carrito, checkout, mini-carrito y cuenta: clásico o bloques; variaciones; filtros de tienda). Se pregunta al usuario con design-import; no se infiere.');
if (spec.missingPieces.length) fail(1, `En la tabla "WooCommerce" falta el modo de: ${spec.missingPieces.join(', ')} (clásico, bloques o no aplica).`);
const need = needs(spec.modes);

// CSS principal de Vite: lo que se pasa con --css-entry, o lo que se detecta en vite.config.*. Solo si hace falta.
function resolveCssEntry() {
    if (!need.css) return null;
    if (args['css-entry']) {
        const rel = posix.normalize(args['css-entry'].replaceAll('\\', '/'));
        const path = join(target, rel);
        if (isAbsolute(args['css-entry']) || rel.startsWith('..') || !existsSync(path) || !statSync(path).isFile()) {
            fail(1, `--css-entry "${args['css-entry']}" no es un archivo dentro del tema.`);
        }
        return rel;
    }
    const detected = detectCssEntry(target);
    if (!detected.entry) {
        fail(1, 'No pude saber cuál es el CSS principal de Vite. Pregunta la ruta al usuario y pásala con --css-entry <ruta>.', { candidates: detected.candidates });
    }
    return detected.entry;
}

const cssEntry = resolveCssEntry();
const version = skillVersion(skillDir);
const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');
const IMPORT_LINE = cssEntry ? `@import "${relativeImport(cssEntry, ENGINE_CSS)}";` : null;

// page.php solo se crea si el tema no tiene plantilla de página; después es del proyecto y no se vuelve a tocar.
const wanted = (rel) => rel === ENGINE_BASE || (rel === ENGINE_FRAGMENTS && need.fragments) || (rel === ENGINE_CSS && need.css)
    || (rel === 'page.php' && need.page && !hasPageTemplate(target));
const wiringState = () => ({
    page: need.page ? hasPageTemplate(target) : true,
    base: existsSync(join(target, ENGINE_BASE)),
    functions: read('functions.php').includes('inc/woocommerce/base.php'),
    fragments: need.fragments ? existsSync(join(target, ENGINE_FRAGMENTS)) : true,
    css: need.css ? existsSync(join(target, ENGINE_CSS)) : true,
    cssImported: need.css ? read(cssEntry).includes('woocommerce.css') : true,
});

if (args.check) {
    const wiring = wiringState();
    const missing = Object.entries(wiring).filter(([, ok]) => !ok).map(([key]) => key);
    const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read(ENGINE_BASE))?.[1] ?? null;
    const hints = [];
    if (missing.length) hints.push('Corre install.mjs sin --check: copia lo que el spec necesita y lo conecta en functions.php y el CSS principal.');
    if (wiring.base && installed !== version) hints.push(`Base ${installed ?? 'sin versión'} instalada, la skill trae ${version}: corre install.mjs --dry-run y luego --overwrite ${ENGINE_BASE}${need.fragments ? `,${ENGINE_FRAGMENTS}` : ''}.`);
    console.log(JSON.stringify({ ok: missing.length === 0, check: true, modes: spec.modes, needs: need, cssEntry, version: { installed, available: version }, wiring, missing, hints }, null, 2));
    process.exit(missing.length ? 4 : 0);
}

const slug = slugFromTarget(target, args.slug);
const values = { SLUG: slug, PREFIX: prefixFromSlug(slug), ENGINE_VERSION: version };

const files = renderTemplates(templatesDir, values, target, (file) => wanted(file.rel));
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block (wp-woocommerce)', content: claudeText }]);
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-woocommerce', claudeText);

const plan = planFiles(files, args, { skipIdentical: true });
const state = wiringState();
const report = {
    target,
    modes: spec.modes,
    needs: need,
    cssEntry,
    values,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    wire: [...(state.functions ? [] : ['functions.php']), ...(state.cssImported ? [] : [cssEntry])],
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, `Hay archivos existentes distintos: indica cada uno en --overwrite o --skip (${ENGINE_BASE} y ${ENGINE_FRAGMENTS} son genéricos: se actualizan con --overwrite; ${ENGINE_CSS} lo escribe el proyecto: no se pisa sin preguntar).`);

const written = writeFiles(files, plan);
const wired = [];
if (ensureRequireLine(join(target, 'functions.php'), REQUIRE_LINE)) wired.push('functions.php');
if (!state.cssImported) {
    // Un @import de CSS va antes de cualquier otra regla: después del último @import que ya tenga el archivo.
    patchFile(join(target, cssEntry), (text) => {
        const imports = [...text.matchAll(/^@import\b[^\n]*$/gm)];
        const last = imports.at(-1);
        return last ? text.slice(0, last.index + last[0].length) + `\n${IMPORT_LINE}` + text.slice(last.index + last[0].length) : `${IMPORT_LINE}\n${text}`;
    });
    wired.push(cssEntry);
}
claude.write();
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip], wired }, null, 2));
process.exit(0);
