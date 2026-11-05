#!/usr/bin/env node
// Dice en una sola lectura qué ya está hecho en el tema, para no explorarlo a mano. Solo lee.
//
// Uso (desde la raíz del tema):
//   node status.mjs [--target <dir>] [--specs specs]
//
// Informa: si el tema tiene la estructura de wp-vite-theme (entonces no se pregunta la estructura), el
// prefijo y los helpers de wp-helper, si hay specs y cuántas páginas hay por estado, y si wp-acf está
// instalado. `next` lista el siguiente paso. Si existe specs/figma/enlaces/ suma `figma`: cuántas páginas
// tienen links de Figma y cuáles siguen vacías.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

// Fuente Figma: solo aparece si existe specs/figma/enlaces/. Una página tiene links si algún texto fuera de los
// comentarios trae un link de Figma; sin la carpeta la salida de este script no cambia.
let figma = null;
const enlacesDir = join(specsDir, 'figma', 'enlaces');
if (existsSync(enlacesDir)) {
    const pages = readdirSync(enlacesDir).filter((name) => name.endsWith('.md') && !name.startsWith('_')).sort();
    const withLinks = [];
    const withoutLinks = [];
    for (const name of pages) {
        const text = readFileSync(join(enlacesDir, name), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
        (/https:\/\/(?:www\.)?figma\.com\/(?:design|file)\//.test(text) ? withLinks : withoutLinks).push(name.replace(/\.md$/, ''));
    }
    figma = { pages: pages.length, withLinks, withoutLinks };
}

const next = [];
if (!theme.viteTheme) next.push('Estructura distinta de wp-vite-theme: leer destino-generico.md y confirmar la estructura una vez');
if (!specs) next.push('Iniciar los specs: analyze.mjs e init.mjs');
else if (shared !== 'aprobado') next.push('Etapa A: completar _shared.md y pedir su aprobación');
else if (byState.pendiente) next.push(`Etapa B: ${byState.pendiente} página(s) sin escribir`);
else if (byState.aprobado) next.push(`Etapa C: aplicar ${byState.aprobado} página(s) aprobadas`);
else next.push('Nada pendiente: correr check.mjs');
if (figma?.withoutLinks.length) next.push(`Figma: faltan los links de ${figma.withoutLinks.length} página(s): ${figma.withoutLinks.join(', ')}`);

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
    ...(figma ? { figma } : {}),
    next,
}, null, 2));
