#!/usr/bin/env node
// Copia templates/ al tema reemplazando {{...}}. Sin dependencias.
//
// Uso:
//   node scaffold.mjs --target <dir> --name <nombre> --author <autor> --uri <url> [--slug <slug>]
//                     [--dry-run] [--overwrite a,b] [--skip c,d]
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar. Nunca escribe nada si sale con código distinto de 0.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, fail, planFiles, prefixFromSlug, renderTemplates, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

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
const slug = slugFromTarget(target, args.slug);

const missing = ['name', 'author', 'uri'].filter((key) => !args[key]?.trim());
if (missing.length) fail(1, `Faltan datos: ${missing.join(', ')}.`, { missing });

for (const key of ['name', 'author', 'uri']) {
    // Van dentro del comentario de cabecera de style.css.
    if (/[\r\n]|\*\//.test(args[key])) fail(1, `"${key}" no puede tener saltos de línea ni "*/".`);
}
if (!/^https?:\/\/\S+$/.test(args.uri)) fail(1, `URI inválida "${args.uri}": debe empezar con http:// o https://.`);

const prefix = prefixFromSlug(slug);
const values = {
    THEME_NAME: args.name.trim(),
    THEME_SLUG: slug,
    PREFIX: prefix,
    PREFIX_UPPER: prefix.toUpperCase(),
    AUTHOR: args.author.trim(),
    THEME_URI: args.uri.trim(),
};

const files = renderTemplates(templatesDir, values, target);
assertNoLeftovers(files);

const plan = planFiles(files, args);
const report = { target, values, create: plan.create, conflicts: plan.conflicts };

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}

assertResolved(plan, report, 'Hay archivos existentes: indica cada uno en --overwrite o --skip.');

const written = writeFiles(files, plan);

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...plan.overwrite],
    skipped: [...plan.skip],
}, null, 2));
