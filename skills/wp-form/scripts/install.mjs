#!/usr/bin/env node
// Instala el motor de forms en un tema creado con wp-vite-theme. Sin dependencias.
//
// Uso:
//   node install.mjs [--target <dir>] [--slug <slug>] [--entries]
//                    [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --check [--target <dir>]
//
// Copia templates/ reemplazando {{...}}. --entries agrega inc/forms-entries.php
// (envíos guardados en el admin). Después conecta el motor al tema, sin duplicar nada si
// se vuelve a correr: agrega el require_once en functions.php y el import() en main.js.
// No instala zod ni ejecuta pnpm: eso lo hace el agente (ver SKILL.md, paso 4).
//
// --check no escribe nada: verifica que el motor esté completo y conectado (archivos,
// functions.php, main.js, zod en package.json y en node_modules).
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con conexiones faltantes.
// Nunca escribe nada si sale con código distinto de 0.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const ENTRIES_FILE = 'inc/forms-entries.php';

function fail(code, error, extra = {}) {
    console.log(JSON.stringify({ ok: false, error, ...extra }, null, 2));
    process.exit(code);
}

function listFiles(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}

function toList(value) {
    return (value ?? '').split(',').map((s) => s.trim().replaceAll('\\', '/')).filter(Boolean);
}

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
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
const slug = args.slug ?? basename(target);

// Debe empezar con letra: el prefijo PHP sale del slug y una función no puede empezar con número.
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug)) {
    fail(1, `Slug inválido "${slug}": usa minúsculas, números y guiones, y empieza con una letra.`);
}

const missingBase = ['style.css', 'functions.php', 'inc/enqueue.php', 'src/js/main.js']
    .filter((rel) => !existsSync(join(target, rel)));
if (missingBase.length) {
    fail(1, 'No parece un tema creado con wp-vite-theme (ejecuta desde la raíz del tema).', { missing: missingBase });
}

const REQUIRE_LINE = "require_once get_theme_file_path('/inc/forms.php');";
const IMPORT_BLOCK = [
    "if (document.querySelector('form[data-form]')) {",
    "    import('./modules/form.js').then(({ initForms }) => initForms()).catch(console.error);",
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
        engine: existsSync(join(target, 'inc/forms.php')) && existsSync(join(target, 'src/js/modules/form.js')),
        functions: read('functions.php').includes('inc/forms.php'),
        main: read('src/js/main.js').includes('modules/form.js'),
        zod: Boolean(pkg.dependencies?.zod || pkg.devDependencies?.zod),
        node_modules_zod: existsSync(join(target, 'node_modules/zod')),
    };
}

if (args.check) {
    const wiring = wiringState();
    const missing = Object.entries(wiring).filter(([, ok]) => !ok).map(([key]) => key);
    const hints = [];
    if (!wiring.engine) hints.push('Corre install.mjs sin --check para copiar el motor.');
    if (!wiring.functions || !wiring.main) hints.push('Corre install.mjs (sin --check): conecta functions.php y main.js.');
    if (!wiring.zod || !wiring.node_modules_zod) hints.push('pnpm view zod dist-tags && pnpm add zod@latest');
    console.log(JSON.stringify({ ok: missing.length === 0, check: true, wiring, missing, hints }, null, 2));
    process.exit(missing.length ? 4 : 0);
}

const prefix = slug.replaceAll('-', '_');
// WordPress limita el post type a 20 caracteres.
const entryType = `${prefix.slice(0, 14).replace(/_+$/, '')}_envio`;

const values = {
    THEME_SLUG: slug,
    PREFIX: prefix,
    PREFIX_UPPER: prefix.toUpperCase(),
    ENTRY_TYPE: entryType,
};

const files = listFiles(templatesDir)
    .map((source) => {
        const rel = relative(templatesDir, source).split(sep).join('/').replace(/\.tpl$/, '');
        let content = readFileSync(source, 'utf8');
        if (source.endsWith('.tpl')) {
            content = content.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => values[key] ?? match);
        }
        return { rel, dest: join(target, rel), content };
    })
    .filter((file) => args.entries || file.rel !== ENTRIES_FILE);

const leftovers = files.filter((f) => /\{\{[A-Z_]+\}\}/.test(f.content)).map((f) => f.rel);
if (leftovers.length) fail(3, 'Quedaron placeholders sin reemplazar.', { leftovers });

const overwrite = new Set(toList(args.overwrite));
const skip = new Set(toList(args.skip));
// Un archivo idéntico al que se instalaría no es conflicto.
const existing = files.filter((f) => existsSync(f.dest));
const unchanged = existing.filter((f) => readFileSync(f.dest, 'utf8') === f.content).map((f) => f.rel);
const conflicts = existing.map((f) => f.rel).filter((rel) => !unchanged.includes(rel));
const unknown = [...overwrite, ...skip].filter((rel) => !conflicts.includes(rel));
const unresolved = conflicts.filter((rel) => !overwrite.has(rel) && !skip.has(rel));

const report = {
    target,
    values,
    create: files.filter((f) => !existsSync(f.dest)).map((f) => f.rel),
    unchanged,
    conflicts,
    wire: [
        ...(wiringState().functions ? [] : ['functions.php']),
        ...(wiringState().main ? [] : ['src/js/main.js']),
    ],
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}

if (unknown.length) fail(1, 'Archivos en --overwrite/--skip que no son conflictos.', { unknown });
if (unresolved.length) {
    fail(2, 'Hay archivos existentes distintos: indica cada uno en --overwrite o --skip.', { ...report, unresolved });
}

const written = [];
for (const file of files) {
    if (skip.has(file.rel) || unchanged.includes(file.rel)) continue;
    mkdirSync(dirname(file.dest), { recursive: true });
    writeFileSync(file.dest, file.content);
    written.push(file.rel);
}
for (const dir of ['inc/forms', 'template-parts/forms']) {
    mkdirSync(join(target, dir), { recursive: true });
}

// Conexión idempotente: solo agrega lo que falta y respeta el salto de línea del archivo.
function patch(rel, update) {
    const path = join(target, rel);
    const original = readFileSync(path, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const next = update(original.replace(/\r\n/g, '\n')).replace(/\n/g, eol);
    writeFileSync(path, next);
}

const wired = [];
if (!wiringState().functions) {
    patch('functions.php', (text) => {
        const lines = text.split('\n');
        const last = lines.findLastIndex((line) => /^\s*require(_once)?\b/.test(line));
        if (last === -1) return text.replace(/\n*$/, '\n') + REQUIRE_LINE + '\n';
        lines.splice(last + 1, 0, REQUIRE_LINE);
        return lines.join('\n');
    });
    wired.push('functions.php');
}
if (!wiringState().main) {
    patch('src/js/main.js', (text) => text.replace(/\n*$/, '\n\n') + IMPORT_BLOCK.join('\n') + '\n');
    wired.push('src/js/main.js');
}

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...overwrite],
    skipped: [...skip],
    wired,
    next: wiringState().node_modules_zod ? [] : ['pnpm view zod dist-tags && pnpm add zod@latest'],
}, null, 2));
