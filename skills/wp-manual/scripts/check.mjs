#!/usr/bin/env node
// Revisa los borradores contra el acf-json y, si ya hay capturas, contra lo que se vio en el admin:
// textos que faltan, cantidad de caracteres, recomendación de imágenes, resaltado solo donde la plantilla
// lo usa y capítulos sin borrador. También marca las capturas lisas (de un solo color) y, si ya se corrió
// build.mjs, las imágenes que se solapan con el texto. Solo lee.
//
// Uso (desde la raíz del tema): node check.mjs [--target <tema>] [--out <carpeta>] [--chapter <id,id>]
// Sale con JSON. Códigos: 0 ok (puede haber avisos), 1 uso o errores en los borradores.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, toList } from './lib/common.mjs';
import { incluido, parseBorrador } from './manual/borrador.mjs';
import { esLisa } from './manual/capturas.mjs';
import { allChapters } from './manual/extra.mjs';
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
const omitidos = [];
const notas = new Map(); // nota de "Cómo llegar" → capítulos que la repiten

for (const chapter of allChapters(inventory, P.root).filter((c) => !wanted.length || wanted.includes(c.id))) {
    const file = `${chapter.id}.md`;
    if (!existsSync(P.borrador(chapter.id))) { errors.push({ file, message: 'Falta el borrador: corre init.mjs.' }); continue; }
    const borrador = parseBorrador(readFileSync(P.borrador(chapter.id), 'utf8'));
    if (!incluido(borrador)) { omitidos.push(chapter.id); continue; }
    const capturas = mapa?.capitulos?.[chapter.id] ?? null;
    const r = checkChapter(chapter, borrador, file, capturas);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    if (mapa && !capturas) warnings.push({ file, message: 'Sin capturas: corre capture.mjs.' });
    if (borrador.nota) notas.set(borrador.nota, [...(notas.get(borrador.nota) ?? []), chapter.id]);

    // Capturas lisas: un solo color (falla de pintado o un elemento que seguía invisible).
    for (const [name, s] of Object.entries(capturas?.secciones ?? {})) {
        if (s.admin && (s.lisa || (existsSync(join(P.capturas, s.admin)) && esLisa(join(P.capturas, s.admin))))) {
            errors.push({ file, message: `${name}: la captura del admin (${s.admin}) es de un solo color; vuelve a correr capture.mjs --chapter ${chapter.id}.` });
        }
        if (s.web && s.webLisa) errors.push({ file, message: `${name}: la captura web (${s.web}) es de un solo color; revisa el selector "- **Web:**" o la animación de esa sección.` });
    }
}

// La misma nota en varios capítulos va una sola vez en Reglas generales (ver references/redaccion.md).
for (const [nota, ids] of notas) {
    if (ids.length >= 3) warnings.push({ file: '(varios)', message: `La nota «${nota.slice(0, 80)}${nota.length > 80 ? '…' : ''}» se repite en ${ids.length} capítulos (${ids.join(', ')}): quítala de los borradores; lo que vale para todo el panel va en Reglas generales.` });
}

// Solapes medidos en la última corrida de build.mjs.
if (existsSync(P.salida)) {
    for (const name of readdirSync(P.salida).filter((f) => /^revision-.+\.json$/.test(f))) {
        const rev = JSON.parse(readFileSync(join(P.salida, name), 'utf8'));
        for (const s of rev.solapes ?? []) errors.push({ file: name, message: `Pág. ${s.pagina} (${s.titulo}): ${s.problema} (de la última corrida de build.mjs).` });
    }
}

for (const u of inventory.uncovered) warnings.push({ file: '(tema)', message: `Sin cubrir: ${u.kind} «${u.name}». ${u.reason}` });
if (inventory.envios && !existsSync(P.borrador('extra-envios'))) warnings.push({ file: '(tema)', message: 'El tema guarda los envíos de wp-form y no hay extra-envios.md: corre init.mjs para crearlo.' });

console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings, omitidos }, null, 2));
process.exit(errors.length ? 1 : 0);
