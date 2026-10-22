#!/usr/bin/env node
// Instala el motor de wp-query en un tema WordPress con Vite. Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node install.mjs [--target <dir>] [--slug <slug>] [--entry <ruta>] [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --check [--target <dir>] [--entry <ruta>]
//
// Copia inc/query/motor.php (genérico: consulta principal, filtros, conteos, paginación, relacionados, SEO y la
// respuesta parcial de los listados) y src/js/modules/query.js (filtrar sin recargar), agrega el require_once a
// functions.php, el import() al JS principal de Vite (se detecta en vite.config.*; si hay duda, --entry) y mantiene
// un bloque corto en CLAUDE.md (entre <!-- wp-query:start --> y <!-- wp-query:end -->). Las funciones llevan el
// prefijo del tema. Las definiciones de cada listado (inc/query/<contenido>.php) las escribe generate.mjs.
//
// --check no escribe nada: verifica que el motor esté copiado y conectado (functions.php y el JS principal), e
// informa la versión instalada frente a la de la skill.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con conexiones faltantes. Nunca escribe nada si sale con código
// distinto de 0.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, detectJsEntry, ensureRequireLine, fail, findViteConfig, patchFile,
    planFiles, prefixFromSlug, relativeImport, renderString, renderTemplates, skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');
const ENGINE = 'inc/query/motor.php';
const ENGINE_JS = 'src/js/modules/query.js';
const REQUIRE_LINE = "require_once get_theme_file_path('/inc/query/motor.php');";

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
            entry: { type: 'string' },
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
if (!findViteConfig(target) && !args.entry) missingBase.push('vite.config.*');
if (missingBase.length) fail(1, 'No parece un tema WordPress con Vite (ejecuta desde la raíz del tema).', { missing: missingBase });

// JS principal de Vite: lo que se pasa con --entry, o lo que se detecta en vite.config.*.
function resolveEntry() {
    if (args.entry) {
        const rel = posix.normalize(args.entry.replaceAll('\\', '/'));
        const path = join(target, rel);
        if (isAbsolute(args.entry) || rel.startsWith('..') || !existsSync(path) || !statSync(path).isFile()) {
            fail(1, `--entry "${args.entry}" no es un archivo dentro del tema.`);
        }
        return rel;
    }
    const detected = detectJsEntry(target);
    if (!detected.entry) {
        fail(1, 'No pude saber cuál es el JS principal de Vite. Pregunta la ruta al usuario y pásala con --entry <ruta>.', { candidates: detected.candidates });
    }
    return detected.entry;
}

const entry = resolveEntry();
const version = skillVersion(skillDir);
const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');
const IMPORT_BLOCK = [
    "if (document.querySelector('[data-query=\"resultados\"]')) {",
    `    import('${relativeImport(entry, ENGINE_JS)}').then(({ initQuery }) => initQuery()).catch(console.error);`,
    '}',
];

const wiringState = () => ({
    engine: existsSync(join(target, ENGINE)) && existsSync(join(target, ENGINE_JS)),
    functions: read('functions.php').includes('inc/query/motor.php'),
    main: read(entry).includes('modules/query.js'),
});

if (args.check) {
    const wiring = wiringState();
    const missing = Object.entries(wiring).filter(([, ok]) => !ok).map(([key]) => key);
    const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read(ENGINE))?.[1] ?? null;
    const installedJs = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read(ENGINE_JS))?.[1] ?? null;
    const hints = [];
    if (missing.length) hints.push(`Corre install.mjs sin --check: copia el motor y lo conecta en functions.php y ${entry}.`);
    if (wiring.engine && (installed !== version || installedJs !== version)) {
        hints.push(`Motor ${installed ?? 'sin versión'} (JS ${installedJs ?? 'sin versión'}) instalado, la skill trae ${version}: corre install.mjs --dry-run y luego --overwrite ${ENGINE},${ENGINE_JS}.`);
    }
    console.log(JSON.stringify({ ok: missing.length === 0, check: true, entry, engineVersion: { installed, js: installedJs, available: version }, wiring, missing, hints }, null, 2));
    process.exit(missing.length ? 4 : 0);
}

const slug = slugFromTarget(target, args.slug);
const values = { SLUG: slug, PREFIX: prefixFromSlug(slug), ENGINE_VERSION: version };

const files = renderTemplates(templatesDir, values, target);
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block (wp-query)', content: claudeText }]);
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-query', claudeText);

const plan = planFiles(files, args, { skipIdentical: true });
const state = wiringState();
const report = {
    target,
    entry,
    values,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    wire: [...(state.functions ? [] : ['functions.php']), ...(state.main ? [] : [entry])],
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, `Hay archivos existentes distintos: indica cada uno en --overwrite o --skip (${ENGINE} y ${ENGINE_JS} son el motor: se actualizan con --overwrite).`);

const written = writeFiles(files, plan);
const wired = [];
if (ensureRequireLine(join(target, 'functions.php'), REQUIRE_LINE)) wired.push('functions.php');
if (!state.main) {
    patchFile(join(target, entry), (text) => text.replace(/\n*$/, '\n\n') + IMPORT_BLOCK.join('\n') + '\n');
    wired.push(entry);
}
claude.write();
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip], wired }, null, 2));
process.exit(0);
