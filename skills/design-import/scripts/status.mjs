#!/usr/bin/env node
// Dice en una sola lectura qué ya está hecho en el tema, para no explorarlo a mano. Solo lee.
//
// Uso (desde la raíz del tema):
//   node status.mjs [--target <dir>] [--specs specs]
//
// Informa: si el tema tiene la estructura de wp-vite-theme (entonces no se pregunta la estructura), el
// prefijo y los helpers de wp-helper, si hay specs y cuántas páginas hay por estado, y si wp-acf está
// instalado. `next` lista el siguiente paso.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso.

import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail } from './lib/common.mjs';
import { hasSpecs, loadSpecs, parseIndex, read } from './lib/specs.mjs';
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

const engine = detectEngine(target);
const specs = hasSpecs(specsDir);
const byState = {};
let shared = null;
if (specs) {
    for (const row of parseIndex(read(join(specsDir, '_index.md')))) byState[row.state] = (byState[row.state] ?? 0) + 1;
    shared = /\*\*Estado:\*\*\s*(\S+)/.exec(read(join(specsDir, '_shared.md')))?.[1] ?? null;
}

const next = [];
if (!theme.viteTheme) next.push('Estructura distinta de wp-vite-theme: leer destino-generico.md y confirmar la estructura una vez');
if (!specs) next.push('Iniciar los specs: analyze.mjs e init.mjs');
else if (shared !== 'aprobado') next.push('Etapa A: completar _shared.md y pedir su aprobación');
else if (byState.pendiente) next.push(`Etapa B: ${byState.pendiente} página(s) sin escribir`);
else if (byState.aprobado) next.push(`Etapa C: aplicar ${byState.aprobado} página(s) aprobadas`);
else next.push('Nada pendiente: correr check.mjs');

console.log(JSON.stringify({
    ok: true,
    target,
    viteTheme: theme.viteTheme,
    viteSigns: theme.viteSigns,
    askStructure: !theme.viteTheme,
    prefix: theme.prefix,
    helpers: theme.helpers,
    skillBlocks: theme.blocks,
    specs,
    sharedState: shared,
    pagesByState: byState,
    acfEngine: engine.runner && engine.requireLine ? { version: engine.version, seeds: engine.seeds.length, acfJson: engine.acfJson } : null,
    next,
}, null, 2));
