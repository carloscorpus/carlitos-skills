#!/usr/bin/env node
// Genera el ACF JSON del tema (acf-json/) a partir de los specs de design-import. Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node generate.mjs [--target <dir>] [--specs specs] [--out acf-json] [--page home,opciones]
//                     [--states aplicado] [--dry-run] [--overwrite a,b] [--skip a,b]
//
// Escribe un `group_*.json` por página (cada sección es un campo group), `post_type_*.json` y
// `taxonomy_*.json` de los contenidos propios de la tabla "Contenido dinámico" de _shared.md, y un
// `ui_options_page_*.json` por cada página de opciones nombrada en una Ubicación. Las claves salen del
// nombre: regenerar no las cambia. `modified` solo cambia si el contenido cambió (así ACF ofrece "Sync").
//
// Por defecto solo toma las páginas con Estado `aplicado`. Un archivo que ya existe y es distinto (por
// ejemplo, guardado desde el admin) es un conflicto: se pregunta con --overwrite / --skip.
//
// Salida JSON en stdout. Códigos: 0 ok, 1 entrada inválida, 2 conflictos sin resolver, 4 errores en los specs.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { assertResolved, fail, planFiles, toList, writeFiles } from './lib/common.mjs';
import { buildAll } from './lib/acf-build.mjs';
import { hasSpecs, loadSpecs, read } from './lib/specs.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            out: { type: 'string', default: 'acf-json' },
            page: { type: 'string' },
            states: { type: 'string', default: 'aplicado' },
            'dry-run': { type: 'boolean', default: false },
            overwrite: { type: 'string' },
            skip: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const specsDir = join(target, args.specs);
const missingBase = ['style.css', 'functions.php'].filter((name) => !existsSync(join(target, name)));
if (missingBase.length) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).', { missing: missingBase });
if (!hasSpecs(specsDir)) fail(1, `Faltan ${args.specs}/_index.md o ${args.specs}/_shared.md: corre primero design-import.`);

const states = toList(args.states);
const wanted = args.page === undefined ? null : toList(args.page);
const { index, dynamic, files: pageFiles, all, pages } = loadSpecs(specsDir, { states, wanted });
if (wanted) {
    const unknown = wanted.filter((slug) => !pageFiles.includes(`${slug}.md`));
    if (unknown.length) fail(1, 'Páginas que no existen en specs/.', { unknown });
}

if (!pages.length) fail(1, `Ninguna página con estado ${states.join(' o ')}${wanted ? ` entre ${wanted.join(', ')}` : ''}.`, { hint: 'Usa --states aprobado,aplicado para adelantarte o --page <slug>.' });

const built = buildAll({ pages, dynamic });
if (built.errors.length) {
    console.log(JSON.stringify({ ok: false, error: 'Los specs tienen errores que impiden generar el JSON.', errors: built.errors }, null, 2));
    process.exit(4);
}

// ---------- Archivos ----------

const outDir = join(target, args.out);
const withoutModified = ({ modified, ...rest }) => JSON.stringify(rest);

function fileFor(json) {
    const rel = `${args.out}/${json.key}.json`;
    const dest = join(target, rel);
    let modified = Math.floor(Date.now() / 1000);
    if (existsSync(dest)) {
        try {
            const current = JSON.parse(read(dest));
            if (withoutModified(current) === withoutModified(json)) modified = current.modified ?? modified;
        } catch (e) {
            if (!(e instanceof SyntaxError)) throw e; // un JSON roto cuenta como conflicto
        }
    }
    return { rel, dest, content: `${JSON.stringify({ ...json, modified }, null, 4)}\n` };
}

const entries = [
    ...built.groups.map((item) => ({ kind: 'group', name: item.page, json: item.json })),
    ...built.postTypes.map((item) => ({ kind: 'post_type', name: item.content, json: item.json })),
    ...built.taxonomies.map((item) => ({ kind: 'taxonomy', name: item.taxonomy, json: item.json })),
    ...built.optionsPages.map((item) => ({ kind: 'options_page', name: item.slug, json: item.json })),
];
const files = entries.map((entry) => ({ ...fileFor(entry.json), kind: entry.kind, name: entry.name }));

// inc/acf/paginas.php: las páginas de WordPress que crea el motor. Sale de todas las páginas estáticas con
// el estado pedido (no solo de --page), así una corrida parcial no recorta la lista.
const phpString = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const wpPages = all
    .filter((page) => states.includes(page.labels.Estado))
    .filter((page) => (page.labels.Tipo ?? 'estática').replace('estatica', 'estática') === 'estática');
const pagesPhp = [
    '<?php',
    "defined('ABSPATH') || exit;",
    '',
    '/*',
    ' * Páginas de WordPress que crea inc/acf/runner.php. Lo genera wp-acf (generate.mjs) desde specs/_index.md:',
    ' * no se edita a mano.',
    ' */',
    'return [',
    ...wpPages.map((page) => {
        const row = index.find((r) => r.file === page.file);
        const template = (row?.template || page.labels.Plantilla || '').replace(/`/g, '');
        const front = template === 'front-page.php';
        const slug = front ? 'inicio' : page.slug;
        return `    ${phpString(page.slug)} => ['titulo' => ${phpString(row?.title ?? page.slug)}, 'slug' => ${phpString(slug)}, 'frente' => ${front}, 'plantilla' => ${phpString(front ? '' : template)}],`;
    }),
    '];',
    '',
].join('\n');
// paginas.php siempre se regenera completo: no entra en los conflictos.
const pagesFile = { rel: 'inc/acf/paginas.php', dest: join(target, 'inc/acf/paginas.php'), content: pagesPhp };
const pagesCurrent = existsSync(pagesFile.dest) ? readFileSync(pagesFile.dest, 'utf8').replace(/\r\n/g, '\n') : null;

const plan = planFiles(files, args, { skipIdentical: true });
const known = new Set(files.map((file) => file.rel));
const orphans = existsSync(outDir)
    ? readdirSync(outDir).filter((name) => name.endsWith('.json')).map((name) => `${args.out}/${name}`).filter((rel) => !known.has(rel))
    : [];

const report = {
    target,
    states,
    pages: pages.map((page) => page.slug),
    groups: built.groups.length,
    fields: built.groups.reduce((sum, group) => sum + countFields(group.json.fields), 0),
    postTypes: built.postTypes.map((item) => item.content),
    taxonomies: built.taxonomies.map((item) => item.taxonomy),
    optionsPages: built.optionsPages.map((item) => item.slug),
    files: [...files.map(({ rel, kind, name }) => ({ rel, kind, name })), { rel: pagesFile.rel, kind: 'pages', name: 'paginas' }],
    create: pagesCurrent === null ? [...plan.create, pagesFile.rel] : plan.create,
    unchanged: pagesCurrent === pagesPhp ? [...plan.unchanged, pagesFile.rel] : plan.unchanged,
    conflicts: plan.conflicts,
    orphans,
};

function countFields(fields) {
    return fields.reduce((sum, field) => sum + 1 + countFields(field.sub_fields ?? []), 0);
}

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, 'Hay archivos de acf-json/ que ya existen y son distintos (¿guardados desde el admin?): indica cada uno en --overwrite o --skip.');

const written = writeFiles(files, plan);
if (pagesCurrent !== pagesPhp) {
    mkdirSync(dirname(pagesFile.dest), { recursive: true });
    writeFileSync(pagesFile.dest, pagesPhp);
    written.push(pagesFile.rel);
}
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip] }, null, 2));
process.exit(0);
