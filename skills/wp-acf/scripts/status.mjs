#!/usr/bin/env node
// Dice en una sola lectura qué de wp-acf ya está hecho en el tema, para no explorarlo a mano. Solo lee.
//
// Uso (desde la raíz del tema):
//   node status.mjs [--target <dir>] [--specs specs]
//
// Informa: si el motor está instalado y al día, si hay specs, el JSON generado, y por página el estado del
// spec, cuántas secciones están conectadas a ACF y si tiene su carga. `next` lista lo que falta, en orden.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { fail, skillVersion } from './lib/common.mjs';
import { hasSpecs, loadSpecs, unwrap } from './lib/specs.mjs';
import { detectEngine, detectTheme } from './lib/tema.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            specs: { type: 'string', default: 'specs' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const specsDir = join(target, args.specs);
const theme = detectTheme(target);
if (!theme.isTheme) fail(1, 'No parece un tema WordPress (ejecuta desde la raíz del tema).');

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = skillVersion(skillDir);
const engine = detectEngine(target);
const next = [];

if (!engine.runner || !engine.requireLine) next.push('Instalar el motor: install.mjs');
else if (engine.version !== skill) next.push(`Actualizar el motor (instalado ${engine.version ?? 'sin versión'}, skill ${skill}): install.mjs`);
if (!theme.helpers.images || !theme.helpers.links) next.push('Faltan los helpers de imagen o enlace: wp-helper');

let pages = [];
let specsError = null;
const specs = hasSpecs(specsDir);
if (!specs) {
    next.push('No hay specs: design-import primero');
} else {
    try {
        pages = loadSpecs(specsDir).all.map((page) => {
            const sections = page.sections.length;
            const connected = page.sections.filter((s) => unwrap(s.labels.ACF ?? '') === 'conectado').length;
            return {
                slug: page.slug,
                state: page.labels.Estado ?? '',
                sections,
                connected,
                seed: engine.seeds.includes(`${page.slug}.php`),
            };
        });
    } catch (e) {
        specsError = e.message;
        next.push('Los specs tienen errores: design-import check.mjs');
    }
}

const applied = pages.filter((p) => p.state === 'aplicado');
if (specs && !specsError) {
    if (applied.length && !engine.acfJson) next.push('Generar el JSON: generate.mjs');
    const pending = applied.filter((p) => p.connected < p.sections);
    if (pending.length) next.push(`Conectar a ACF: ${pending.map((p) => p.slug).join(', ')}`);
    if (!applied.length) next.push('Ninguna página está aplicada: design-import (etapa C)');
}
if (!next.length) next.push('Nada que hacer: correr check.mjs');

console.log(JSON.stringify({
    ok: true,
    target,
    skill,
    engine: { ...engine, upToDate: engine.runner && engine.version === skill },
    helpers: theme.helpers,
    prefix: theme.prefix,
    specs: specs && !specsError,
    specsError,
    json: { files: engine.acfJson, hasPaginas: engine.paginas },
    pages,
    next,
}, null, 2));
