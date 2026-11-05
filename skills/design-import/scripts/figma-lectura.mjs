#!/usr/bin/env node
// Valida las lecturas de Figma guardadas en specs/figma/lectura/<página>.json. Solo lee archivos: no llama a Figma.
//
// Uso (desde la raíz del tema):
//   node figma-lectura.mjs [--target <dir>] [--page <slug>]
//
// Por página comprueba la forma acordada (references/fuente-figma.md): formato, fuente, tokens, y por sección
// textos, valores sueltos, imágenes (el archivo descargado existe, no está vacío y su extensión coincide con el
// tipo), componentes y señales. Rechaza los links temporales de descarga de Figma (vencen a los 7 días) y
// compara con specs/figma/enlaces/: si el link de una sección cambió, avisa que la lectura quedó vieja.
// Una sección "pendiente" (aún sin leer) no es error.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso, 4 hay errores en las lecturas.

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { cargarLecturas } from './figma/cargar.mjs';
import { fail } from './lib/common.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            page: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const lecturas = cargarLecturas(target, args.page);
if (!Array.isArray(lecturas)) fail(1, lecturas.error, lecturas.available ? { available: lecturas.available } : {});

const pages = lecturas.map(({ page, file, errors, warnings, counts }) => ({ page, file, read: counts.read, pending: counts.pending, errors, warnings }));
const summary = {
    pages: pages.length,
    sectionsRead: pages.reduce((sum, p) => sum + p.read, 0),
    sectionsPending: pages.reduce((sum, p) => sum + p.pending, 0),
    errors: pages.reduce((sum, p) => sum + p.errors.length, 0),
    warnings: pages.reduce((sum, p) => sum + p.warnings.length, 0),
};

console.log(JSON.stringify({ ok: summary.errors === 0, target, summary, pages }, null, 2));
process.exit(summary.errors ? 4 : 0);
