#!/usr/bin/env node
// Arma el manual en PDF (horizontal, vertical o ambos) con los borradores y las capturas, y aparte un
// reporte.pdf sencillo para el equipo con lo cubierto y lo que falta.
//
// Uso (desde la raíz del tema):
//   node build.mjs [--formato horizontal|vertical|ambos] [--target <tema>] [--out <carpeta>] [--env <archivo>]
//                  [--playwright-from <carpeta>] [--html-only] [--force]
//
// Sin --formato usa MANUAL_FORMATO de .env.manual (o "ambos"). --html-only deja solo los .html (sin
// navegador). Si check.mjs encuentra errores no genera el manual (sí el reporte), salvo --force.
// Sale con JSON. Códigos: 0 ok, 1 uso o errores en los borradores, 5 falta playwright-core o el navegador.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { fail, skillVersion } from './lib/common.mjs';
import { parseBorrador } from './manual/borrador.mjs';
import { renderManual, renderReporte } from './manual/html.mjs';
import { buildInventory } from './manual/inventario.mjs';
import { findPlaywright, installCommand, launch } from './manual/navegador.mjs';
import { FORMATOS, envState, paths, readDatos } from './manual/proyecto.mjs';
import { checkChapter } from './manual/reglas.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let args;
try {
    ({ values: args } = parseArgs({
        options: {
            formato: { type: 'string' },
            target: { type: 'string', default: process.cwd() },
            out: { type: 'string' },
            env: { type: 'string' },
            'playwright-from': { type: 'string' },
            'html-only': { type: 'boolean', default: false },
            force: { type: 'boolean', default: false },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const P = paths(target, args);
const formato = args.formato ?? envState(P.env).formato ?? 'ambos';
if (!FORMATOS.includes(formato)) fail(1, `--formato debe ser ${FORMATOS.join(', ')}.`);
const formatos = formato === 'ambos' ? ['horizontal', 'vertical'] : [formato];

const inventory = buildInventory(target);
const mapa = existsSync(P.mapa) ? JSON.parse(readFileSync(P.mapa, 'utf8')) : { comunes: {}, capitulos: {} };
const datos = readDatos(P.datos);
const borradores = {};
const resultados = {};
for (const chapter of inventory.chapters) {
    const file = `${chapter.id}.md`;
    if (!existsSync(P.borrador(chapter.id))) { resultados[chapter.id] = { errors: [{ file, message: 'Falta el borrador.' }], warnings: [] }; continue; }
    borradores[chapter.id] = parseBorrador(readFileSync(P.borrador(chapter.id), 'utf8'));
    resultados[chapter.id] = checkChapter(chapter, borradores[chapter.id], file, mapa.capitulos?.[chapter.id] ?? null);
}
const errores = Object.values(resultados).reduce((n, r) => n + r.errors.length, 0);

mkdirSync(P.salida, { recursive: true });
const archivos = [];
const reporteHtml = join(P.salida, 'reporte.html');
writeFileSync(reporteHtml, renderReporte({ datos, inventory, borradores, resultados, mapa, version: skillVersion(skillDir) }));
const pendientes = [{ html: reporteHtml, pdf: join(P.salida, 'reporte.pdf'), css: false }];
if (!errores || args.force) {
    for (const f of formatos) {
        const { html, paginas } = renderManual({ formato: f, datos, inventory, borradores, mapa, capturas: P.capturas });
        const path = join(P.salida, `manual-${f}.html`);
        writeFileSync(path, html);
        pendientes.push({ html: path, pdf: join(P.salida, `manual-${f}.pdf`), css: true, paginas });
    }
}

if (!args['html-only']) {
    const pw = await findPlaywright([args['playwright-from'], target, process.cwd()]);
    if (!pw) fail(5, 'Falta playwright-core.', { install: installCommand(args['playwright-from'] ?? target) });
    let browser;
    try { ({ browser } = await launch(pw.module)); } catch (e) { fail(5, e.message); }
    const page = await browser.newPage();
    for (const item of pendientes) {
        await page.goto(pathToFileURL(item.html).href, { waitUntil: 'networkidle' });
        if (item.css) await page.waitForSelector('body[data-listo]', { timeout: 60_000 });
        await page.pdf({ path: item.pdf, preferCSSPageSize: item.css, printBackground: true });
        archivos.push({ pdf: item.pdf, paginas: item.paginas ?? null });
    }
    await browser.close();
} else {
    archivos.push(...pendientes.map((p) => ({ html: p.html, paginas: p.paginas ?? null })));
}

const ok = errores === 0 || args.force;
console.log(JSON.stringify({
    ok,
    formatos: ok ? formatos : [],
    archivos,
    errores,
    ...(errores && !args.force ? { message: 'Hay errores en los borradores (ver reporte): el manual no se generó. Corrígelos o usa --force.' } : {}),
    recordatorio: existsSync(P.env) ? `Cuando termines el manual, borra ${P.env} (tiene credenciales).` : undefined,
}, null, 2));
process.exit(ok ? 0 : 1);
