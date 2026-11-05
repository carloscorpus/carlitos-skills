#!/usr/bin/env node
// Une las lecturas de Figma de todas las páginas en specs/figma/lectura/_inventario.json, con las mismas claves
// que el JSON de analyze.mjs (tokens, repeated, interactions, dynamicCandidates, siteWide, findings). Es
// el paso 3 con fuente Figma: lo que sigue (etapa A) se lee igual que con una carpeta de diseño.
//
// Uso (desde la raíz del tema):
//   node figma-inventario.mjs [--target <dir>] [--page <slug>] [--out <archivo>]
//
// Valida primero cada lectura (igual que figma-lectura.mjs): con errores no escribe nada y sale con 4. Con
// --page une solo esa página. Sin --out escribe specs/figma/lectura/_inventario.json. Solo lee y escribe ese
// archivo; no llama a Figma.
//
// Sale con JSON en stdout (el resumen y la ruta). Códigos: 0 ok, 1 error de uso, 4 hay errores en las lecturas.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { cargarLecturas, lecturaDir } from './figma/cargar.mjs';
import { buildInventario } from './figma/inventario.mjs';
import { fail } from './lib/common.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            page: { type: 'string' },
            out: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const lecturas = cargarLecturas(target, args.page);
if (!Array.isArray(lecturas)) fail(1, lecturas.error, lecturas.available ? { available: lecturas.available } : {});

const invalid = lecturas.filter((l) => l.errors.length);
if (invalid.length) {
    fail(4, 'Hay lecturas con errores: corrígelas (node figma-lectura.mjs) antes de armar el inventario.', {
        pages: invalid.map((l) => ({ page: l.page, errors: l.errors })),
    });
}

const inventario = buildInventario(lecturas.map((l) => ({ slug: l.page, data: l.data, enlaces: l.enlaces })));
const out = args.out ? resolve(args.out) : join(lecturaDir(target), '_inventario.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(inventario, null, 2)}\n`);

console.log(JSON.stringify({ ok: true, out, summary: inventario.summary, warnings: lecturas.flatMap((l) => l.warnings.map((w) => ({ page: l.page, ...w }))) }, null, 2));
