#!/usr/bin/env node
// Prepara el manual: crea .env.manual vacío (y lo agrega a .gitignore), _manual.md con los datos de la
// portada y un borrador por capítulo con la numeración del acf-json. Volver a correrlo conserva los
// textos ya escritos y solo agrega lo nuevo.
//
// Uso (desde la raíz del tema):
//   node init.mjs [--target <tema>] [--out <carpeta>] [--env <archivo>] [--chapter <id,id>] [--dry-run]
//
// Sale con JSON. Códigos: 0 ok, 1 uso, 4 .env.manual recién creado o sin MANUAL_URL (el usuario lo llena
// y se vuelve a correr). Nunca pisa un .env.manual existente.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { claudeBlock, fail, skillVersion, toList } from './lib/common.mjs';
import { parseBorrador, skeleton } from './manual/borrador.mjs';
import { buildInventory } from './manual/inventario.mjs';
import { esqueletoEnvios } from './manual/extra.mjs';
import { createEnv, datosTemplate, ensureGitignore, envState, paths } from './manual/proyecto.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            out: { type: 'string' },
            env: { type: 'string' },
            chapter: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
if (!existsSync(join(target, 'acf-json'))) fail(1, `No hay acf-json/ en ${target}: el manual sale de los campos de ACF (wp-acf).`);
const P = paths(target, args);
const dry = args['dry-run'];
const report = { ok: true, env: P.env, created: [], updated: [], unchanged: [] };

// 1. .env.manual: se crea vacío y se para hasta que la persona lo llene.
const envInside = !relative(target, P.env).startsWith('..');
if (!dry) {
    if (createEnv(P.env)) report.envCreated = true;
    if (envInside && ensureGitignore(target, relative(target, P.env).replace(/\\/g, '/'))) report.gitignore = 'agregado';
}
const state = envState(P.env);
if (!state.url && !dry) {
    console.log(JSON.stringify({
        ...report, ok: false, waiting: true,
        message: `Llena ${P.env} (MANUAL_URL del sitio LOCAL, y MANUAL_USER/MANUAL_PASS de un usuario con el rol del cliente; sin usuario se inicia sesión a mano) y vuelve a correr init.mjs.`,
    }, null, 2));
    process.exit(4);
}
report.login = state.filled ? 'automático (.env.manual)' : 'a mano en el navegador';
report.formato = state.formato ?? 'ambos';

// 2. Datos de la portada (la fecha queda vacía: es opcional y Claude pregunta).
if (!existsSync(P.datos)) {
    const index = join(target, 'specs', '_index.md');
    const cliente = (existsSync(index) && /^# Specs de (.+)$/m.exec(readFileSync(index, 'utf8'))?.[1])
        || /Theme Name:\s*(.+)/.exec(existsSync(join(target, 'style.css')) ? readFileSync(join(target, 'style.css'), 'utf8') : '')?.[1]?.trim() || '';
    if (!dry) { mkdirSync(P.root, { recursive: true }); writeFileSync(P.datos, datosTemplate({ cliente })); }
    report.created.push(relative(target, P.datos).replace(/\\/g, '/'));
}

// 3. Borradores.
const inventory = buildInventory(target);
const wanted = toList(args.chapter);
for (const chapter of inventory.chapters.filter((c) => !wanted.length || wanted.includes(c.id))) {
    const path = P.borrador(chapter.id);
    const previous = existsSync(path) ? parseBorrador(readFileSync(path, 'utf8')) : null;
    const next = skeleton(chapter, previous);
    const rel = relative(target, path).replace(/\\/g, '/');
    if (previous && readFileSync(path, 'utf8').replace(/\r\n/g, '\n') === next) { report.unchanged.push(rel); continue; }
    if (!dry) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, next); }
    (previous ? report.updated : report.created).push(rel);
}

// 3b. Envíos guardados de wp-form: capítulo extra ya redactado (se quita con "- **Incluir:** no").
if (inventory.envios) {
    const path = P.borrador('extra-envios');
    const rel = relative(target, path).replace(/\\/g, '/');
    if (!existsSync(path)) {
        if (!dry) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, esqueletoEnvios(inventory.envios.postType)); }
        report.created.push(rel);
    }
    report.propuestas = [`El tema guarda los envíos de wp-form (${inventory.envios.postType}): ${rel} trae el capítulo «Envíos de formularios». Pregunta si va en el manual; si no, pon "- **Incluir:** no".`];
}

// 4. Bloque en CLAUDE.md del tema (solo si el manual vive en el tema).
if (!args.out && !dry) {
    const version = skillVersion(skillDir);
    const block = claudeBlock(join(target, 'CLAUDE.md'), 'wp-manual', [
        `## Manual de administración (wp-manual ${version})`,
        '- Borradores en `specs/manual/<capítulo>.md` (se editan a mano); capturas y PDF en `specs/manual/capturas/` y `specs/manual/salida/`.',
        '- `.env.manual` tiene credenciales del sitio local: no se sube a git y se borra al terminar el manual.',
        '- Si cambia un grupo de ACF, vuelve a correr `init.mjs` (conserva los textos) y regenera el manual.',
    ].join('\n'));
    block.write();
    report.claudeMd = block.status;
}

report.chapters = inventory.chapters.map((c) => ({ id: c.id, kind: c.kind, title: c.title, sections: c.sections.length, fields: c.fields, shared: Boolean(c.shared) }));
report.uncovered = inventory.uncovered;
console.log(JSON.stringify(report, null, 2));
