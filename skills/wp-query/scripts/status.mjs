#!/usr/bin/env node
// Dice en una sola lectura qué de wp-query ya está hecho en el tema, para no explorarlo a mano. Solo lee.
//
// Uso (desde la raíz del tema):
//   node status.mjs [--target <dir>] [--specs specs] [--states aplicado]
//
// Informa: si el motor está instalado y al día, cada definición de listado (falta, al día o distinta del spec)
// y por listado si tiene tabla "Filtros", su estado y cuántas secciones están `Query: conectado`. `next` lista
// lo que falta, en orden.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { fail, skillVersion, toList } from './lib/common.mjs';
import { buildDefinitions, definitionPhp } from './lib/query-build.mjs';
import { hasSpecs, loadSpecs, noAccent, read, unwrap } from './lib/specs.mjs';
import { detectTheme } from './lib/tema.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            states: { type: 'string', default: 'aplicado' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const specsDir = join(target, args.specs);
const theme = detectTheme(target);
if (!theme.isTheme) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).');

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = skillVersion(skillDir);
const enginePath = join(target, 'inc/query/motor.php');
const engineText = existsSync(enginePath) ? readFileSync(enginePath, 'utf8') : '';
const engine = {
    installed: engineText !== '',
    version: /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(engineText)?.[1] ?? null,
    requireLine: readFileSync(join(target, 'functions.php'), 'utf8').includes('inc/query/motor.php'),
};
engine.upToDate = engine.installed && engine.version === skill;

const next = [];
if (!engine.installed || !engine.requireLine) next.push('Instalar el motor: install.mjs');
else if (!engine.upToDate) next.push(`Actualizar el motor (instalado ${engine.version ?? 'sin versión'}, skill ${skill}): install.mjs --overwrite inc/query/motor.php`);

let listados = [];
let definitions = [];
let specsError = null;
const specs = hasSpecs(specsDir);
if (!specs) {
    next.push('No hay specs: design-import primero');
} else {
    try {
        const states = toList(args.states);
        const { dynamic, all, pages } = loadSpecs(specsDir, { states });
        listados = all.filter((page) => noAccent(unwrap(page.labels.Tipo ?? '')) === 'listado').map((page) => ({
            slug: page.slug,
            contenido: unwrap(page.labels.Contenido ?? ''),
            state: page.labels.Estado ?? '',
            filtros: page.filters ? page.filters.length : null,
            sections: page.sections.length,
            connected: page.sections.filter((s) => unwrap(s.labels.Query ?? '') === 'conectado').length,
        }));
        const { listings, errors } = buildDefinitions({ pages, all, dynamic });
        if (errors.length) specsError = errors;
        definitions = listings.map((listing) => {
            const path = join(target, listing.rel);
            const state = !existsSync(path) ? 'falta' : read(path) === definitionPhp(listing) ? 'al día' : 'distinta';
            return { contenido: listing.contenido, listado: listing.listado, rel: listing.rel, state };
        });

        const noTable = listados.filter((l) => l.filtros === null);
        if (noTable.length) next.push(`Falta la tabla "Filtros" en: ${noTable.map((l) => l.slug).join(', ')} (design-import)`);
        if (specsError) next.push('Los specs tienen errores: generate.mjs --dry-run los lista');
        const stale = definitions.filter((d) => d.state !== 'al día');
        if (stale.length) next.push(`Generar las definiciones: generate.mjs (${stale.map((d) => `${d.contenido} ${d.state}`).join(', ')})`);
        const pending = listados.filter((l) => states.includes(l.state) && l.connected === 0);
        if (pending.length) next.push(`Conectar las plantillas: ${pending.map((l) => l.slug).join(', ')}`);
        if (!listados.some((l) => states.includes(l.state))) next.push(`Ningún listado está ${states.join(' o ')}: design-import (etapa C)`);
    } catch (e) {
        specsError = e.message;
        next.push('Los specs tienen errores: design-import check.mjs');
    }
}
if (!next.length) next.push('Nada que hacer: correr check.mjs');

console.log(JSON.stringify({
    ok: true,
    target,
    skill,
    engine,
    prefix: theme.prefix,
    helpers: theme.helpers,
    specs: specs && !specsError,
    specsError,
    definitions,
    listados,
    next,
}, null, 2));
