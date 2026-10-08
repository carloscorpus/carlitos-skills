#!/usr/bin/env node
// Copia templates/ al tema reemplazando {{...}}. Sin dependencias.
//
// Uso:
//   node scaffold.mjs --target <dir> --name <nombre> --author <autor> --uri <url> [--slug <slug>]
//                     [--dry-run] [--overwrite a,b] [--skip c,d]
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar. Nunca escribe nada si sale con código distinto de 0.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

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
            name: { type: 'string' },
            author: { type: 'string' },
            uri: { type: 'string' },
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

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fail(1, `Slug inválido "${slug}": usa minúsculas, números y guiones.`);
}

const missing = ['name', 'author', 'uri'].filter((key) => !args[key]?.trim());
if (missing.length) fail(1, `Faltan datos: ${missing.join(', ')}.`, { missing });

for (const key of ['name', 'author', 'uri']) {
    // Van dentro del comentario de cabecera de style.css.
    if (/[\r\n]|\*\//.test(args[key])) fail(1, `"${key}" no puede tener saltos de línea ni "*/".`);
}
if (!/^https?:\/\/\S+$/.test(args.uri)) fail(1, `URI inválida "${args.uri}": debe empezar con http:// o https://.`);

const prefix = slug.replaceAll('-', '_');
const values = {
    THEME_NAME: args.name.trim(),
    THEME_SLUG: slug,
    PREFIX: prefix,
    PREFIX_UPPER: prefix.toUpperCase(),
    AUTHOR: args.author.trim(),
    THEME_URI: args.uri.trim(),
};

// Render en memoria: nada se escribe hasta validar todo.
const files = listFiles(templatesDir).map((source) => {
    const rel = relative(templatesDir, source).split(sep).join('/').replace(/\.tpl$/, '');
    let content = readFileSync(source, 'utf8');
    if (source.endsWith('.tpl')) {
        content = content.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => values[key] ?? match);
    }
    return { rel, dest: join(target, rel), content };
});

const leftovers = files.filter((f) => f.content.includes('{{')).map((f) => f.rel);
if (leftovers.length) fail(3, 'Quedaron placeholders sin reemplazar.', { leftovers });

const overwrite = new Set(toList(args.overwrite));
const skip = new Set(toList(args.skip));
const conflicts = files.filter((f) => existsSync(f.dest)).map((f) => f.rel);
const unknown = [...overwrite, ...skip].filter((rel) => !conflicts.includes(rel));
const unresolved = conflicts.filter((rel) => !overwrite.has(rel) && !skip.has(rel));

const report = {
    target,
    values,
    create: files.filter((f) => !conflicts.includes(f.rel)).map((f) => f.rel),
    conflicts,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}

if (unknown.length) fail(1, 'Archivos en --overwrite/--skip que no son conflictos.', { unknown });
if (unresolved.length) {
    fail(2, 'Hay archivos existentes: indica cada uno en --overwrite o --skip.', { ...report, unresolved });
}

const written = [];
for (const file of files) {
    if (skip.has(file.rel)) continue;
    mkdirSync(dirname(file.dest), { recursive: true });
    writeFileSync(file.dest, file.content);
    written.push(file.rel);
}

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...overwrite],
    skipped: [...skip],
}, null, 2));
