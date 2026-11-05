#!/usr/bin/env node
// Valida los links de specs/figma/enlaces/<página>.md antes de leer Figma. Solo lee texto: no llama a Figma.
//
// Uso (desde la raíz del tema):
//   node figma-links.mjs [--target <dir>] [--page <slug>] [--require-complete]
//
// Por página comprueba: título igual al nombre del archivo, link del frame de la página (archivo de diseño y
// node-id), cada sección como "- nombre: link" con nombre en slug y sin repetirse, y que dos secciones no
// apunten al mismo frame. También lee las notas del usuario ("## Notas" de la página y, con sangría bajo cada
// sección, "- nota: …") y el link opcional de su versión móvil ("- móvil: <link>"), y los devuelve en `notes` y
// `mobile`. Una página con "pendiente" no es error (aún no se llenó) salvo con
// --require-complete. Con --page solo valida esa página; sin ella, todas (los archivos que empiezan con "_"
// son guías y no se leen).
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso, 4 hay errores en los links.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEnlaces } from './figma/enlaces.mjs';
import { fail } from './lib/common.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            page: { type: 'string' },
            'require-complete': { type: 'boolean', default: false },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const dir = join(target, 'specs', 'figma', 'enlaces');
if (!existsSync(dir)) fail(1, 'No hay specs/figma/enlaces/: corre primero "node init.mjs --figma".');

let files = readdirSync(dir).filter((name) => name.endsWith('.md') && !name.startsWith('_')).sort();
if (args.page !== undefined) {
    const wanted = `${args.page.trim()}.md`;
    if (!files.includes(wanted)) fail(1, `No existe specs/figma/enlaces/${wanted}.`, { available: files.map((n) => n.replace(/\.md$/, '')) });
    files = [wanted];
}
if (!files.length) fail(1, 'specs/figma/enlaces/ no tiene páginas: copia _ejemplo.md como <página>.md.');

const pages = files.map((name) => {
    const slug = name.replace(/\.md$/, '');
    const parsed = parseEnlaces(readFileSync(join(dir, name), 'utf8'), slug);
    if (args['require-complete'] && parsed.pending) {
        parsed.errors.push({ line: 1, message: 'El frame de la página sigue en "pendiente".' });
    }
    return { file: `specs/figma/enlaces/${name}`, ...parsed };
});

const count = (key) => pages.reduce((sum, p) => sum + p[key].length, 0);
const summary = {
    pages: pages.length,
    sections: pages.reduce((sum, p) => sum + p.sections.filter((s) => !s.pending).length, 0),
    pending: pages.filter((p) => p.pending).map((p) => p.page),
    errors: count('errors'),
    warnings: count('warnings'),
};

console.log(JSON.stringify({ ok: summary.errors === 0, target, summary, pages }, null, 2));
process.exit(summary.errors ? 4 : 0);
