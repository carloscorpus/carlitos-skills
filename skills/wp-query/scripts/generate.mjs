#!/usr/bin/env node
// Genera la definición de cada listado (inc/query/<contenido>.php) a partir de los specs de design-import.
// Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node generate.mjs [--target <dir>] [--specs specs] [--page productos,blog] [--states aplicado]
//                     [--dry-run] [--overwrite a,b] [--skip a,b]
//
// Lee la tabla "Filtros" y las etiquetas de cada spec `listado` (Al filtrar, Paginación, Por página, Filtros en
// móvil), los campos ACF de su spec `detalle` (tipo y opciones) y su fila de "Contenido dinámico" en _shared.md.
// Escribe un archivo por contenido que lee inc/query/motor.php. Por defecto solo toma los listados con Estado
// `aplicado`. Un archivo que ya existe y es distinto (editado a mano) es un conflicto: --overwrite / --skip.
//
// Salida JSON en stdout. Códigos: 0 ok, 1 entrada inválida, 2 conflictos sin resolver, 4 errores en los specs.

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { assertResolved, fail, planFiles, toList, writeFiles } from './lib/common.mjs';
import { buildDefinitions, definitionPhp } from './lib/query-build.mjs';
import { hasSpecs, loadSpecs } from './lib/specs.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
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
const { dynamic, files: pageFiles, all, pages } = loadSpecs(specsDir, { states, wanted });
if (wanted) {
    const unknown = wanted.filter((slug) => !pageFiles.includes(`${slug}.md`));
    if (unknown.length) fail(1, 'Páginas que no existen en specs/.', { unknown });
}

const { listings, errors } = buildDefinitions({ pages, all, dynamic });
if (errors.length) {
    console.log(JSON.stringify({ ok: false, error: 'Los specs tienen errores que impiden generar las definiciones.', errors }, null, 2));
    process.exit(4);
}
if (!listings.length) {
    fail(1, `Ningún listado con estado ${states.join(' o ')}${wanted ? ` entre ${wanted.join(', ')}` : ''}.`, { hint: 'Usa --states aprobado,aplicado para adelantarte o --page <slug>.' });
}

const files = listings.map((listing) => ({ rel: listing.rel, dest: join(target, listing.rel), content: definitionPhp(listing) }));
const plan = planFiles(files, args, { skipIdentical: true });

// Definiciones que quedaron sin listado (un contenido que ya no se filtra): se informan, no se borran.
const known = new Set(files.map((file) => file.rel));
const queryDir = join(target, 'inc/query');
const orphans = existsSync(queryDir)
    ? readdirSync(queryDir).filter((name) => name.endsWith('.php') && name !== 'motor.php').map((name) => `inc/query/${name}`).filter((rel) => !known.has(rel))
    : [];

const report = {
    target,
    states,
    listings: listings.map((listing) => ({ listado: listing.listado, contenido: listing.contenido, rel: listing.rel, filtros: Object.keys(listing.def.filtros) })),
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    orphans,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, 'Hay definiciones que ya existen y son distintas (¿editadas a mano?): indica cada una en --overwrite o --skip.');

const written = writeFiles(files, plan);
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip] }, null, 2));
process.exit(0);
