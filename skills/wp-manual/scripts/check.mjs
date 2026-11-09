#!/usr/bin/env node
// Revisa los borradores contra el acf-json y, si ya hay capturas, contra lo que se vio en el admin:
// textos que faltan, cantidad de caracteres, recomendación de imágenes, resaltado solo donde la plantilla
// lo usa y capítulos sin borrador. Solo lee.
//
// Uso (desde la raíz del tema): node check.mjs [--target <tema>] [--out <carpeta>] [--chapter <id,id>]
// Sale con JSON. Códigos: 0 ok (puede haber avisos), 1 uso o errores en los borradores.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, toList } from './lib/common.mjs';
import { parseBorrador } from './manual/borrador.mjs';
import { buildInventory } from './manual/inventario.mjs';
import { paths } from './manual/proyecto.mjs';
import { checkChapter } from './manual/reglas.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            out: { type: 'string' },
            env: { type: 'string' },
            chapter: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const P = paths(target, args);
const inventory = buildInventory(target);
const mapa = existsSync(P.mapa) ? JSON.parse(readFileSync(P.mapa, 'utf8')) : null;
const wanted = toList(args.chapter);
const errors = [];
const warnings = [];

for (const chapter of inventory.chapters.filter((c) => !wanted.length || wanted.includes(c.id))) {
    const file = `${chapter.id}.md`;
    if (!existsSync(P.borrador(chapter.id))) { errors.push({ file, message: 'Falta el borrador: corre init.mjs.' }); continue; }
    const r = checkChapter(chapter, parseBorrador(readFileSync(P.borrador(chapter.id), 'utf8')), file, mapa?.capitulos?.[chapter.id] ?? null);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    if (mapa && !mapa.capitulos?.[chapter.id]) warnings.push({ file, message: 'Sin capturas: corre capture.mjs.' });
}
for (const u of inventory.uncovered) warnings.push({ file: '(tema)', message: `Sin cubrir: ${u.kind} «${u.name}». ${u.reason}` });

console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2));
process.exit(errors.length ? 1 : 0);
