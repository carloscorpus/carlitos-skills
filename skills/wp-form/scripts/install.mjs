#!/usr/bin/env node
// Instala el motor de forms en un tema WordPress con Vite. Sin dependencias.
//
// Uso:
//   node install.mjs [--target <dir>] [--slug <slug>] [--entry <ruta>] [--entries]
//                    [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --check [--target <dir>] [--entry <ruta>]
//
// Requisitos del tema: style.css, functions.php y vite.config.*. No exige que venga de
// wp-vite-theme. El JS principal que empaqueta Vite se detecta leyendo vite.config.*; si hay
// duda, se pasa con --entry (ruta relativa a la raíz del tema).
//
// Copia templates/ reemplazando {{...}}. --entries agrega inc/forms-entries.php
// (envíos guardados en el admin). Después conecta el motor al tema, sin duplicar nada si
// se vuelve a correr: agrega el require_once en functions.php y el import() en el JS principal.
// Si el tema tiene CLAUDE.md, agrega (o actualiza) un bloque corto de la skill entre marcas
// <!-- wp-form:start --> / <!-- wp-form:end -->; no crea el archivo ni toca el resto.
// No instala zod ni ejecuta pnpm: eso lo hace el agente (ver SKILL.md, paso 4).
//
// --check no escribe nada: verifica que el motor esté completo y conectado (archivos,
// functions.php, JS principal, zod en package.json y en node_modules) e informa la versión
// del motor instalada frente a la de la skill.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con conexiones faltantes.
// Nunca escribe nada si sale con código distinto de 0.

import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, detectJsEntry, fail, findViteConfig, patchFile, planFiles,
    prefixFromSlug, relativeImport, renderString, renderTemplates, skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');
const ENTRIES_FILE = 'inc/forms-entries.php';
const ENGINE_JS = 'src/js/modules/form.js';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
            entry: { type: 'string' },
            entries: { type: 'boolean', default: false },
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
const slug = slugFromTarget(target, args.slug);

const missingBase = ['style.css', 'functions.php'].filter((rel) => !existsSync(join(target, rel)));
if (!findViteConfig(target)) missingBase.push('vite.config.*');
if (missingBase.length) {
    fail(1, 'No parece un tema WordPress con Vite (ejecuta desde la raíz del tema).', { missing: missingBase });
}

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
        fail(1, 'No pude saber cuál es el JS principal de Vite. Pregunta la ruta al usuario y pásala con --entry <ruta>.', {
            candidates: detected.candidates,
        });
    }
    return detected.entry;
}

const entry = resolveEntry();
const version = skillVersion(skillDir);

const REQUIRE_LINE = "require_once get_theme_file_path('/inc/forms.php');";
const IMPORT_BLOCK = [
    "if (document.querySelector('form[data-form]')) {",
    `    import('${relativeImport(entry, ENGINE_JS)}').then(({ initForms }) => initForms()).catch(console.error);`,
    '}',
];

const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');

// Estado de la conexión del motor en el tema.
function wiringState() {
    let pkg = {};
    try {
        pkg = JSON.parse(read('package.json') || '{}');
    } catch {
        // package.json ilegible: se reporta como zod faltante.
    }

    return {
        engine: existsSync(join(target, 'inc/forms.php')) && existsSync(join(target, ENGINE_JS)),
        functions: read('functions.php').includes('inc/forms.php'),
        main: read(entry).includes('modules/form.js'),
        zod: Boolean(pkg.dependencies?.zod || pkg.devDependencies?.zod),
        node_modules_zod: existsSync(join(target, 'node_modules/zod')),
    };
}

if (args.check) {
    const wiring = wiringState();
    const missing = Object.entries(wiring).filter(([, ok]) => !ok).map(([key]) => key);
    const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read('inc/forms.php'))?.[1] ?? null;
    const hints = [];
    if (!wiring.engine) hints.push('Corre install.mjs sin --check para copiar el motor.');
    if (!wiring.functions || !wiring.main) hints.push(`Corre install.mjs (sin --check): conecta functions.php y ${entry}.`);
    if (!wiring.zod || !wiring.node_modules_zod) hints.push('pnpm view zod dist-tags && pnpm add zod@latest');
    if (wiring.engine && installed !== version) {
        hints.push(`Motor ${installed ?? 'sin versión'} instalado, la skill trae ${version}: corre install.mjs --dry-run y revisa los conflictos antes de --overwrite.`);
    }
    console.log(JSON.stringify({
        ok: missing.length === 0,
        check: true,
        entry,
        engineVersion: { installed, available: version },
        wiring,
        missing,
        hints,
    }, null, 2));
    process.exit(missing.length ? 4 : 0);
}

const prefix = prefixFromSlug(slug);
// WordPress limita el post type a 20 caracteres.
const entryType = `${prefix.slice(0, 14).replace(/_+$/, '')}_envio`;

const values = {
    THEME_SLUG: slug,
    PREFIX: prefix,
    PREFIX_UPPER: prefix.toUpperCase(),
    ENTRY_TYPE: entryType,
    ENGINE_VERSION: version,
};

const files = renderTemplates(templatesDir, values, target, (file) => args.entries || file.rel !== ENTRIES_FILE);
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block.md.tpl', content: claudeText }]);

// Bloque corto de la skill en CLAUDE.md del tema (si el tema tiene uno).
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-form', claudeText);

// Un archivo idéntico al que se instalaría no es conflicto.
const plan = planFiles(files, args, { skipIdentical: true });

const state = wiringState();
const report = {
    target,
    entry,
    values,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    wire: [
        ...(state.functions ? [] : ['functions.php']),
        ...(state.main ? [] : [entry]),
    ],
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}

assertResolved(plan, report, 'Hay archivos existentes distintos: indica cada uno en --overwrite o --skip.');

const written = writeFiles(files, plan);
for (const dir of ['inc/forms', 'template-parts/forms']) {
    mkdirSync(join(target, dir), { recursive: true });
}

// Conexión idempotente: solo agrega lo que falta.
const wired = [];
if (!state.functions) {
    patchFile(join(target, 'functions.php'), (text) => {
        const lines = text.split('\n');
        const last = lines.findLastIndex((line) => /^\s*require(_once)?\b/.test(line));
        if (last === -1) return text.replace(/\n*$/, '\n') + REQUIRE_LINE + '\n';
        lines.splice(last + 1, 0, REQUIRE_LINE);
        return lines.join('\n');
    });
    wired.push('functions.php');
}
if (!state.main) {
    patchFile(join(target, entry), (text) => text.replace(/\n*$/, '\n\n') + IMPORT_BLOCK.join('\n') + '\n');
    wired.push(entry);
}
claude.write();

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...plan.overwrite],
    skipped: [...plan.skip],
    wired,
    next: wiringState().node_modules_zod ? [] : ['pnpm view zod dist-tags && pnpm add zod@latest'],
}, null, 2));
