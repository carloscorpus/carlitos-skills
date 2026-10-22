#!/usr/bin/env node
// Instala el motor de wp-acf en un tema WordPress. Sin dependencias.
//
// Uso (desde la raíz del tema):
//   node install.mjs [--target <dir>] [--slug <slug>] [--dry-run] [--overwrite a,b] [--skip c,d]
//
// Copia inc/acf/runner.php (motor genérico: sincroniza el acf-json/ con la base, crea páginas, carga
// contenido, menús y logo), inc/acf/sitio.php (datos del proyecto: menús y logo) e inc/acf/seed/,
// agrega el require_once a functions.php y mantiene un bloque corto en CLAUDE.md (entre
// <!-- wp-acf:start --> y <!-- wp-acf:end -->). Las funciones llevan el prefijo del tema.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso/validación, 2 conflictos sin resolver,
// 3 placeholders sin reemplazar. Nunca escribe nada si sale con código distinto de 0.

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
const REQUIRE_LINE = "require_once get_theme_file_path('/inc/acf/runner.php');";

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
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
const missingBase = ['style.css', 'functions.php'].filter((name) => !existsSync(join(target, name)));
if (missingBase.length) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).', { missing: missingBase });

const version = skillVersion(skillDir);
const values = { SLUG: slug, PREFIX: prefixFromSlug(slug), ENGINE_VERSION: version, SKILL_VERSION: version };

const files = [
    ...renderTemplates(templatesDir, values, target),
    { rel: 'inc/acf/seed/.gitkeep', dest: join(target, 'inc/acf/seed/.gitkeep'), content: '' },
];
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block (wp-acf)', content: claudeText }]);
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'wp-acf', claudeText);

const plan = planFiles(files, args, { skipIdentical: true });
const hasRequire = readFileSync(join(target, 'functions.php'), 'utf8').includes(REQUIRE_LINE);
const report = {
    target,
    values,
    create: plan.create,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    functionsPhp: hasRequire ? 'unchanged' : 'add require_once',
    claudeMd: claude.status,
};

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, 'Hay archivos existentes distintos: indica cada uno en --overwrite o --skip (inc/acf/sitio.php es del proyecto: normalmente --skip).');

const written = writeFiles(files, plan);
ensureRequireLine(join(target, 'functions.php'), REQUIRE_LINE);
claude.write();
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip] }, null, 2));
process.exit(0);
