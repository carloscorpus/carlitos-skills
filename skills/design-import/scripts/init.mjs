#!/usr/bin/env node
// Prepara la carpeta specs/ de un tema WordPress y registra páginas. Sin dependencias.
//
// Uso:
//   node init.mjs [--target <dir>] [--dry-run] [--overwrite a,b] [--skip c,d]
//       Crea specs/_index.md y specs/_shared.md y mantiene un bloque corto de la skill en el
//       CLAUDE.md del tema (entre <!-- design-import:start --> y <!-- design-import:end -->).
//   node init.mjs --page <slug> --title <título> --source <archivo del diseño> --template <ruta de la plantilla>
//                 [--type estática|listado|detalle|global] [--content <contenido>] [--group <nombre>] [--location <texto>]
//                 [--parent <slug>]
//                 [--target <dir>] [--dry-run] [--overwrite specs/<slug>.md]
//       Crea specs/<slug>.md desde la plantilla de página y agrega su fila (pendiente) a _index.md.
//       --type (por defecto estática); listado y detalle exigen --content, en snake_case, igual al de la tabla
//       "Contenido dinámico" de _shared.md. --group es el nombre del grupo de campos (por defecto el título);
//       --location, la regla de ubicación de ACF (por defecto según el tipo y la plantilla). --parent, el slug de la
//       página estática de la que cuelga (wp-acf la crea como hija: /servicios/diseno-web/); por defecto ninguno.
//       global es el spec de lo que se repite en todo el sitio (cabecera, pie, contacto, redes): el slug es
//       siempre "opciones" y no lleva --content.
//       Córrelo uno por uno desde el hilo principal: si varios subagentes editan _index.md a la vez se pisan.
//
// Requisitos: el tema tiene style.css y functions.php. Sale con JSON en stdout. Códigos: 0 ok,
// 1 error de uso/validación, 2 conflictos sin resolver, 3 placeholders sin reemplazar. Nunca escribe
// nada si sale con código distinto de 0.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    assertNoLeftovers, assertResolved, claudeBlock, fail, patchFile, planFiles, renderString, renderTemplates,
    skillVersion, slugFromTarget, writeFiles,
} from './lib/common.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(skillDir, 'templates');
const INDEX = 'specs/_index.md';
const ROWS_END = '<!-- design-import:paginas:fin -->';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            slug: { type: 'string' },
            page: { type: 'string' },
            title: { type: 'string' },
            source: { type: 'string' },
            template: { type: 'string' },
            type: { type: 'string', default: 'estática' },
            content: { type: 'string' },
            group: { type: 'string' },
            location: { type: 'string' },
            parent: { type: 'string' },
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

const themeName = /^\s*Theme Name:\s*(.+?)\s*$/m.exec(readFileSync(join(target, 'style.css'), 'utf8'))?.[1] ?? slug;
const version = skillVersion(skillDir);
const values = {
    THEME_NAME: themeName,
    THEME_SLUG: slug,
    SKILL_VERSION: version,
    ENGINE_VERSION: version,
    FECHA: new Date().toISOString().slice(0, 10),
};

// ---------- --page ----------

if (args.page !== undefined) {
    const page = args.page.trim();
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(page) || page.startsWith('_')) {
        fail(1, `Página inválida "${page}": minúsculas, números y guiones, empieza con letra (sin tildes ni "ñ").`);
    }
    const missing = ['title', 'source', 'template'].filter((key) => !args[key]?.trim());
    if (missing.length) fail(1, `Faltan datos: ${missing.join(', ')}.`, { missing });
    for (const key of ['title', 'source', 'template', 'group', 'location']) {
        if (args[key] !== undefined && /[\r\n|`]/.test(args[key])) fail(1, `"${key}" no puede tener saltos de línea, "|" ni comillas invertidas.`);
    }
    const type = args.type.trim().replace('estatica', 'estática');
    if (!['estática', 'listado', 'detalle', 'global'].includes(type)) fail(1, `Tipo inválido "${type}": estática, listado, detalle o global.`);
    if (type === 'global' && page !== 'opciones') fail(1, 'El spec global se llama "opciones" (--page opciones): sus campos empiezan con opciones_.');
    if (page === 'opciones' && type !== 'global') fail(1, 'La página "opciones" es del tipo global.');
    const content = args.content?.trim() || 'ninguno';
    if (['estática', 'global'].includes(type) && content !== 'ninguno') fail(1, `Una página ${type} no lleva --content.`);
    if (['listado', 'detalle'].includes(type) && (content === 'ninguno' || !/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(content))) {
        fail(1, `--content es obligatorio en un ${type} y va en snake_case: el nombre de la tabla "Contenido dinámico" de _shared.md.`);
    }
    const template = args.template.trim();
    const parent = args.parent?.trim() || 'ninguno';
    if (parent !== 'ninguno') {
        if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(parent)) fail(1, `--parent "${parent}" no es un slug de página válido.`);
        if (parent === page) fail(1, 'Una página no puede ser su propio padre.');
        if (type !== 'estática' || template === 'front-page.php') fail(1, '--parent solo va en páginas estáticas que no son la de inicio.');
    }
    const location = args.location?.trim()
        || (type === 'global' ? 'página de opciones: Ajustes del sitio'
            : type === 'detalle' ? `tipo de contenido = ${content}`
            : type === 'listado' ? `página de opciones: archivo de ${content}`
            : template === 'front-page.php' ? 'página de inicio (front page)' : `plantilla ${template}`);
    if (!existsSync(join(target, INDEX))) fail(1, `Falta ${INDEX}: corre primero init.mjs sin --page.`);

    const pageValues = {
        ...values,
        PAGINA_TITULO: args.title.trim(),
        FUENTE: args.source.trim(),
        PLANTILLA: template,
        TIPO: type,
        CONTENIDO: content,
        GRUPO_ACF: args.group?.trim() || args.title.trim(),
        UBICACION: location,
        PADRE: parent,
    };
    const files = renderTemplates(templatesDir, pageValues, target, (f) => f.rel === 'specs/pagina.md')
        .map((f) => ({ ...f, rel: `specs/${page}.md`, dest: join(target, 'specs', `${page}.md`) }));
    assertNoLeftovers(files);

    const plan = planFiles(files, args);
    const indexText = readFileSync(join(target, INDEX), 'utf8');
    if (!indexText.includes(ROWS_END)) fail(1, `${INDEX} no tiene la marca ${ROWS_END}.`);
    const row = `| ${pageValues.PAGINA_TITULO} | [${page}.md](${page}.md) | \`${pageValues.PLANTILLA}\` | pendiente |`;
    const rowExists = indexText.includes(`](${page}.md)`);
    const report = { target, page, create: plan.create, conflicts: plan.conflicts, indexRow: rowExists ? 'exists' : 'add' };

    if (args['dry-run']) {
        console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
        process.exit(0);
    }
    assertResolved(plan, report, `Ya existe specs/${page}.md: indícalo en --overwrite o --skip.`);

    const written = writeFiles(files, plan);
    if (!rowExists) patchFile(join(target, INDEX), (text) => text.replace(ROWS_END, () => `${row}\n${ROWS_END}`));
    console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip] }, null, 2));
    process.exit(0);
}

// ---------- Esqueleto de specs/ ----------

const files = renderTemplates(templatesDir, values, target, (f) => f.rel === `specs/_index.md` || f.rel === 'specs/_shared.md');
const claudeText = renderString(readFileSync(join(skillDir, 'claude-block.md.tpl'), 'utf8'), values);
assertNoLeftovers([...files, { rel: 'claude-block (design-import)', content: claudeText }]);
const claude = claudeBlock(join(target, 'CLAUDE.md'), 'design-import', claudeText);

const plan = planFiles(files, args);
const report = { target, values, create: plan.create, conflicts: plan.conflicts, claudeMd: claude.status };

if (args['dry-run']) {
    console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
    process.exit(0);
}
assertResolved(plan, report, 'Hay archivos existentes: indica cada uno en --overwrite o --skip.');

const written = writeFiles(files, plan);
claude.write();
console.log(JSON.stringify({ ok: true, ...report, written, overwritten: [...plan.overwrite], skipped: [...plan.skip] }, null, 2));
