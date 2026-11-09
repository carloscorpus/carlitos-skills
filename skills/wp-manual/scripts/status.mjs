#!/usr/bin/env node
// Estado del manual en una sola lectura: tema, inventario de lo administrable, .env.manual, borradores,
// capturas, PDF y si están playwright-core y el navegador. Solo lee.
//
// Uso (desde la raíz del tema): node status.mjs [--target <tema>] [--out <carpeta>] [--env <archivo>] [--playwright-from <carpeta>]

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail } from './lib/common.mjs';
import { PENDIENTE } from './manual/borrador.mjs';
import { buildInventory } from './manual/inventario.mjs';
import { findPlaywright, installCommand } from './manual/navegador.mjs';
import { envState, paths, readDatos } from './manual/proyecto.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            out: { type: 'string' },
            env: { type: 'string' },
            'playwright-from': { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const P = paths(target, args);
const acfJson = existsSync(join(target, 'acf-json'));
const inventory = acfJson ? buildInventory(target) : { chapters: [], uncovered: [], prefix: null };
const env = envState(P.env);
const pw = await findPlaywright([args['playwright-from'], target, process.cwd()]);
const mapa = existsSync(P.mapa) ? JSON.parse(readFileSync(P.mapa, 'utf8')) : null;
const datos = readDatos(P.datos);

const chapters = inventory.chapters.map((c) => {
    const path = P.borrador(c.id);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
    return {
        id: c.id, kind: c.kind, title: c.title, sections: c.sections.length, fields: c.fields, shared: Boolean(c.shared),
        borrador: text === null ? 'falta' : text.includes(PENDIENTE) ? `${(text.match(new RegExp(PENDIENTE, 'g')) ?? []).length} pendientes` : 'redactado',
        capturas: Boolean(mapa?.capitulos?.[c.id]),
    };
});

const next = [];
if (!acfJson) next.push('El tema no tiene acf-json/: el manual necesita los campos de ACF (wp-acf).');
else if (!env.exists || !env.url) next.push('Correr init.mjs: crea .env.manual; la persona lo llena (MANUAL_URL del sitio local).');
else if (chapters.some((c) => c.borrador === 'falta')) next.push('Correr init.mjs para crear los borradores que faltan.');
else if (chapters.some((c) => c.borrador !== 'redactado')) next.push('Redactar los borradores (references/redaccion.md) y que la persona los revise.');
if (acfJson && env.url && !pw) next.push(`Falta playwright-core: ${installCommand(args['playwright-from'] ?? target)} (preguntar antes; mejor en una carpeta fuera del proyecto con --playwright-from).`);
if (acfJson && env.url && pw && chapters.some((c) => !c.capturas)) next.push('Correr capture.mjs.');
if (mapa && chapters.every((c) => c.borrador === 'redactado')) next.push('Correr check.mjs y luego build.mjs.');
if (!datos.panel) next.push('Completar "Dirección del panel" en _manual.md (dominio real del sitio + /wp-admin).');

console.log(JSON.stringify({
    ok: true,
    target,
    acfJson,
    prefix: inventory.prefix,
    pagesSource: inventory.pagesSource ?? null,
    env: { path: P.env, ...env },
    playwright: pw ? { from: pw.from } : null,
    carpeta: P.root,
    datos,
    chapters,
    uncovered: inventory.uncovered,
    salida: ['manual-horizontal.pdf', 'manual-vertical.pdf', 'reporte.pdf'].filter((f) => existsSync(join(P.salida, f))),
    next,
}, null, 2));
