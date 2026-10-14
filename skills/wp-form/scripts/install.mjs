#!/usr/bin/env node
// Instala el motor de forms en un tema creado con wp-vite-theme. Sin dependencias.
//
// Uso:
//   node install.mjs [--target <dir>] [--slug <slug>] [--entries]
//                    [--dry-run] [--overwrite a,b] [--skip c,d]
//
// Copia templates/ reemplazando {{...}}. --entries agrega inc/forms-entries.php
// (envíos guardados en el admin). No toca functions.php ni main.js: eso lo hace el agente.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar. Nunca escribe nada si sale con código distinto de 0.

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

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...overwrite],
    skipped: [...skip],
}, null, 2));
