#!/usr/bin/env node
// Instala los helpers PHP de wp-helper en un tema WordPress. Sin dependencias.
//
// Uso:
//   node install.mjs --list [--target <dir>]
//   node install.mjs --helpers images,text,links [--target <dir>] [--slug <slug>]
//                    [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --add-style --name <nombre> --marker <carácter> --class <clases> [--dry-run]
//   node install.mjs --check [--helpers images,text,links] [--target <dir>]
//
// Requisitos del tema: style.css y functions.php. No exige Vite (solo el helper "text" usa clases
// de Tailwind, que el tema ya resuelve) ni que el tema venga de wp-vite-theme.
//
// --helpers copia templates/ (solo los archivos de esos helpers), conecta require_once en
// functions.php sin duplicar nada si se vuelve a correr y mantiene un bloque corto de la skill en el
// CLAUDE.md del tema (entre <!-- wp-helper:start --> y <!-- wp-helper:end -->); no crea el archivo.
// inc/helpers/text-styles.php es configuración del proyecto: se crea una vez y nunca se pisa.
//
// --add-style agrega un estilo de texto (marcador + clase) a text-styles.php y falla si el nombre o
// el marcador ya están en uso. --list muestra los estilos y los marcadores libres.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con faltantes. Nunca escribe nada si sale con código
// distinto de 0.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, ensureRequireLine, fail, patchFile, planFiles, prefixFromSlug,
    renderString, renderTemplates, skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');

const STYLES_FILE = 'inc/helpers/text-styles.php';
const START = '// wp-helper:styles:start';
const END = '// wp-helper:styles:end';
// Un solo carácter, simétrico. Se excluyen & < > " ' (los toca esc_html) y - _ # @ + % ! (aparecen en texto normal).
const MARKERS = ['*', '|', '~', '^', '='];
const STYLE_LINE = /^\s*'([a-z][a-z0-9-]*)' => \['marker' => '(.)', 'class' => '([^'\\]+)'\],\s*$/;

// Cada helper: archivos que instala y archivo que se conecta desde functions.php.
const HELPERS = {
    images: { files: ['inc/helpers/images.php'], wire: 'inc/helpers/images.php' },
    text: { files: ['inc/helpers/text.php', STYLES_FILE], wire: 'inc/helpers/text.php' },
    links: { files: ['inc/helpers/links.php'], wire: 'inc/helpers/links.php' },
};
const requireLine = (rel) => `require_once get_theme_file_path('/${rel}');`;

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
            helpers: { type: 'string' },
            list: { type: 'boolean', default: false },
            check: { type: 'boolean', default: false },
            'add-style': { type: 'boolean', default: false },
            name: { type: 'string' },
            marker: { type: 'string' },
            class: { type: 'string' },
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

const missingBase = ['style.css', 'functions.php'].filter((rel) => !existsSync(join(target, rel)));
if (missingBase.length) {
    fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).', { missing: missingBase });
}

const version = skillVersion(skillDir);
const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');
const has = (rel) => existsSync(join(target, rel));

// ---------- Helpers pedidos ----------

function parseHelpers(value) {
    const names = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = names.filter((name) => !HELPERS[name]);
    if (unknown.length) fail(1, `Helper desconocido: ${unknown.join(', ')}.`, { available: Object.keys(HELPERS) });
    return [...new Set(names)];
}

const isInstalled = (name) => HELPERS[name].files.every(has);
const isWired = (name) => read('functions.php').includes(requireLine(HELPERS[name].wire));
const engineVersion = (name) =>
    /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read(HELPERS[name].wire))?.[1] ?? null;

// ---------- Estilos de texto ----------

// Lee el bloque de text-styles.php. Una línea con otro formato no se adivina: se corta.
function readStyles() {
    const text = read(STYLES_FILE).replace(/\r\n/g, '\n');
    const from = text.indexOf(START);
    const to = text.indexOf(END);
    if (from === -1 || to === -1 || to < from) {
        fail(1, `${STYLES_FILE} no tiene el bloque ${START} … ${END}.`);
    }
    const styles = [];
    for (const line of text.slice(from + START.length, to).split('\n')) {
        if (line.trim() === '') continue;
        const m = STYLE_LINE.exec(line);
        if (!m) fail(1, `${STYLES_FILE}: línea con formato desconocido dentro del bloque.`, { line: line.trim() });
        styles.push({ name: m[1], marker: m[2], class: m[3] });
    }
    return styles;
}

const freeMarkers = (styles) => MARKERS.filter((m) => !styles.some((s) => s.marker === m));

// ---------- --list ----------

if (args.list) {
    const installed = Object.fromEntries(Object.keys(HELPERS).map((name) => [name, {
        installed: isInstalled(name),
        wired: isInstalled(name) && isWired(name),
        engine: isInstalled(name) ? engineVersion(name) : null,
    }]));
    const styles = has(STYLES_FILE) ? readStyles() : [];
    console.log(JSON.stringify({
        ok: true,
        engineVersion: version,
        helpers: installed,
        styles,
        markers: { allowed: MARKERS, free: freeMarkers(styles) },
    }, null, 2));
    process.exit(0);
}

// ---------- --add-style ----------

if (args['add-style']) {
    if (!has(STYLES_FILE)) fail(1, `Falta ${STYLES_FILE}: instala primero el helper con --helpers text.`);
    const missing = ['name', 'marker', 'class'].filter((key) => !args[key]?.trim());
    if (missing.length) fail(1, `Faltan datos: ${missing.join(', ')}.`, { missing });

    const name = args.name.trim();
    const marker = args.marker;
    const classes = args.class.trim();
    if (!/^[a-z][a-z0-9-]*$/.test(name)) fail(1, `Nombre inválido "${name}": minúsculas, números y guiones, empieza con letra.`);
    if (!MARKERS.includes(marker)) fail(1, `Marcador inválido "${marker}".`, { allowed: MARKERS });
    if (!/^[\w:/[\].#%!-]+(?: [\w:/[\].#%!-]+)*$/.test(classes)) {
        fail(1, 'Clase inválida: usa nombres de clase separados por un espacio, sin comillas ni "\\".');
    }

    const styles = readStyles();
    const free = freeMarkers(styles);
    if (styles.some((s) => s.name === name)) fail(1, `El estilo "${name}" ya existe.`, { styles });
    if (styles.some((s) => s.marker === marker)) {
        fail(1, `El marcador "${marker}" ya lo usa el estilo "${styles.find((s) => s.marker === marker).name}".`, { free });
    }

    const style = { name, marker, class: classes };
    if (!args['dry-run']) {
        patchFile(join(target, STYLES_FILE), (text) =>
            text.replace(new RegExp(`^([ \\t]*)${END}`, 'm'),
                (_, indent) => `${indent}'${name}' => ['marker' => '${marker}', 'class' => '${classes}'],\n${indent}${END}`));
    }
    console.log(JSON.stringify({
        ok: true,
        dryRun: args['dry-run'],
        added: style,
        styles: [...styles, style],
        free: free.filter((m) => m !== marker),
    }, null, 2));
    process.exit(0);
}

// ---------- --check ----------

if (args.check) {
    const asked = parseHelpers(args.helpers);
    const names = asked.length ? asked : Object.keys(HELPERS).filter(isInstalled);
    const hints = [];
    const status = {};
    if (!names.length) hints.push('No hay helpers instalados: corre install.mjs --helpers images,text,links.');

    for (const name of names) {
        const installed = isInstalled(name);
        const wired = installed && isWired(name);
        const engine = installed ? engineVersion(name) : null;
        status[name] = { installed, wired, engine };
        if (!installed) hints.push(`Helper "${name}": faltan archivos. Corre install.mjs --helpers ${name}.`);
        else if (!wired) hints.push(`Helper "${name}": falta ${requireLine(HELPERS[name].wire)} en functions.php. Corre install.mjs --helpers ${name}.`);
        if (installed && engine !== version) {
            hints.push(`Helper "${name}": motor ${engine ?? 'sin versión'} instalado, la skill trae ${version}: corre install.mjs --dry-run y revisa los conflictos antes de --overwrite.`);
        }
    }
    const incomplete = !names.length || Object.values(status).some((s) => !s.installed || !s.wired);
    console.log(JSON.stringify({
        ok: !incomplete,
        check: true,
        engineVersion: { available: version },
        helpers: status,
        hints,
    }, null, 2));
    process.exit(incomplete ? 4 : 0);
}

// ---------- Instalar ----------

const selected = parseHelpers(args.helpers);
if (!selected.length) {
    fail(1, 'Indica qué instalar: --helpers images,text,links (o --list, --add-style, --check).', { available: Object.keys(HELPERS) });
}

const prefix = prefixFromSlug(slug);
const values = { THEME_SLUG: slug, PREFIX: prefix, PREFIX_UPPER: prefix.toUpperCase(), ENGINE_VERSION: version };

const wanted = new Set(selected.flatMap((name) => HELPERS[name].files));
// text-styles.php es del proyecto: si ya existe no entra en el plan (ni como conflicto).
const keptConfig = has(STYLES_FILE) && wanted.has(STYLES_FILE) ? [STYLES_FILE] : [];
const files = renderTemplates(templatesDir, values, target, (f) => wanted.has(f.rel) && !keptConfig.includes(f.rel));

// El bloque de CLAUDE.md describe los helpers presentes: los pedidos más los que ya había.
const present = Object.keys(HELPERS).filter((name) => selected.includes(name) || isInstalled(name));
const blockParts = ['claude-block.md.tpl', ...present.map((name) => `claude-block.${name}.md.tpl`)];
const claudeText = renderString(
    blockParts.map((part) => readFileSync(join(skillDir, part), 'utf8').trim()).join('\n'),
    values,
);
assertNoLeftovers([...files, { rel: 'claude-block (wp-helper)', content: claudeText }]);
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-helper', claudeText);

const plan = planFiles(files, args, { skipIdentical: true });
const report = {
    target,
    values,
    helpers: selected,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    keptConfig,
    wire: selected.filter((name) => !isWired(name)).map((name) => HELPERS[name].wire),
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}

assertResolved(plan, report, 'Hay archivos existentes distintos: indica cada uno en --overwrite o --skip.');

const written = writeFiles(files, plan);
const wired = selected
    .filter(isInstalled)
    .filter((name) => ensureRequireLine(join(target, 'functions.php'), requireLine(HELPERS[name].wire)))
    .map((name) => HELPERS[name].wire);
claude.write();

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...plan.overwrite],
    skipped: [...plan.skip],
    wired,
}, null, 2));
