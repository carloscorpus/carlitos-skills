#!/usr/bin/env node
// Instala el motor de wp-query en un tema WordPress. Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node install.mjs [--target <dir>] [--slug <slug>] [--dry-run] [--overwrite a,b] [--skip c,d]
//   node install.mjs --check [--target <dir>]
//
// Copia inc/query/motor.php (genérico: consulta principal, filtros, conteos, paginación, relacionados y SEO de
// los listados), agrega el require_once a functions.php y mantiene un bloque corto en CLAUDE.md (entre
// <!-- wp-query:start --> y <!-- wp-query:end -->). Las funciones llevan el prefijo del tema. Las definiciones
// de cada listado (inc/query/<contenido>.php) las escribe generate.mjs.
//
// --check no escribe nada: verifica que el motor esté copiado y conectado, e informa la versión instalada
// frente a la de la skill.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar, 4 --check con conexiones faltantes. Nunca escribe nada si sale con código
// distinto de 0.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, ensureRequireLine, fail, planFiles, prefixFromSlug,
    renderString, renderTemplates, skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');
const ENGINE = 'inc/query/motor.php';
const REQUIRE_LINE = "require_once get_theme_file_path('/inc/query/motor.php');";

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
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
const missingBase = ['style.css', 'functions.php'].filter((name) => !existsSync(join(target, name)));
if (missingBase.length) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).', { missing: missingBase });

const version = skillVersion(skillDir);
const read = (rel) => (existsSync(join(target, rel)) ? readFileSync(join(target, rel), 'utf8') : '');

if (args.check) {
    const wiring = { engine: existsSync(join(target, ENGINE)), functions: read('functions.php').includes('inc/query/motor.php') };
    const missing = Object.entries(wiring).filter(([, ok]) => !ok).map(([key]) => key);
    const installed = /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(read(ENGINE))?.[1] ?? null;
    const hints = [];
    if (missing.length) hints.push('Corre install.mjs sin --check: copia el motor y lo conecta en functions.php.');
    if (wiring.engine && installed !== version) {
        hints.push(`Motor ${installed ?? 'sin versión'} instalado, la skill trae ${version}: corre install.mjs --dry-run y luego --overwrite ${ENGINE}.`);
    }
    console.log(JSON.stringify({ ok: missing.length === 0, check: true, engineVersion: { installed, available: version }, wiring, missing, hints }, null, 2));
    process.exit(missing.length ? 4 : 0);
}

const slug = slugFromTarget(target, args.slug);
const values = { SLUG: slug, PREFIX: prefixFromSlug(slug), ENGINE_VERSION: version };

const files = renderTemplates(templatesDir, values, target);
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block (wp-query)', content: claudeText }]);
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-query', claudeText);

const plan = planFiles(files, args, { skipIdentical: true });
const report = {
    target,
    values,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    functionsPhp: read('functions.php').includes(REQUIRE_LINE) ? 'unchanged' : 'add require_once',
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, `Hay archivos existentes distintos: indica cada uno en --overwrite o --skip (${ENGINE} es el motor: se actualiza con --overwrite).`);

const written = writeFiles(files, plan);
ensureRequireLine(join(target, 'functions.php'), REQUIRE_LINE);
claude.write();
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip] }, null, 2));
process.exit(0);
