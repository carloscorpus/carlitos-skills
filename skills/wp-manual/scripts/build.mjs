#!/usr/bin/env node
// Arma el manual en PDF (horizontal, vertical o ambos) con los borradores y las capturas, y aparte un
// reporte.pdf sencillo para el equipo con lo cubierto y lo que falta.
//
// Uso (desde la raíz del tema):
//   node build.mjs [--formato horizontal|vertical|ambos] [--target <tema>] [--out <carpeta>] [--env <archivo>]
//                  [--playwright-from <carpeta>] [--html-only] [--force] [--juntar]
//
// Sin --formato usa MANUAL_FORMATO de .env.manual (o "ambos"). --html-only deja solo los .html (sin
// navegador). Si check.mjs encuentra errores no genera el manual (sí el reporte), salvo --force.
// --juntar pone en una hoja dos secciones cortas seguidas del mismo capítulo (solo horizontal).
// Al imprimir mide cada hoja: si una imagen pisa un texto o se sale de la hoja, lo informa en "solapes"
// (y en salida/revision-<formato>.json, que check.mjs también lee).
// Sale con JSON. Códigos: 0 ok, 1 uso o errores en los borradores, 5 falta playwright-core o el navegador.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { fail, skillVersion } from './lib/common.mjs';
import { incluido, parseBorrador } from './manual/borrador.mjs';
import { allChapters } from './manual/extra.mjs';
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
            juntar: { type: 'boolean', default: false },
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
const chapters = allChapters(inventory, P.root);
for (const chapter of chapters) {
    const file = `${chapter.id}.md`;
    if (!existsSync(P.borrador(chapter.id))) { resultados[chapter.id] = { errors: [{ file, message: 'Falta el borrador.' }], warnings: [] }; continue; }
    borradores[chapter.id] = parseBorrador(readFileSync(P.borrador(chapter.id), 'utf8'));
    resultados[chapter.id] = incluido(borradores[chapter.id])
        ? checkChapter(chapter, borradores[chapter.id], file, mapa.capitulos?.[chapter.id] ?? null)
        : { errors: [], warnings: [] };
}
const errores = Object.values(resultados).reduce((n, r) => n + r.errors.length, 0);

mkdirSync(P.salida, { recursive: true });
const archivos = [];
let solapes = 0;
const reporteHtml = join(P.salida, 'reporte.html');
writeFileSync(reporteHtml, renderReporte({ datos, inventory, chapters, borradores, resultados, mapa, version: skillVersion(skillDir) }));
const pendientes = [{ html: reporteHtml, pdf: join(P.salida, 'reporte.pdf'), css: false }];
if (!errores || args.force) {
    for (const f of formatos) {
        const { html, paginas } = renderManual({ formato: f, datos, inventory, chapters, borradores, mapa, capturas: P.capturas, juntar: args.juntar });
        const path = join(P.salida, `manual-${f}.html`);
        writeFileSync(path, html);
        rmSync(join(P.salida, `revision-${f}.json`), { force: true });
        pendientes.push({ html: path, pdf: join(P.salida, `manual-${f}.pdf`), css: true, paginas, formato: f });
    }
}

if (!args['html-only']) {
    const pw = await findPlaywright([args['playwright-from'], target, process.cwd()]);
    if (!pw) fail(5, 'Falta playwright-core.', { install: installCommand(args['playwright-from'] ?? target) });
    let browser;
    try { ({ browser } = await launch(pw.module)); } catch (e) { fail(5, e.message); }
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.emulateMedia({ media: 'print' });
    for (const item of pendientes) {
        await page.goto(pathToFileURL(item.html).href, { waitUntil: 'networkidle' });
        let revision = null;
        if (item.css) {
            await page.waitForSelector('body[data-listo]', { timeout: 60_000 });
            revision = JSON.parse(await page.evaluate(() => document.body.dataset.revision ?? 'null'));
            if (revision) writeFileSync(join(P.salida, `revision-${item.formato}.json`), JSON.stringify(revision, null, 2));
        }
        await page.pdf({ path: item.pdf, preferCSSPageSize: item.css, printBackground: true });
        archivos.push({ pdf: item.pdf, paginas: revision?.paginas ?? item.paginas ?? null, ...(revision ? { juntadas: revision.juntadas.length, solapes: revision.solapes } : {}) });
        solapes += revision?.solapes?.length ?? 0;
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
    solapes,
    ...(args.juntar && formatos.includes('vertical') ? { avisoJuntar: '--juntar solo se aplica al formato horizontal.' } : {}),
    ...(solapes ? { revisar: 'Hay imágenes que pisan el texto o se salen de la hoja: ver "solapes" en archivos y salida/revision-*.json.' } : {}),
    ...(errores && !args.force ? { message: 'Hay errores en los borradores (ver reporte): el manual no se generó. Corrígelos o usa --force.' } : {}),
    recordatorio: existsSync(P.env) ? `Cuando termines el manual, borra ${P.env} (tiene credenciales).` : undefined,
}, null, 2));
process.exit(ok ? 0 : 1);
