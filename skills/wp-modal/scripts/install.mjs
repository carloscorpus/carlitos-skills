#!/usr/bin/env node
// Instala el motor de modales en un tema WordPress con Vite. Sin dependencias.
//
// Uso:
//   node install.mjs [--target <dir>] [--slug <slug>] [--entry <ruta>] [--css <ruta>]
//                    [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --check [--target <dir>] [--entry <ruta>] [--css <ruta>]
//
// Requisitos del tema: style.css, functions.php y vite.config.*. No exige que venga de
// wp-vite-theme. El JS y el CSS principales que empaqueta Vite se detectan leyendo
// vite.config.*; si hay duda, se pasan con --entry y --css (rutas relativas a la raíz del tema).
//
// Copia templates/ reemplazando {{...}} y conecta el motor al tema, sin duplicar nada si se
// vuelve a correr: require_once en functions.php, import() en el JS principal y @import del
// modal.css en el CSS principal. Si el tema tiene CLAUDE.md, agrega (o actualiza) un bloque corto
// de la skill entre <!-- wp-modal:start --> y <!-- wp-modal:end -->; no crea el archivo.
//
// --check no escribe nada: verifica que el motor esté completo y conectado, e informa la versión
// instalada frente a la de la skill.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con conexiones faltantes.
// Nunca escribe nada si sale con código distinto de 0.

import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, detectCssEntry, detectJsEntry, fail, findViteConfig, patchFile,
    planFiles, prefixFromSlug, relativeImport, renderString, renderTemplates, skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');
const ENGINE_JS = 'src/js/modules/modal.js';
const ENGINE_CSS = 'src/css/modal.css';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
            entry: { type: 'string' },
            css: { type: 'string' },
            check: { type: 'boolean', default: false },
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
if (!findViteConfig(target)) missingBase.push('vite.config.*');
if (missingBase.length) {
    fail(1, 'No parece un tema WordPress con Vite (ejecuta desde la raíz del tema).', { missing: missingBase });
}

// Archivo principal de Vite: el que se pasa con la bandera, o el que se detecta en vite.config.*.
function resolveEntry(flag, value, detect, label) {
    if (value) {
        const rel = posix.normalize(value.replaceAll('\\', '/'));
        const path = join(target, rel);
        if (isAbsolute(value) || rel.startsWith('..') || !existsSync(path) || !statSync(path).isFile()) {
            fail(1, `--${flag} "${value}" no es un archivo dentro del tema.`);
        }
        return rel;
    }
    const detected = detect(target);
    if (!detected.entry) {
        fail(1, `No pude saber cuál es el ${label} principal de Vite. Pregunta la ruta al usuario y pásala con --${flag} <ruta>.`, {
            candidates: detected.candidates,
        });
    }
    return detected.entry;
}

const entry = resolveEntry('entry', args.entry, detectJsEntry, 'JS');
const cssEntry = resolveEntry('css', args.css, detectCssEntry, 'CSS');
const version = skillVersion(skillDir);

const REQUIRE_LINE = "require_once get_theme_file_path('/inc/modals.php');";
const IMPORT_BLOCK = [
    "if (document.querySelector('dialog[data-modal]')) {",
    `    import('${relativeImport(entry, ENGINE_JS)}').then(({ initModals }) => initModals()).catch(console.error);`,
    '}',
];
const CSS_IMPORT = `@import "${relativeImport(cssEntry, ENGINE_CSS)}";`;

const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');

// Estado de la conexión del motor en el tema.
function wiringState() {
    return {
        engine: ['inc/modals.php', ENGINE_JS, ENGINE_CSS].every((rel) => existsSync(join(target, rel))),
        functions: read('functions.php').includes('inc/modals.php'),
        main: read(entry).includes('modules/modal.js'),
        css: read(cssEntry).includes('modal.css'),
    };
}

if (args.check) {
    const wiring = wiringState();
    const missing = Object.entries(wiring).filter(([, ok]) => !ok).map(([key]) => key);
    const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read('inc/modals.php'))?.[1] ?? null;
    const hints = [];
    if (!wiring.engine) hints.push('Corre install.mjs sin --check para copiar el motor.');
    if (!wiring.functions || !wiring.main || !wiring.css) {
        hints.push(`Corre install.mjs (sin --check): conecta functions.php, ${entry} y ${cssEntry}.`);
    }
    if (wiring.engine && installed !== version) {
        hints.push(`Motor ${installed ?? 'sin versión'} instalado, la skill trae ${version}: corre install.mjs --dry-run y revisa los conflictos antes de --overwrite.`);
    }
    console.log(JSON.stringify({
        ok: missing.length === 0,
        check: true,
        entry,
        css: cssEntry,
        engineVersion: { installed, available: version },
        wiring,
        missing,
        hints,
    }, null, 2));
    process.exit(missing.length ? 4 : 0);
}

const prefix = prefixFromSlug(slug);
const values = {
    THEME_SLUG: slug,
    PREFIX: prefix,
    PREFIX_UPPER: prefix.toUpperCase(),
    ENGINE_VERSION: version,
};

const files = renderTemplates(templatesDir, values, target);
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block.md.tpl', content: claudeText }]);

// Bloque corto de la skill en CLAUDE.md del tema (si el tema tiene uno).
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-modal', claudeText);

// Un archivo idéntico al que se instalaría no es conflicto.
const plan = planFiles(files, args, { skipIdentical: true });

const state = wiringState();
const report = {
    target,
    entry,
    css: cssEntry,
    values,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    wire: [
        ...(state.functions ? [] : ['functions.php']),
        ...(state.main ? [] : [entry]),
        ...(state.css ? [] : [cssEntry]),
    ],
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}

assertResolved(plan, report, 'Hay archivos existentes distintos: indica cada uno en --overwrite o --skip.');

const written = writeFiles(files, plan);
mkdirSync(join(target, 'template-parts/modals'), { recursive: true });

// Conexión idempotente: solo agrega lo que falta.
const wired = [];
if (!state.functions) {
    patchFile(join(target, 'functions.php'), (text) => {
        const lines = text.split('\n');
        const last = lines.findLastIndex((line) => /^\s*require(_once)?\b/.test(line));
        if (last === -1) return text.replace(/\n*$/, '\n') + REQUIRE_LINE + '\n';
        lines.splice(last + 1, 0, REQUIRE_LINE);
        return lines.join('\n');
    });
    wired.push('functions.php');
}
if (!state.main) {
    patchFile(join(target, entry), (text) => text.replace(/\n*$/, '\n\n') + IMPORT_BLOCK.join('\n') + '\n');
    wired.push(entry);
}
if (!state.css) {
    // Un @import debe ir antes de cualquier regla: se agrega tras los @import iniciales, o al principio.
    patchFile(join(target, cssEntry), (text) => {
        const lines = text.split('\n');
        let last = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('@import')) last = i;
            else if (line !== '' && !line.startsWith('/*') && !line.startsWith('*') && !line.endsWith('*/')) break;
        }
        lines.splice(last + 1, 0, CSS_IMPORT);
        return lines.join('\n');
    });
    wired.push(cssEntry);
}
claude.write();

console.log(JSON.stringify({
    ok: true,
    ...report,
    written,
    overwritten: [...plan.overwrite],
    skipped: [...plan.skip],
    wired,
}, null, 2));
