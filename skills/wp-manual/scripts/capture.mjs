#!/usr/bin/env node
// Toma las capturas del manual en el sitio LOCAL, en solo lectura: el navegador bloquea todo envío (POST)
// salvo el login, así que nada se puede guardar. Numera los campos sobre la captura del admin igual que el
// borrador (1, 7.1, 2.5.1…), pliega las filas extra de las listas y captura la referencia web de cada sección.
//
// Uso (desde la raíz del tema):
//   node capture.mjs [--target <tema>] [--out <carpeta>] [--env <archivo>] [--playwright-from <carpeta>]
//                    [--chapter <id,id>] [--login-manual] [--bloquear <parte-de-url,…>]
//
// Sale con JSON. Códigos: 0 ok, 1 uso, 3 .env.manual sin URL, 5 falta playwright-core o el navegador,
// 6 no se pudo iniciar sesión.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, toList } from './lib/common.mjs';
import { NATIVOS, SECCION_NATIVA, incluido, parseBorrador } from './manual/borrador.mjs';
import { DOMINANTE_EN_NAVEGADOR, MAX_COLORES_LISA, esLisa } from './manual/capturas.mjs';
import { allChapters } from './manual/extra.mjs';
import { buildInventory } from './manual/inventario.mjs';
import { findPlaywright, installCommand, ir, launch, soloLectura } from './manual/navegador.mjs';
import { envState, paths, patronesBloqueo, readEnv } from './manual/proyecto.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: {
            target: { type: 'string', default: process.cwd() },
            out: { type: 'string' },
            env: { type: 'string' },
            'playwright-from': { type: 'string' },
            chapter: { type: 'string' },
            'login-manual': { type: 'boolean', default: false },
            bloquear: { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const P = paths(target, args);
const state = envState(P.env);
if (!state.url) fail(3, `Falta MANUAL_URL en ${P.env}: corre init.mjs y llena el archivo.`, { env: P.env });
const env = readEnv(P.env);
const site = state.url.replace(/\/+$/, '');
const bloquear = patronesBloqueo(args.bloquear, env.MANUAL_BLOQUEAR);

const pw = await findPlaywright([args['playwright-from'], target, process.cwd()]);
if (!pw) fail(5, 'Falta playwright-core.', { install: installCommand(args['playwright-from'] ?? target), playwrightFrom: '--playwright-from <carpeta>' });

const inventory = buildInventory(target);
const wanted = toList(args.chapter);
const leer = (id) => (existsSync(P.borrador(id)) ? parseBorrador(readFileSync(P.borrador(id), 'utf8')) : null);
const candidatos = allChapters(inventory, P.root).filter((c) => !wanted.length || wanted.includes(c.id));
const borradores = Object.fromEntries(candidatos.map((c) => [c.id, leer(c.id)]));
const omitidos = candidatos.filter((c) => !incluido(borradores[c.id])).map((c) => c.id);
const chapters = candidatos.filter((c) => !omitidos.includes(c.id));

mkdirSync(P.capturas, { recursive: true });
const shot = (name) => join(P.capturas, name);
const mapa = existsSync(P.mapa) ? JSON.parse(readFileSync(P.mapa, 'utf8')) : { comunes: {}, capitulos: {} };
const avisos = [];

const VIEWPORT = { width: 1440, height: 900 };
const PANTALLA = 900; // alto máximo de la referencia web

// Estilos del admin en las capturas: sin barra superior ni avisos, textos largos bajos, miniaturas chicas y
// sin la ayuda gris de cada campo (la explicación está en el manual).
const ADMIN_CSS = `
    #wpadminbar, .notice, .update-nag, .updated, div.error { display:none !important; }
    html.wp-toolbar { padding-top:0 !important; }
    .acf-field textarea { height:58px !important; min-height:0 !important; }
    .acf-image-uploader .image-wrap img { max-height:110px !important; width:auto !important; }
    .acf-field > .acf-label > .description { display:none !important; }
    .acf-field { padding-top:10px !important; padding-bottom:10px !important; }
    .nerd-num { display:inline-grid; place-items:center; min-width:22px; height:22px; padding:0 6px; margin-right:8px;
        border-radius:11px; background:#000; color:#fff; font:700 12px/1 system-ui; vertical-align:middle; }
    .nerd-num.-sub { background:#fff; color:#000; box-shadow: inset 0 0 0 2px #000; }
`;
// En la web: nada se mueve durante la captura.
const WEB_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }';

let browser;
try {
    ({ browser } = await launch(pw.module));
} catch (e) {
    fail(5, e.message);
}

// ---------- Login ----------
let storageState;
{
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    await soloLectura(ctx, { bloquear });
    const page = await ctx.newPage();
    await ir(page, `${site}/wp-login.php`);
    await page.screenshot({ path: shot('login.png') });
    mapa.comunes.login = 'login.png';
    if (state.filled && !args['login-manual']) {
        await page.fill('#user_login', env.MANUAL_USER);
        await page.fill('#user_pass', env.MANUAL_PASS);
        await Promise.all([page.waitForEvent('framenavigated', { timeout: 30_000 }).catch(() => {}), page.click('#wp-submit')]);
        await page.waitForLoadState('load').catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        if (!new URL(page.url()).pathname.startsWith('/wp-admin')) {
            await browser.close();
            fail(6, 'No se pudo iniciar sesión con los datos de .env.manual (revisa usuario y contraseña; si el login tiene un captcha propio, usa --login-manual).');
        }
        storageState = await ctx.storageState();
    }
    await ctx.close();
}
if (!storageState) {
    // Login a mano: Edge visible; la persona entra y la sesión se usa solo en esta corrida.
    const { browser: visible } = await launch(pw.module, { headless: false });
    const ctx = await visible.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await page.goto(`${site}/wp-login.php`);
    console.error('Inicia sesión en la ventana del navegador (tienes 10 minutos)…');
    try {
        await page.waitForURL((url) => url.pathname.startsWith('/wp-admin'), { timeout: 10 * 60_000 });
    } catch {
        await visible.close(); await browser.close();
        fail(6, 'No se inició sesión a tiempo.');
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    storageState = await ctx.storageState();
    await visible.close();
}

const admin = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, storageState });
await soloLectura(admin, { bloquear });
const front = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: 'reduce' });
await soloLectura(front, { bloquear });

async function abrirAdmin(url) {
    const page = await admin.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await ir(page, url.startsWith('http') ? url : `${site}/wp-admin/${url}`);
    await page.addStyleTag({ content: ADMIN_CSS });
    return page;
}

// ---------- Capturas lisas (un solo color) ----------
let analisis = null; // página en blanco para revisar los JPG en el navegador
async function lisa(file) {
    const path = shot(file);
    if (/\.png$/i.test(file)) return esLisa(path);
    analisis ??= await front.newPage();
    const colores = await analisis.evaluate(DOMINANTE_EN_NAVEGADOR, { b64: readFileSync(path).toString('base64'), mime: 'image/jpeg' }).catch(() => Infinity);
    return colores <= MAX_COLORES_LISA;
}

// Captura un elemento del admin. Si sale lisa (falla de pintado en elementos altos), la repite una vez
// recortando la página completa en la caja del elemento.
async function capturaAdmin(page, locator, file) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.screenshot({ path: shot(file) });
    if (!(await lisa(file))) return { file };
    await locator.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(1000);
    const clip = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.left + scrollX), y: r.top + scrollY, width: r.width, height: r.height };
    });
    await page.screenshot({ path: shot(file), fullPage: true, clip });
    return (await lisa(file)) ? { file, lisa: true } : { file };
}

// Numera los campos dentro de `root` (en el navegador) igual que numberFields() en el acf-json.
async function numerar(page, rootSelector) {
    return page.evaluate((selector) => {
        const SKIP = ['tab', 'accordion', 'message'];
        const root = document.querySelector(selector);
        if (!root) return null;
        const label = (field) => field.querySelector(':scope > .acf-label label');
        const badge = (field, text, sub) => {
            const l = label(field);
            if (!l || l.querySelector('.nerd-num')) return;
            const s = document.createElement('span');
            s.className = `nerd-num${sub ? ' -sub' : ''}`;
            s.textContent = text;
            l.prepend(s);
        };
        const vistos = [];
        const walk = (fields, prefix) => {
            let i = 0;
            for (const field of [...fields.children].filter((n) => n.classList.contains('acf-field'))) {
                if (SKIP.includes(field.dataset.type)) continue;
                i += 1;
                const n = prefix ? `${prefix}.${i}` : String(i);
                vistos.push(n);
                badge(field, n, Boolean(prefix));
                const type = field.dataset.type;
                if (type === 'repeater') {
                    const rows = [...field.querySelectorAll(':scope > .acf-input > .acf-repeater > table > tbody > .acf-row:not(.acf-clone)')];
                    rows.forEach((row, r) => { if (r > 0) row.classList.add('-collapsed'); });
                    const first = rows[0]?.querySelector(':scope > .acf-fields');
                    if (first) walk(first, n);
                } else if (type === 'group') {
                    const inner = field.querySelector(':scope > .acf-input > .acf-fields');
                    if (inner) walk(inner, n);
                }
            }
        };
        // Si el root es un campo `group` (una sección), se numeran sus hijos; si es la caja del grupo, sus campos.
        const fields = root.matches('.acf-field') ? root.querySelector(':scope > .acf-input > .acf-fields') : root.querySelector('.acf-fields');
        if (fields) walk(fields, '');
        return vistos;
    }, rootSelector);
}

// ---------- Web ----------
async function abrirWeb(url) {
    const page = await front.newPage();
    await ir(page, url);
    await page.addStyleTag({ content: WEB_CSS });
    await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
        scrollTo(0, 0);
        // Secciones de primer nivel de <main> (aunque estén dentro de un div), para el selector por posición.
        const tops = [...document.querySelectorAll('main section')].filter((s) => !s.parentElement.closest('main section'));
        tops.forEach((s, i) => { s.dataset.nerdPos = String(i); });
    });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    return page;
}

// Deja el elemento listo para la foto: lo sticky o fixed pasa al flujo normal, lo que una animación de
// entrada dejó invisible (opacidad ~0) se muestra sin desplazamiento, y se esconden los demás elementos
// fijos (header, avisos flotantes). Devuelve la sección que ya había usado ese elemento, si la hay.
function prepararElemento({ sel, seccion }) {
    const el = document.querySelector(sel);
    if (!el) return { falta: true };
    const repetido = el.dataset.nerdCap && el.dataset.nerdCap !== seccion ? el.dataset.nerdCap : null;
    el.dataset.nerdCap = seccion;
    for (const node of document.querySelectorAll('body *')) {
        const pos = getComputedStyle(node).position;
        if ((pos === 'fixed' || pos === 'sticky') && !node.contains(el) && !el.contains(node)) node.style.visibility = 'hidden';
    }
    for (let n = el; n && n !== document.body; n = n.parentElement) if (n.style.visibility === 'hidden') n.style.visibility = '';
    if (['sticky', 'fixed'].includes(getComputedStyle(el).position)) el.style.setProperty('position', 'static', 'important');
    window.nerdMostrar = (raiz) => {
        for (const n of [raiz, ...raiz.querySelectorAll('*')]) {
            if (Number(getComputedStyle(n).opacity) < 0.05) {
                n.style.setProperty('opacity', '1', 'important');
                n.style.setProperty('transform', 'none', 'important');
            }
        }
    };
    window.nerdMostrar(el);
    el.scrollIntoView({ block: 'start' });
    return { repetido };
}

async function fotoWeb(page, locator, file) {
    await locator.evaluate((el) => window.nerdMostrar(el));
    const box = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.left + scrollX), y: r.top + scrollY, width: Math.min(r.width, innerWidth), height: r.height };
    });
    if (box.height < 20) return false;
    if (box.height <= PANTALLA) await locator.screenshot({ path: shot(file), type: 'jpeg', quality: 82 });
    else await page.screenshot({ path: shot(file), type: 'jpeg', quality: 82, fullPage: true, clip: { ...box, height: PANTALLA } });
    return true;
}

async function capturaWeb(page, selector, file, seccion) {
    const prep = await page.evaluate(prepararElemento, { sel: selector, seccion });
    if (prep.falta) return { file: null };
    const locator = page.locator(selector).first();
    await page.waitForTimeout(800);
    if (!(await fotoWeb(page, locator, file))) return { file: null };
    let plana = await lisa(file);
    if (plana) {
        await page.waitForTimeout(1500);
        await fotoWeb(page, locator, file);
        plana = await lisa(file);
    }
    return { file, repetido: prep.repetido, lisa: plana };
}

// Pantalla de edición y dirección pública de una página, desde el enlace "Editar página" de la barra.
async function urlsDePagina(p) {
    let link = `${site}/`;
    if (!p.front) {
        const res = await fetch(`${site}/wp-json/wp/v2/pages?slug=${encodeURIComponent(p.slug)}&_fields=link`).then((r) => r.json()).catch(() => []);
        link = res?.[0]?.link ?? `${site}/${p.slug}/`;
    }
    const page = await admin.newPage();
    await page.goto(link, { waitUntil: 'domcontentloaded' });
    const edit = await page.locator('#wp-admin-bar-edit a').first().getAttribute('href').catch(() => null);
    await page.close();
    return { link, edit };
}

// Selectores a probar para la referencia web de una sección, en orden: el del borrador, el de la
// plantilla (si en la página es uno solo) y la sección de <main> en esa posición.
const OPCIONES_WEB = [[/aviso|anuncio|banner/i, '[data-aviso], .aviso, #aviso'], [/pie|footer/i, 'body > footer, footer'], [/encabezado|header|cabecera|menu/i, 'body > header, header']];
async function selectorWeb(page, chapter, section, i, borrador) {
    const custom = borrador?.sections[section.name]?.web;
    if (custom) return custom;
    if (chapter.kind === 'pagina') {
        if (section.webSelector && (await page.locator(section.webSelector).count().catch(() => 0)) === 1) return section.webSelector;
        return `[data-nerd-pos="${i}"]`;
    }
    if (chapter.kind === 'opciones') return OPCIONES_WEB.find(([re]) => re.test(`${section.name} ${section.label}`))?.[1] ?? null;
    return null;
}

// Primer elemento de una lista del admin (para `#primero` en los capítulos extra).
async function primeroDeLista(url) {
    const list = await abrirAdmin(url);
    const href = await list.locator('#the-list a.row-title, #the-list .row-actions a').first().getAttribute('href').catch(() => null);
    await list.close();
    return href;
}

// ---------- Capítulos ----------
let reglasPage = null; // una pantalla con campos de ACF para las capturas de las reglas generales
for (const chapter of chapters) {
    const borrador = borradores[chapter.id];
    const out = { secciones: {} };
    mapa.capitulos[chapter.id] = out;
    let editUrl = null;
    let webUrl = `${site}/`;

    if (chapter.kind === 'extra') {
        // Capítulo escrito a mano: cada sección dice de dónde sale su captura (o trae una propia).
        if (chapter.admin.llegar) {
            const page = await abrirAdmin(chapter.admin.llegar);
            await page.screenshot({ path: shot(`${chapter.id}-llegar.png`) });
            out.llegar = `${chapter.id}-llegar.png`;
            if (await page.locator('#error-page, .wp-die-message').count()) avisos.push(`${chapter.id}: el usuario de .env.manual no puede ver ${chapter.admin.llegar} (¿hace falta un administrador?). Usa "- **Captura:** <archivo>" en el borrador.`);
            await page.close();
        }
        for (const section of chapter.sections) {
            if (section.captura) {
                if (existsSync(shot(section.captura))) out.secciones[section.name] = { admin: section.captura, web: null, numeros: [] };
                else avisos.push(`${chapter.id} ${section.name}: no está ${section.captura} en ${P.capturas}.`);
                continue;
            }
            if (!section.admin) continue;
            let url = section.admin;
            if (url.endsWith('#primero')) {
                url = await primeroDeLista(url.replace(/#primero$/, ''));
                if (!url) { avisos.push(`${chapter.id} ${section.name}: la lista ${section.admin} está vacía; no hay nada que capturar.`); continue; }
            }
            const page = await abrirAdmin(url);
            const file = `${chapter.id}-${section.name}.png`;
            const locator = section.selector ? page.locator(section.selector).first() : null;
            if (locator && await locator.count()) {
                const r = await capturaAdmin(page, locator, file);
                out.secciones[section.name] = { admin: file, web: null, numeros: [], ...(r.lisa ? { lisa: true } : {}) };
                if (r.lisa) avisos.push(`${chapter.id} ${section.name}: la captura salió lisa (un solo color); vuelve a correr --chapter ${chapter.id}.`);
            } else {
                if (section.selector) avisos.push(`${chapter.id} ${section.name}: no se encontró ${section.selector}; se capturó la pantalla.`);
                await page.screenshot({ path: shot(file) });
                out.secciones[section.name] = { admin: file, web: null, numeros: [] };
            }
            await page.close();
        }
        continue;
    }

    if (chapter.kind === 'pagina') {
        const first = chapter.admin.pages[0];
        if (!first) { avisos.push(`${chapter.id}: no hay página que lo use; sin capturas.`); continue; }
        ({ edit: editUrl, link: webUrl } = await urlsDePagina(first));
        if (!editUrl) { avisos.push(`${chapter.id}: no se encontró la pantalla de edición de "${first.title}".`); continue; }
    } else if (chapter.kind === 'opciones') {
        editUrl = `admin.php?page=${chapter.admin.options}`;
    } else if (chapter.kind === 'contenido') {
        const type = chapter.admin.postType;
        const list = await abrirAdmin(type === 'post' ? 'edit.php' : `edit.php?post_type=${type}`);
        await list.screenshot({ path: shot(`${chapter.id}-llegar.png`) });
        out.llegar = `${chapter.id}-llegar.png`;
        editUrl = await list.locator('#the-list a.row-title').first().getAttribute('href').catch(() => null);
        webUrl = await list.locator('#the-list .row-actions .view a').first().getAttribute('href').catch(() => null);
        await list.close();
        if (!editUrl) { avisos.push(`${chapter.id}: no hay ningún elemento publicado para capturar la pantalla de edición.`); continue; }
    } else if (chapter.kind === 'sitio') {
        for (const section of chapter.sections) {
            const page = await abrirAdmin(section.admin);
            await page.waitForTimeout(1500);
            const file = `${chapter.id}-${section.name}.png`;
            if (section.name === 'identidad') await page.locator('#customize-controls').screenshot({ path: shot(file) }).catch(() => page.screenshot({ path: shot(file) }));
            else await page.screenshot({ path: shot(file) });
            out.secciones[section.name] = { admin: file, web: null, numeros: [] };
            await page.close();
        }
        continue;
    }

    const page = await abrirAdmin(editUrl);
    out.editUrl = page.url();
    if (chapter.kind !== 'contenido') {
        await page.screenshot({ path: shot(`${chapter.id}-llegar.png`) });
        out.llegar = `${chapter.id}-llegar.png`;
    }
    if (!reglasPage && chapter.sections.length) reglasPage = out.editUrl;

    // Campos propios de WordPress (entradas y tipos de contenido).
    if (chapter.kind === 'contenido') {
        const numeros = await page.evaluate((nativos) => {
            const vistos = [];
            for (const n of nativos) {
                const box = document.querySelector(n.selector);
                if (!box || box.offsetParent === null) continue;
                vistos.push(n.n);
                const s = document.createElement('span');
                s.className = 'nerd-num';
                s.textContent = n.n;
                s.style.cssText = 'position:absolute;z-index:10;top:6px;left:6px';
                box.style.position = 'relative';
                box.prepend(s);
            }
            return vistos;
        }, NATIVOS);
        const file = `${chapter.id}-${SECCION_NATIVA}.png`;
        const r = await capturaAdmin(page, page.locator('#poststuff'), file);
        out.secciones[SECCION_NATIVA] = { admin: file, web: null, numeros, ...(r.lisa ? { lisa: true } : {}) };
    }

    for (const section of chapter.sections) {
        const single = section.name === chapter.group;
        const selector = single ? `#acf-${chapter.group}` : `.acf-postbox .acf-field[data-name="${section.name}"]`;
        const numeros = await numerar(page, selector);
        if (!numeros) { avisos.push(`${chapter.id} ${section.name}: no se encontró en la pantalla de edición.`); continue; }
        const file = `${chapter.id}-${section.name}.png`;
        const r = await capturaAdmin(page, page.locator(selector).first(), file);
        out.secciones[section.name] = { admin: file, web: null, numeros, ...(r.lisa ? { lisa: true } : {}) };
        if (r.lisa) avisos.push(`${chapter.id} ${section.name}: la captura del admin salió lisa (un solo color) aun después de repetirla; vuelve a correr --chapter ${chapter.id}.`);
    }
    await page.close();

    // Referencia web de cada sección (y de la entrada, en un contenido).
    if (webUrl) {
        const web = await abrirWeb(webUrl);
        const usar = (name, r, selector) => {
            out.secciones[name].web = r.file;
            if (r.lisa) { out.secciones[name].webLisa = true; avisos.push(`${chapter.id} ${name}: la captura web salió lisa (${selector}); revisa la animación de la sección o usa otro "- **Web:**".`); }
            if (r.repetido) avisos.push(`${chapter.id} ${name}: la captura web es el mismo elemento que la sección "${r.repetido}" (${selector}); usa "- **Web:** <selector>" en el borrador.`);
        };
        if (chapter.kind === 'contenido' && out.secciones[SECCION_NATIVA]) {
            const selector = borrador?.sections[SECCION_NATIVA]?.web || 'main, article, body';
            usar(SECCION_NATIVA, await capturaWeb(web, selector, `${chapter.id}-${SECCION_NATIVA}-web.jpg`, SECCION_NATIVA), selector);
        }
        for (const [i, section] of chapter.sections.entries()) {
            if (!out.secciones[section.name]) continue;
            const selector = await selectorWeb(web, chapter, section, i, borrador);
            if (!selector) continue;
            usar(section.name, await capturaWeb(web, selector, `${chapter.id}-${section.name}-web.jpg`, section.name), selector);
            if (!out.secciones[section.name].web) avisos.push(`${chapter.id} ${section.name}: no se encontró la sección en la web (${selector}); usa "- **Web:** <selector>" en el borrador.`);
        }
        await web.close();
    }
}

// ---------- Reglas generales ----------
if (reglasPage) {
    const page = await abrirAdmin(reglasPage);
    await page.evaluate(() => { scrollTo(0, 0); const b = document.querySelector('#publish'); if (b) b.style.cssText += ';outline:4px solid #000;outline-offset:4px'; });
    if (await page.locator('#submitdiv').count()) {
        await page.locator('#submitdiv').screenshot({ path: shot('regla-actualizar.png') });
        mapa.comunes.actualizar = 'regla-actualizar.png';
    }
    const req = page.locator('.acf-field.is-required[data-type="text"]:visible').first();
    if (await req.count()) {
        await req.evaluate((field) => {
            field.querySelector('input').value = '';
            field.classList.add('acf-error');
            const name = field.querySelector(':scope > .acf-label label').textContent.replace(/\s*\*\s*$/, '').trim();
            const notice = document.createElement('div');
            notice.className = 'acf-notice -error acf-error-message';
            notice.innerHTML = `<p>El campo ${name} es obligatorio</p>`;
            field.querySelector(':scope > .acf-input').prepend(notice);
        });
        await req.scrollIntoViewIfNeeded();
        await req.screenshot({ path: shot('regla-obligatorio.png') });
        mapa.comunes.obligatorio = 'regla-obligatorio.png';
    }
    const rep = page.locator('.acf-field[data-type="repeater"]:visible').filter({ has: page.locator('.acf-row:not(.acf-clone)') }).first();
    if (await rep.count()) {
        await rep.evaluate((field) => field.querySelectorAll('.acf-row:not(.acf-clone)').forEach((row) => row.classList.add('-collapsed')));
        await rep.scrollIntoViewIfNeeded();
        await rep.locator('.acf-row:not(.acf-clone)').first().hover();
        await rep.screenshot({ path: shot('regla-filas.png') });
        mapa.comunes.filas = 'regla-filas.png';
    }
    const img = page.locator('.acf-field[data-type="image"]:visible').filter({ has: page.locator('.image-wrap img:visible') }).first();
    if (await img.count()) {
        await img.scrollIntoViewIfNeeded();
        await img.locator('.image-wrap img').first().hover({ force: true, timeout: 5000 }).catch(() => {});
        await img.evaluate((f) => f.querySelector('.acf-image-uploader')?.classList.add('-hover'));
        await img.screenshot({ path: shot('regla-imagen.png') });
        mapa.comunes.imagen = 'regla-imagen.png';
    }
    await page.close();
} else if (chapters.some((c) => c.sections.length && c.kind !== 'extra' && c.kind !== 'sitio')) {
    avisos.push('No hay ninguna pantalla con campos de ACF para las capturas de las reglas generales.');
}

await browser.close();
mapa.fecha = new Date().toISOString();
mapa.sitio = site;
writeFileSync(P.mapa, JSON.stringify(mapa, null, 2));
console.log(JSON.stringify({ ok: true, capturas: P.capturas, capitulos: chapters.map((c) => c.id), omitidos, avisos }, null, 2));
