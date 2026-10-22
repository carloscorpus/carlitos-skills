#!/usr/bin/env node
// Auditoría estática de los listados conectados con wp-query. Solo lee; sin dependencias.
//
// Uso (desde la raíz del tema):
//   node check.mjs [--target <dir>] [--specs specs] [--states aplicado] [--page productos] [--php <ruta a php>]
//
// Revisa, para los listados con el estado pedido (por defecto `aplicado`):
//   - El motor (inc/query/motor.php) está instalado y cargado desde functions.php, y su JS
//     (src/js/modules/query.js) está copiado e importado en el JS principal de Vite.
//   - Cada listado tiene su definición inc/query/<contenido>.php igual a la que generaría generate.mjs.
//   - En los listados con alguna sección `Query: conectado`, su Plantilla y los Destino de esas secciones:
//     las zonas data-query (resultados; filtros si hay filtros; paginacion si hay paginación; total es un aviso),
//     el name de cada filtro (o el uso de <prefijo>_query_filters), y ningún `new WP_Query` en la plantilla
//     del archivo (los filtros van sobre la consulta principal).
//   - En todo el tema: ningún query_posts(); un `new WP_Query` sin wp_reset_postdata() en el mismo archivo es un
//     aviso, igual que un `echo $variable` sin escapar en las vistas revisadas.
//   - php -l de inc/query/*.php y de las vistas, si hay php (en el PATH o con --php). Si no hay, lo dice.
//
// Sale con JSON en stdout. Códigos: 0 ok (puede haber avisos), 1 error de uso, 4 hay errores.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { detectJsEntry, fail, toList } from './lib/common.mjs';
import { buildDefinitions, definitionPhp } from './lib/query-build.mjs';
import { hasSpecs, loadSpecs, read, unwrap } from './lib/specs.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            states: { type: 'string', default: 'aplicado' },
            page: { type: 'string' },
            php: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const specsDir = join(target, args.specs);
if (!existsSync(join(target, 'style.css')) || !existsSync(join(target, 'functions.php'))) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).');
if (!hasSpecs(specsDir)) fail(1, `Faltan ${args.specs}/_index.md o ${args.specs}/_shared.md: corre primero design-import.`);

const errors = [];
const warnings = [];
const error = (file, message) => errors.push({ file, message });
const warn = (file, message) => warnings.push({ file, message });
const text = (rel) => (existsSync(join(target, rel)) ? read(join(target, rel)) : null);

// ---------- Motor ----------

const ENGINE = 'inc/query/motor.php';
const engine = text(ENGINE);
if (engine === null) error(ENGINE, 'Falta el motor: corre install.mjs.');
else if (!read(join(target, 'functions.php')).includes('inc/query/motor.php')) error('functions.php', 'No carga inc/query/motor.php: corre install.mjs.');
const prefix = /function\s+(\w+?)_query_defs\s*\(/.exec(engine ?? '')?.[1] ?? null;
// El JS del motor (filtrar sin recargar): copiado e importado en el JS principal de Vite.
const ENGINE_JS = 'src/js/modules/query.js';
const jsEntry = detectJsEntry(target).entry;
if (engine !== null && text(ENGINE_JS) === null) error(ENGINE_JS, 'Falta el JS del motor (filtrar sin recargar): corre install.mjs.');
else if (engine !== null && !jsEntry) warn(ENGINE_JS, 'No pude saber cuál es el JS principal de Vite para ver si importa el motor: install.mjs --check --entry <ruta>.');
else if (engine !== null && !(text(jsEntry) ?? '').includes('modules/query.js')) error(jsEntry, 'El JS principal no importa modules/query.js: corre install.mjs.');

// ---------- Definiciones ----------

const states = toList(args.states);
const wanted = args.page === undefined ? null : toList(args.page);
const { dynamic, all, pages } = loadSpecs(specsDir, { states, wanted });
const { listings, errors: specErrors } = buildDefinitions({ pages, all, dynamic });
specErrors.forEach((e) => error(e.file, e.message));

for (const listing of listings) {
    const current = text(listing.rel);
    if (current === null) error(listing.rel, `Falta la definición del listado ${listing.listado}: corre generate.mjs.`);
    else if (current !== definitionPhp(listing)) error(listing.rel, 'La definición no coincide con el spec (¿editada a mano o spec cambiado?): corre generate.mjs.');
}

// ---------- Vistas de cada listado ----------

const destinations = (value) => (value ?? '').split(',').map((part) => unwrap(part.trim())).filter(Boolean);
const filterNames = (name, filtro) => {
    switch (filtro.tipo) {
        case 'taxonomia':
        case 'opciones':
            return [[filtro.varios === 'no' ? name : `${name}[]`, name]];
        case 'rango':
            return [[`${name}_min`, name], [`${name}_max`, name]];
        case 'fecha':
            return [[name, `${name}_desde`]];
        default:
            return [[name]];
    }
};
const hasName = (source, name) => new RegExp(`name=["']${name.replace(/[[\]]/g, '\\$&')}["']`).test(source);
const hasZone = (source, zone) => new RegExp(`data-query=["']${zone}["']`).test(source);

const views = new Set();
let connected = 0;
for (const listing of listings) {
    const page = pages.find((p) => p.slug === listing.listado);
    const sections = page.sections.filter((s) => unwrap(s.labels.Query ?? '') === 'conectado');
    if (!sections.length) continue;
    connected++;
    const template = unwrap(page.labels.Plantilla ?? '');
    const files = [...new Set([template, ...sections.flatMap((s) => destinations(s.labels.Destino))].filter(Boolean))];
    const sources = files.map((rel) => {
        const source = text(rel);
        if (source === null) error(page.file, `El destino "${rel}" no existe.`);
        else views.add(rel);
        return source ?? '';
    });
    const joined = sources.join('\n');
    const where = `${page.file} (${files.join(', ')})`;

    const filters = Object.entries(listing.def.filtros);
    if (!hasZone(joined, 'resultados')) error(where, 'Falta la zona data-query="resultados" (la rejilla de resultados).');
    if (filters.length && !hasZone(joined, 'filtros')) error(where, 'Falta la zona data-query="filtros" (el formulario de filtros).');
    if (listing.def.paginacion !== 'ninguna' && !hasZone(joined, 'paginacion')) error(where, 'Falta la zona data-query="paginacion".');
    if (!hasZone(joined, 'total')) warn(where, 'Sin zona data-query="total": el total de resultados no se actualizará al filtrar.');

    const usesHelper = prefix && new RegExp(`${prefix}_query_filters?\\s*\\(`).test(joined);
    if (!usesHelper) {
        for (const [name, filtro] of filters) {
            for (const options of filterNames(name, filtro)) {
                if (!options.some((option) => hasName(joined, option))) error(where, `Filtro "${name}": falta un control con name="${options[0]}".`);
            }
        }
    }
    const templateSource = sources[0] ?? '';
    if (/new\s+WP_Query\s*\(/.test(templateSource)) error(template, 'Un `new WP_Query` en la plantilla del archivo reemplaza la consulta principal: los filtros van sobre ella (pre_get_posts en el motor).');
}

// ---------- Todo el tema ----------

function phpFiles(dir) {
    const out = [];
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
        if (['node_modules', 'vendor', '.git', 'dist', 'specs'].includes(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...phpFiles(path));
        else if (name.endsWith('.php')) out.push(path);
    }
    return out;
}
const themeFiles = phpFiles(target).map((path) => relative(target, path).split(sep).join('/'));
for (const rel of themeFiles) {
    if (rel === ENGINE) continue;
    const source = read(join(target, rel));
    if (/\bquery_posts\s*\(/.test(source)) error(rel, 'query_posts() rompe la consulta principal y la paginación: usa los filtros del motor o pre_get_posts.');
    if (/new\s+WP_Query\s*\(/.test(source) && !/wp_reset_postdata\s*\(/.test(source)) warn(rel, 'Un `new WP_Query` sin wp_reset_postdata() después de su loop.');
}
for (const rel of views) {
    const source = read(join(target, rel));
    for (const m of source.matchAll(/(?:\becho\s+|<\?=\s*)(\$[\w\->[\]'"]+)\s*;?/g)) {
        warn(rel, `Salida sin escapar: ${m[0].trim()} (usa esc_html, esc_attr o esc_url).`);
    }
}

// ---------- php -l ----------

function findPhp() {
    const candidates = args.php ? [args.php] : ['php'];
    return candidates.find((bin) => spawnSync(bin, ['-v'], { encoding: 'utf8' }).status === 0) ?? null;
}
const php = findPhp();
let phpLint = 'no disponible';
if (php) {
    const lintable = [...new Set([...themeFiles.filter((rel) => rel.startsWith('inc/query/')), ...views])].filter((rel) => rel.endsWith('.php'));
    for (const rel of lintable) {
        const r = spawnSync(php, ['-l', join(target, rel)], { encoding: 'utf8' });
        if (r.status !== 0) error(rel, `php -l: ${(r.stdout + r.stderr).trim().split('\n')[0]}`);
    }
    phpLint = `${lintable.length} archivos`;
} else if (args.php) {
    fail(1, `--php "${args.php}" no se pudo ejecutar.`);
}

console.log(JSON.stringify({
    ok: errors.length === 0,
    states,
    listings: listings.map((l) => l.listado),
    connected,
    prefix,
    php: phpLint,
    errors,
    warnings,
}, null, 2));
process.exit(errors.length ? 4 : 0);
