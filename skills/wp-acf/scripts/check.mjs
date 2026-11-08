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
//   - Cada ['_item' => '<id>'] de una carga (relationship) es un elemento de ejemplo de alguna carga.
//   - El motor (inc/acf/runner.php) está instalado y cargado desde functions.php.
//
// Sale con JSON en stdout. Códigos: 0 ok (puede haber avisos), 1 error de uso, 4 hay errores.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, toList } from './lib/common.mjs';
import { buildAll, flattenGroup, locationFor } from './lib/acf-build.mjs';
import { hasSpecs, lineSplits, loadSpecs, normalizeText, phpLiterals, phpTexts, read, unwrap } from './lib/specs.mjs';

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
for (const w of built.warnings) warn(w.file, w.message);

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
        else if (['repeater', 'relationship'].includes(exp.type) && (got.min !== exp.min || got.max !== exp.max)) {
            error(where, `${name}: el spec dice mínimo ${exp.min} y máximo ${exp.max} (0 = sin límite) y el JSON ${got.min} y ${got.max}: corre generate.mjs.`);
        }
        else if (exp.type === 'relationship' && got.postTypes !== exp.postTypes) {
            error(where, `${name}: el spec elige entre "${exp.postTypes}" y el JSON entre "${got.postTypes}": corre generate.mjs.`);
        }
        else if (exp.type === 'taxonomy' && got.taxonomy !== exp.taxonomy) {
            error(where, `${name}: el spec usa la taxonomía "${exp.taxonomy}" y el JSON "${got.taxonomy}": corre generate.mjs.`);
        }
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

// Archivos de get_template_part('slug', 'name') que existen en el tema: primero slug-name.php, si no slug.php.
const componentsOf = (code) => {
    const seen = new Set();
    const out = [];
    for (const [, slug, name] of code.matchAll(/get_template_part\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"])?/g)) {
        const rel = [name ? `${slug}-${name}.php` : null, `${slug}.php`].filter(Boolean).find((p) => existsSync(join(target, p)));
        if (!rel || seen.has(rel)) continue;
        seen.add(rel);
        out.push({ rel, code: fileText(rel) });
    }
    return out;
};

// ¿El componente imprime $args['key'] (o la variable que lo guarda) con esc_html()?
const printsPlain = (code, key) => {
    const vars = [...code.matchAll(new RegExp(`\\$(\\w+)\\s*=\\s*\\(?\\s*\\$args\\[\\s*['"]${escapeRe(key)}['"]`, 'g'))].map((m) => m[1]);
    const targets = [`\\$args\\[\\s*['"]${escapeRe(key)}['"]`, ...vars.map((v) => `\\$${v}\\b(?!\\s*\\[)`)];
    return targets.some((t) => new RegExp(`esc_html\\(\\s*${t}`).test(code));
};

// Reglas propias para saltos o marcadores de color, que solo debe aplicar <prefix>_highlight().
const MARKER_LITERAL = /^\s*['"][*|~^=]{1,2}['"]/;
const ownTextRules = (code) => {
    const rules = [];
    if (/\bnl2br\s*\(/.test(code)) rules.push('nl2br');
    if (/\b(?:explode|preg_split)\s*\(\s*(?:PHP_EOL|"[^"]*\\n[^"]*"|'[^']*\\n[^']*')/.test(code)) rules.push('parte el texto por líneas');
    for (const m of code.matchAll(/\b(?:str_replace|str_ireplace|strtr|explode|substr_count|strpos|str_contains)\s*\(([^)]*)/g)) {
        if (MARKER_LITERAL.test(m[1]) || /\[\s*['"][*|~^=]['"]/.test(m[1])) {
            rules.push('cambia los marcadores a mano');
            break;
        }
    }
    if (/\bpreg_(?:replace|replace_callback|match|match_all|split)\s*\(\s*(['"])[^'"]*\\[*|~^=]/.test(code) && !rules.includes('cambia los marcadores a mano')) rules.push('cambia los marcadores a mano');
    return rules;
};

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
        for (const { base, fields } of lineSplits(section.fields.map((f) => f.name))) {
            warn(where, `${fields.join(', ')}: es un solo texto en varias líneas: únelo en un textarea "${base}" (saltos como <br> en "valor actual", colores con los marcadores de wp-helper).`);
        }
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

        // Componentes que la sección llama: reciben sus textos por $args y también se revisan.
        const components = componentsOf(code);

        // Un textarea se imprime con <prefix>_highlight(): esc_html() pierde los saltos de línea que escribe el editor.
        for (const field of section.fields.filter((f) => f.type === 'textarea')) {
            const sub = field.name.includes('.') ? field.name.slice(field.name.lastIndexOf('.') + 1) : field.name.slice(section.group.length + 1);
            const advice = `${field.name}: es un textarea; imprímelo con <prefix>_highlight() para que se vean los saltos de línea.`;
            if (new RegExp(`esc_html\\(\\s*\\$\\w+\\[\\s*['"]${escapeRe(sub)}['"]`).test(code)) warn(where, advice);
            // El mismo texto pasado a un componente ('titulo' => $hero['subcampo']) se busca con su nombre en $args.
            const keys = [...code.matchAll(new RegExp(`['"](\\w+)['"]\\s*=>\\s*\\$\\w+\\[\\s*['"]${escapeRe(sub)}['"]`, 'g'))].map((m) => m[1]);
            for (const component of components) {
                if (keys.some((key) => printsPlain(component.code, key))) warn(`${where} › ${component.rel}`, advice);
            }
        }

        // Los saltos y los colores los pone solo <prefix>_highlight(): un componente o plantilla con reglas propias falla en algún caso.
        for (const { rel, code: text } of [...found.map((p) => ({ rel: p, code: fileText(p) })), ...components]) {
            const rules = ownTextRules(text);
            if (rules.length) warn(`${where} › ${rel}`, `Trata el texto por su cuenta (${rules.join(', ')}): imprímelo con <prefix>_highlight() de wp-helper, sin reglas propias, para que los colores y los saltos salgan igual en una línea o en varias.`);
        }

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
        // phpLiterals quita `|` y `*` de los textos del seed: el valor del spec se compara igual ("Los campos con * son…").
        const seedPlain = normalizeText(seedLiterals);
        for (const field of texts) {
            if (!seedPlain.includes(normalizeText(field.current.replace(/[|*]/g, '')))) error(where, `${field.name}: el valor actual "${field.current.slice(0, 40)}" no está en ${seedRel}.`);
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

// Un relationship se carga con ['_item' => '<id>']: ese id debe ser un elemento de ejemplo de alguna carga ('items').
const seedFiles = existsSync(join(target, 'inc/acf/seed')) ? readdirSync(join(target, 'inc/acf/seed')).filter((f) => f.endsWith('.php')) : [];
const seedTexts = new Map(seedFiles.map((name) => [name, read(join(target, 'inc/acf/seed', name))]));
const itemIds = new Set([...seedTexts.values()].flatMap((text) => [...text.matchAll(/['"]id['"]\s*=>\s*['"]([^'"]+)['"]/g)].map((m) => m[1])));
for (const [name, text] of seedTexts) {
    for (const [, id] of text.matchAll(/['"]_item['"]\s*=>\s*['"]([^'"]+)['"]/g)) {
        if (!itemIds.has(id)) error(`inc/acf/seed/${name}`, `['_item' => '${id}'] no es el 'id' de ningún elemento de ejemplo ('items') de inc/acf/seed/.`);
    }
}

// Ninguna carga guarda la dirección del propio sitio: en la base de datos solo rutas relativas ('/tarifario/') o '_page'.
const seedDir = join(target, 'inc/acf/seed');
const localUrl = /https?:\/\/(?:localhost|127\.0\.0\.1|[\w.-]*\.(?:local|test|localhost))(?::\d+)?[^'"\s]*/gi;
for (const name of existsSync(seedDir) ? readdirSync(seedDir).filter((f) => f.endsWith('.php')) : []) {
    for (const [url] of readFileSync(join(seedDir, name), 'utf8').matchAll(localUrl)) {
        error(`inc/acf/seed/${name}`, `Enlace absoluto de desarrollo "${url}": usa una ruta relativa ('/tarifario/') o ['_page' => 'slug'].`);
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
