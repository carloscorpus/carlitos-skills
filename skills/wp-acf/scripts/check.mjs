#!/usr/bin/env node
// Verifica que el acf-json/, las plantillas y las cargas coincidan con los specs. Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node check.mjs [--target <dir>] [--specs specs] [--out acf-json] [--states aplicado] [--page home,opciones]
//
// Revisa, para las páginas con el estado pedido (por defecto `aplicado`):
//   - Cada grupo, tipo de contenido, taxonomía y página de opciones del spec tiene su JSON, con los mismos
//     campos (nombre, tipo, requerido), la misma ubicación y claves únicas. Lo que sobra en el JSON se avisa.
//   - En cada sección con `ACF: conectado`: la plantilla lee su grupo (`get_field('<grupo>'`, y 'option' en las
//     páginas de opciones), ya no trae el texto fijo (aviso) y la carga de inc/acf/seed/<página>.php trae el
//     grupo, cada "valor actual" de texto y los archivos que usa.
//   - El motor (inc/acf/runner.php) está instalado y cargado desde functions.php.
//
// Sale con JSON en stdout. Códigos: 0 ok (puede haber avisos), 1 error de uso, 4 hay errores.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, toList } from './lib/common.mjs';
import { buildAll, flattenGroup, locationFor } from './lib/acf-build.mjs';
import { hasSpecs, loadSpecs, normalizeText, phpLiterals, phpTexts, read, unwrap } from './lib/specs.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
            out: { type: 'string', default: 'acf-json' },
            states: { type: 'string', default: 'aplicado' },
            page: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const specsDir = join(target, args.specs);
const outDir = join(target, args.out);
if (!existsSync(join(target, 'style.css'))) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).');
if (!hasSpecs(specsDir)) fail(1, `Faltan ${args.specs}/_index.md o ${args.specs}/_shared.md.`);

const errors = [];
const warnings = [];
const error = (file, message) => errors.push({ file, message });
const warn = (file, message) => warnings.push({ file, message });

const states = toList(args.states);
const { pages, dynamic } = loadSpecs(specsDir, { states, wanted: args.page === undefined ? null : toList(args.page) });
if (!pages.length) fail(1, `Ninguna página con estado ${states.join(' o ')}.`);

const built = buildAll({ pages, dynamic });
for (const e of built.errors) error(e.file, e.message);

// ---------- acf-json/ ----------

const actualByKey = new Map();
const allKeys = new Map();
if (existsSync(outDir)) {
    for (const name of readdirSync(outDir).filter((n) => n.endsWith('.json'))) {
        let json;
        try {
            json = JSON.parse(read(join(outDir, name)));
        } catch {
            error(`${args.out}/${name}`, 'No es un JSON válido.');
            continue;
        }
        if (!json?.key) continue;
        actualByKey.set(json.key, { name, json });
        const seen = (key) => {
            if (allKeys.has(key)) error(`${args.out}/${name}`, `La clave ${key} también está en ${allKeys.get(key)}.`);
            else allKeys.set(key, name);
        };
        seen(json.key);
        const walk = (fields) => fields.forEach((field) => { seen(field.key); walk(field.sub_fields ?? []); });
        walk(json.fields ?? []);
    }
}

const expectedFiles = new Set();
const find = (item, label) => {
    expectedFiles.add(item.json.key);
    const actual = actualByKey.get(item.json.key);
    if (!actual) error(`${args.out}/${item.json.key}.json`, `Falta el JSON de ${label}: corre generate.mjs.`);
    return actual?.json;
};

for (const item of built.groups) {
    const json = find(item, `la página ${item.page}`);
    if (!json) continue;
    const where = `${args.out}/${item.json.key}.json (${item.page})`;
    const expected = flattenGroup(item.json);
    const actual = flattenGroup(json);
    for (const [name, exp] of expected) {
        const got = actual.get(name);
        if (!got) error(where, `El campo ${name} del spec no está en el JSON.`);
        else if (got.type !== exp.type) error(where, `${name}: el spec dice ${exp.type} y el JSON ${got.type}.`);
        else if (got.required !== exp.required) error(where, `${name}: "Requerido" no coincide con el JSON.`);
    }
    for (const name of actual.keys()) if (!expected.has(name)) error(where, `El campo ${name} está en el JSON pero no en el spec.`);
    if (JSON.stringify(json.location) !== JSON.stringify(item.json.location)) error(where, 'La ubicación del JSON no coincide con la "Ubicación" del spec.');
}
for (const item of built.postTypes) {
    const json = find(item, `el tipo de contenido ${item.content}`);
    if (json && json.post_type !== item.content) error(`${args.out}/${item.json.key}.json`, `post_type "${json.post_type}" no coincide con "${item.content}".`);
}
for (const item of built.taxonomies) {
    const json = find(item, `la taxonomía ${item.taxonomy}`);
    if (json && json.taxonomy !== item.taxonomy) error(`${args.out}/${item.json.key}.json`, `taxonomy "${json.taxonomy}" no coincide con "${item.taxonomy}".`);
}
for (const item of built.optionsPages) {
    const json = find(item, `la página de opciones ${item.slug}`);
    if (json && json.menu_slug !== item.slug) error(`${args.out}/${item.json.key}.json`, `menu_slug "${json.menu_slug}" no coincide con "${item.slug}".`);
}
for (const [key, { name }] of actualByKey) {
    if (!expectedFiles.has(key)) warn(`${args.out}/${name}`, 'Este JSON no sale de ningún spec con el estado pedido (¿otra página o hecho a mano?).');
}

// ---------- Motor ----------

const needsEngine = pages.some((page) => page.sections.some((s) => unwrap(s.labels.ACF ?? '') === 'conectado'));
const runner = join(target, 'inc/acf/runner.php');
if (!existsSync(runner)) (needsEngine ? error : warn)('inc/acf/runner.php', 'El motor no está instalado: corre install.mjs.');
else if (!read(join(target, 'functions.php')).includes("/inc/acf/runner.php'")) error('functions.php', 'functions.php no carga inc/acf/runner.php.');

// ---------- Secciones conectadas ----------

let sectionCount = 0;
let connected = 0;
const fileText = (rel) => read(join(target, rel));
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const page of pages) {
    const location = locationFor(page.labels.Ubicación, dynamic);
    const isOption = !!location.options;
    const seedRel = `inc/acf/seed/${page.slug}.php`;
    const seedExists = existsSync(join(target, seedRel));
    const seedText = seedExists ? fileText(seedRel) : '';
    const seedLiterals = seedExists ? phpLiterals(join(target, seedRel)).join(' ') : '';

    for (const section of page.sections) {
        if (section.state === 'descartado' || !section.group || section.group === 'ninguno') continue;
        sectionCount++;
        const where = `${page.file} › ${section.name}`;
        const acf = unwrap(section.labels.ACF ?? '');
        if (acf !== 'conectado') {
            if (section.state === 'aplicado') warn(where, 'La sección está aplicada pero no conectada a ACF (falta "ACF: conectado" en el spec).');
            continue;
        }
        connected++;

        const paths = unwrap(section.labels.Destino ?? '').split(/\s*,\s*/).map(unwrap).filter(Boolean);
        const found = paths.filter((p) => existsSync(join(target, p)));
        for (const p of paths) if (!found.includes(p)) error(where, `El destino "${p}" no existe en el tema.`);
        const code = found.map(fileText).join('\n');
        const reads = new RegExp(`get_field\\(\\s*['"]${escapeRe(section.group)}['"]\\s*(,[^)]*)?\\)`);
        const match = reads.exec(code);
        if (found.length && !match) error(where, `La plantilla no lee el grupo: falta get_field('${section.group}'${isOption ? ", 'option'" : ''}).`);
        else if (match && isOption && !/['"]option['"]/.test(match[1] ?? '')) error(where, `El grupo ${section.group} está en una página de opciones: lee get_field('${section.group}', 'option').`);

        const texts = section.fields.filter((f) => ['text', 'textarea', 'wysiwyg'].includes(f.type) && f.current && f.current !== '—');
        const templateText = [...found.flatMap((p) => phpTexts(join(target, p))), ...found.flatMap((p) => phpLiterals(join(target, p)))].join(' ');
        for (const field of texts) {
            if (templateText.includes(field.current)) warn(where, `${field.name}: el texto "${field.current.slice(0, 40)}" sigue fijo en la plantilla.`);
        }

        if (!seedExists) {
            error(where, `Falta la carga ${seedRel}.`);
            continue;
        }
        if (!new RegExp(`['"]${escapeRe(section.group)}['"]\\s*=>`).test(seedText)) error(where, `La carga ${seedRel} no trae el grupo ${section.group}.`);
        for (const field of texts) {
            if (!normalizeText(seedLiterals).includes(field.current)) error(where, `${field.name}: el valor actual "${field.current.slice(0, 40)}" no está en ${seedRel}.`);
        }
    }

    if (seedExists) {
        const wantsOption = isOption ? /['"]option['"]\s*=>\s*true/.test(seedText) : new RegExp(`['"]page['"]\\s*=>\\s*['"]${escapeRe(page.slug)}['"]`).test(seedText);
        const hasConnected = page.sections.some((s) => unwrap(s.labels.ACF ?? '') === 'conectado');
        if (hasConnected && !wantsOption && location.rule && ['page_type', 'page_template', 'options_page'].includes(location.rule.param)) {
            error(seedRel, isOption ? "La carga de una página de opciones lleva 'option' => true." : `La carga de la página lleva 'page' => '${page.slug}'.`);
        }
        for (const [, file] of seedText.matchAll(/['"]_file['"]\s*=>\s*['"]([^'"]+)['"]/g)) {
            if (!existsSync(join(target, file))) error(seedRel, `El archivo "${file}" de la carga no existe en el tema.`);
        }
    }
}

console.log(JSON.stringify({
    ok: errors.length === 0,
    states,
    pages: pages.length,
    sections: sectionCount,
    connected,
    groups: built.groups.length,
    postTypes: built.postTypes.length,
    taxonomies: built.taxonomies.length,
    optionsPages: built.optionsPages.length,
    errors,
    warnings,
}, null, 2));
process.exit(errors.length ? 4 : 0);
