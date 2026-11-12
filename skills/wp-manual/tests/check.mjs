#!/usr/bin/env node
// Prueba de wp-manual. Sin navegador ni dependencias: inventario, numeración, .env.manual, borradores,
// reglas de check.mjs y el HTML de los dos formatos (build.mjs --html-only).
//
// Uso: node skills/wp-manual/tests/check.mjs
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { flatten, numberFields, readAcfJson, sectionsOf } from '../scripts/manual/acf.mjs';
import { PENDIENTE, incluido, inline, parseBorrador, skeleton } from '../scripts/manual/borrador.mjs';
import { esLisa } from '../scripts/manual/capturas.mjs';
import { loadExtras } from '../scripts/manual/extra.mjs';
import { buildInventory, selectorDePlantilla } from '../scripts/manual/inventario.mjs';
import { envState } from '../scripts/manual/proyecto.mjs';
import { checkChapter } from '../scripts/manual/reglas.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(skillDir, 'tests', 'fixtures', 'tema');
const tmp = mkdtempSync(join(tmpdir(), 'wp-manual-'));
let passed = 0;
const test = (name, fn) => {
    try {
        fn();
        passed++;
        console.log(`ok   ${name}`);
    } catch (e) {
        console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
        process.exitCode = 1;
    }
};
let copies = 0;
const theme = () => {
    const dir = join(tmp, `tema-${++copies}`);
    cpSync(fixture, dir, { recursive: true });
    return dir;
};
const run = (script, args, cwd) => {
    const r = spawnSync(process.execPath, [join(skillDir, 'scripts', script), ...args], { cwd, encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* sin JSON */ }
    return { code: r.status, json, stdout: r.stdout + r.stderr };
};
const fillEnv = (path) => writeFileSync(path, readFileSync(path, 'utf8').replace('MANUAL_URL=', 'MANUAL_URL=http://demo.local'));
const CAPITULOS = ['opciones-ajustes', 'pagina-home', 'pagina-servicio', 'contenido-noticia', 'sitio'];

// PNG RGB de w × h px; `pixel(x, y)` devuelve [r, g, b].
function png(path, w, h, pixel) {
    const crc = (buf) => {
        let c = ~0;
        for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
        return ~c >>> 0;
    };
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
        const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
        return Buffer.concat([len, td, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3);
    writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// Manual listo para build --html-only: init, URL y textos válidos en todos los borradores.
function preparado() {
    const dir = theme();
    run('init.mjs', [], dir);
    fillEnv(join(dir, '.env.manual'));
    run('init.mjs', [], dir);
    const manual = join(dir, 'specs', 'manual');
    for (const id of CAPITULOS) redactar(dir, id, join(manual, `${id}.md`));
    return { dir, manual };
}

// Texto válido para cada número según el campo (imagen, resaltado o normal).
function redactar(dir, chapterId, borradorPath) {
    const chapter = buildInventory(dir).chapters.find((c) => c.id === chapterId);
    const campos = new Map(chapter.sections.flatMap((s) => flatten(s.fields)).map((f) => [f.n, f]));
    const text = readFileSync(borradorPath, 'utf8').split('\n').map((line) => {
        if (line.startsWith('- **Resumen:** PENDIENTE')) return '- **Resumen:** Qué se ve en esta parte.';
        const m = /^- \*\*([\w.]+)\*\* (.+?) — PENDIENTE$/.exec(line);
        if (!m) return line;
        const f = campos.get(m[1]);
        let texto = 'Texto de esta parte.';
        if (f && ['image', 'gallery'].includes(f.type)) texto = 'Foto. Recomendado: hasta 2000 px en el lado más largo, horizontal.';
        if (f?.highlight) texto = 'Párrafo. Puedes resaltar palabras entre **\\*asteriscos\\***.';
        return `- **${m[1]}** ${m[2]} — ${texto}`;
    }).join('\n');
    writeFileSync(borradorPath, text);
}

try {
    test('numeración: salta pestañas y mensajes; listas dentro de listas', () => {
        const acf = readAcfJson(join(fixture, 'acf-json'));
        const home = acf.groups.find((g) => g.key === 'group_home');
        const [hero, lista] = sectionsOf(home);
        assert.deepEqual(flatten(hero.fields).map((f) => f.n), ['1', '2', '3', '4', '4.1', '4.2']);
        assert.deepEqual(flatten(lista.fields).map((f) => `${f.n} ${f.label}`), ['1 Título', '2 Items', '2.1 Nombre', '2.2 Puntos', '2.2.1 Texto']);
        assert.equal(flatten(hero.fields)[0].required, true);
        assert.ok(!acf.groups.some((g) => g.key === 'group_inactivo'), 'los grupos inactivos no cuentan');
    });

    test('numeración: un grupo sin secciones es una sola sección', () => {
        const acf = readAcfJson(join(fixture, 'acf-json'));
        const sections = sectionsOf(acf.groups.find((g) => g.key === 'group_noticia'));
        assert.equal(sections.length, 1);
        assert.equal(sections[0].name, 'group_noticia');
        assert.deepEqual(numberFields([{ type: 'tab' }, { type: 'text', label: 'A' }]).map((f) => f.n), ['1']);
    });

    test('inventario: capítulos, orden, páginas compartidas y lo que no se cubre', () => {
        const inv = buildInventory(fixture);
        assert.equal(inv.prefix, 'demo');
        assert.deepEqual(inv.chapters.map((c) => c.id), ['opciones-ajustes', 'pagina-home', 'pagina-servicio', 'contenido-noticia', 'sitio']);
        const servicio = inv.chapters.find((c) => c.id === 'pagina-servicio');
        assert.equal(servicio.shared, true);
        assert.deepEqual(servicio.pages, ['Servicio A', 'Servicio B']);
        assert.equal(inv.chapters.find((c) => c.id === 'opciones-ajustes').where, 'Ajustes del sitio');
        assert.equal(inv.chapters.find((c) => c.id === 'contenido-noticia').title, 'Noticias');
        assert.deepEqual(inv.chapters.find((c) => c.id === 'sitio').sections.map((s) => s.name), ['menus', 'identidad']);
        const sin = inv.uncovered.map((u) => u.name);
        for (const name of ['Vacía', 'Huérfana', 'Categoría']) assert.ok(sin.includes(name), `falta "${name}" en lo no cubierto: ${sin.join(', ')}`);
    });

    test('inventario: el resaltado sale de <prefijo>_highlight en la plantilla (también por variable)', () => {
        const home = buildInventory(fixture).chapters.find((c) => c.id === 'pagina-home');
        const hero = flatten(home.sections.find((s) => s.name === 'home_hero').fields);
        assert.equal(hero.find((f) => f.name === 'descripcion').highlight, true);
        assert.equal(hero.find((f) => f.name === 'titulo').highlight, false);
    });

    test('borrador: el esqueleto se lee de vuelta y conserva los textos al regenerarlo', () => {
        const home = buildInventory(fixture).chapters.find((c) => c.id === 'pagina-home');
        const text = skeleton(home);
        const b = parseBorrador(text);
        assert.equal(b.title, 'Inicio');
        assert.equal(b.llegar.length, 3);
        assert.equal(b.sections.home_hero.textos.get('4.1'), PENDIENTE);
        const edited = text.replace('- **1** Título * — PENDIENTE', '- **1** Título * — Título grande de la portada.');
        const again = skeleton(home, parseBorrador(edited));
        assert.match(again, /- \*\*1\*\* Título \* — Título grande de la portada\./);
        assert.equal(inline('Usa **Actualizar** y `*x*` <b>'), 'Usa <b>Actualizar</b> y <code>*x*</code> &lt;b&gt;');
    });

    test('borrador: los escapes de Markdown se ven tal cual y no abren negrita', () => {
        assert.equal(inline('Entre **\\*asteriscos\\*** y **\\|barras\\|**'), 'Entre <b>*asteriscos*</b> y <b>|barras|</b>');
        assert.equal(inline('\\*no es negrita\\* ni \\~esto\\~'), '*no es negrita* ni ~esto~');
    });

    test('borrador: "Cómo llegar" de una página nombra el botón Editar', () => {
        const inv = buildInventory(fixture);
        for (const id of ['pagina-home', 'pagina-servicio']) {
            const b = parseBorrador(skeleton(inv.chapters.find((c) => c.id === id)));
            assert.equal(b.llegar.length, 3);
            assert.match(b.llegar[1], /haz clic en \*\*Editar\*\* \(aparece al pasar el mouse sobre el nombre\)/);
        }
    });

    test('borrador: "Incluir: no" quita el capítulo y se conserva al regenerar', () => {
        const sitio = buildInventory(fixture).chapters.find((c) => c.id === 'sitio');
        const text = skeleton(sitio).replace('- **Estado:** pendiente', '- **Estado:** pendiente\n- **Incluir:** no');
        const b = parseBorrador(text);
        assert.equal(incluido(b), false);
        assert.equal(incluido(parseBorrador(skeleton(sitio))), true);
        assert.equal(incluido(parseBorrador(skeleton(sitio, b))), false, 'init.mjs no lo pierde');
    });

    test('inventario: selector web desde la plantilla (id, data-, clase) y envíos de wp-form', () => {
        const home = buildInventory(fixture).chapters.find((c) => c.id === 'pagina-home');
        assert.equal(home.sections.find((s) => s.name === 'home_hero').webSelector, '#hero');
        const files = (html) => [{ code: `<?php $x = get_field('sec') ?: []; ?>\n${html}` }];
        assert.equal(selectorDePlantilla(files('<aside data-indice class="sticky top-0">'), 'sec'), 'aside[data-indice]');
        assert.equal(selectorDePlantilla(files('<section data-seccion="faq">'), 'sec'), 'section[data-seccion="faq"]');
        assert.equal(selectorDePlantilla(files('<section class="relative portada">'), 'sec'), 'section.portada');
        assert.equal(selectorDePlantilla(files('<section>'), 'sec'), null);
        assert.deepEqual(buildInventory(fixture).envios, { postType: 'demo_envio' });
    });

    test('capturas: una imagen de un solo color es lisa; con texto no', () => {
        const lisa = join(tmp, 'lisa.png');
        const texto = join(tmp, 'texto.png');
        png(lisa, 300, 200, () => [240, 240, 241]);
        png(texto, 300, 200, (x, y) => ((y % 20 < 3 && x % 7 < 4) ? [x % 255, 40, 90] : [255, 255, 255]));
        assert.equal(esLisa(lisa), true);
        assert.equal(esLisa(texto), false);
        assert.equal(esLisa(join(skillDir, 'assets', 'marca', 'logo-nerd-negro.png')), false);
    });

    test('borrador: un contenido empieza con los campos de WordPress', () => {
        const noticia = buildInventory(fixture).chapters.find((c) => c.id === 'contenido-noticia');
        const b = parseBorrador(skeleton(noticia));
        assert.deepEqual(Object.keys(b.sections), ['wordpress', 'group_noticia']);
        assert.deepEqual([...b.sections.wordpress.textos.keys()], ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']);
        const sitio = parseBorrador(skeleton(buildInventory(fixture).chapters.find((c) => c.id === 'sitio')));
        assert.notEqual(sitio.sections.menus.resumen, PENDIENTE, 'menús y logo traen su texto');
    });

    test('reglas: pendientes, caracteres, imágenes y resaltado', () => {
        const home = buildInventory(fixture).chapters.find((c) => c.id === 'pagina-home');
        const base = skeleton(home);
        const msg = (text) => checkChapter(home, parseBorrador(text), 'x.md');
        assert.ok(msg(base).errors.some((e) => /falta el texto/.test(e.message)));
        const line = (n, label, texto) => [new RegExp(`- \\*\\*${n.replace('.', '\\.')}\\*\\* ${label}( \\*)? — PENDIENTE`), `- **${n}** ${label}$1 — ${texto}`];
        const apply = (text, ...pairs) => pairs.reduce((t, [re, to]) => t.replace(re, to), text);
        const r = msg(apply(base,
            line('1', 'Título', 'Título. Recomendado: ~30 caracteres'),
            line('3', 'Imagen', 'Foto de 1920 × 1080 px'),
            line('4.2', 'Texto alternativo', 'Puedes resaltar con *asteriscos*.'),
            line('2', 'Descripción', 'Párrafo.')));
        const errores = r.errors.map((e) => e.message).join('\n');
        assert.match(errores, /home_hero 1: no se recomienda cantidad de caracteres/);
        assert.match(errores, /home_hero 3 \(imagen\)/);
        assert.match(errores, /home_hero 4\.2: este campo no acepta resaltado/);
        assert.ok(r.warnings.some((w) => /home_hero 2: la plantilla resalta/.test(w.message)));
    });

    test('init: crea .env.manual vacío, lo agrega a .gitignore y espera', () => {
        const dir = theme();
        const first = run('init.mjs', [], dir);
        assert.equal(first.code, 4, first.stdout);
        assert.equal(first.json.waiting, true);
        assert.ok(existsSync(join(dir, '.env.manual')));
        assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^\.env\.manual$/m);
        assert.ok(!existsSync(join(dir, 'specs', 'manual')), 'no escribe borradores antes de tener la URL');
        const second = run('init.mjs', [], dir);
        assert.equal(second.code, 4, 'sin MANUAL_URL sigue esperando');
        assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8').match(/\.env\.manual/g).length, 1, 'no repite la línea');
    });

    test('init: con la URL crea _manual.md, los borradores y el bloque de CLAUDE.md; no pisa .env.manual', () => {
        const dir = theme();
        run('init.mjs', [], dir);
        fillEnv(join(dir, '.env.manual'));
        assert.equal(envState(join(dir, '.env.manual')).manualLogin, true, 'sin usuario: login a mano');
        const r = run('init.mjs', [], dir);
        assert.equal(r.code, 0, r.stdout);
        assert.match(readFileSync(join(dir, '.env.manual'), 'utf8'), /MANUAL_URL=http:\/\/demo\.local/);
        for (const id of CAPITULOS) assert.ok(existsSync(join(dir, 'specs', 'manual', `${id}.md`)), id);
        const datos = readFileSync(join(dir, 'specs', 'manual', '_manual.md'), 'utf8');
        assert.match(datos, /- \*\*Cliente:\*\* Demo/);
        assert.match(datos, /- \*\*Fecha:\*\*\s*$/m, 'la fecha queda vacía');
        assert.ok(existsSync(join(dir, 'specs', 'manual', 'extra-envios.md')), 'el tema guarda envíos: crea extra-envios.md');
        assert.ok(r.json.propuestas.some((p) => /Envíos de formularios/.test(p)));
        const extras = loadExtras(join(dir, 'specs', 'manual'));
        assert.deepEqual(extras.map((c) => c.id), ['extra-envios']);
        assert.deepEqual(extras[0].sections.map((s) => s.name), ['listado', 'detalle', 'notas']);
        assert.equal(extras[0].sections[1].admin, 'edit.php?post_type=demo_envio#primero');
        assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /<!-- wp-manual:start -->/);
        const again = run('init.mjs', [], dir);
        assert.equal(again.json.unchanged.length, 5, 'volver a correrlo no cambia nada');
    });

    test('init/status con --out y --env no escriben nada en el tema', () => {
        const dir = theme();
        const out = join(tmp, 'fuera');
        const env = join(out, '.env.manual');
        assert.equal(run('init.mjs', ['--out', out, '--env', env], dir).code, 4);
        fillEnv(env);
        assert.equal(run('init.mjs', ['--out', out, '--env', env], dir).code, 0);
        assert.ok(existsSync(join(out, 'pagina-home.md')));
        assert.ok(!existsSync(join(dir, '.env.manual')) && !existsSync(join(dir, '.gitignore')) && !existsSync(join(dir, 'specs')));
        assert.doesNotMatch(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /wp-manual/);
        const s = run('status.mjs', ['--out', out, '--env', env], dir);
        assert.equal(s.code, 0, s.stdout);
        assert.ok(s.json.chapters.filter((c) => CAPITULOS.includes(c.id) && c.id !== 'sitio').every((c) => /pendientes/.test(c.borrador)));
        assert.equal(s.json.chapters.find((c) => c.id === 'extra-envios').borrador, 'redactado', 'envíos viene redactado');
        assert.equal(s.json.chapters.find((c) => c.id === 'sitio').borrador, 'redactado', 'menús y logo vienen redactados');
        assert.ok(s.json.next.some((n) => /Redactar/.test(n)));
    });

    test('check y build --html-only: con errores solo el reporte; redactado, los dos formatos', () => {
        const dir = theme();
        run('init.mjs', [], dir);
        fillEnv(join(dir, '.env.manual'));
        run('init.mjs', [], dir);
        const manual = join(dir, 'specs', 'manual');
        assert.equal(run('check.mjs', [], dir).code, 1);
        const conErrores = run('build.mjs', ['--html-only'], dir);
        assert.equal(conErrores.code, 1, conErrores.stdout);
        assert.ok(existsSync(join(manual, 'salida', 'reporte.html')) && !existsSync(join(manual, 'salida', 'manual-vertical.html')));

        for (const id of CAPITULOS) redactar(dir, id, join(manual, `${id}.md`));
        const c = run('check.mjs', [], dir);
        assert.equal(c.code, 0, c.stdout);
        assert.ok(c.json.warnings.some((w) => /Sin cubrir: página «Huérfana»/.test(w.message)));
        const b = run('build.mjs', ['--html-only'], dir);
        assert.equal(b.code, 0, b.stdout);
        const h = readFileSync(join(manual, 'salida', 'manual-horizontal.html'), 'utf8');
        const v = readFileSync(join(manual, 'salida', 'manual-vertical.html'), 'utf8');
        assert.match(h, /size: 1920px 1080px/);
        assert.match(v, /size: 1240px 1754px/);
        for (const html of [h, v]) {
            assert.match(html, /<b>Inicio · 01 Hero<\/b>/);
            assert.match(html, /Estas páginas usan las mismas secciones: <b>Servicio A<\/b>, <b>Servicio B<\/b>/);
            assert.match(html, /<span class="badge -sub">2\.2\.1<\/span>/);
            assert.match(html, /Sin captura/);
            assert.match(html, /archivo-black\.woff2/);
        }
        const indice = /<div class="indice">([\s\S]*?)<\/div><\/section>/.exec(h)[1];
        assert.doesNotMatch(indice, /Hero/, 'el índice solo lleva las partes principales');
        assert.match(readFileSync(join(manual, 'salida', 'reporte.html'), 'utf8'), /Huérfana/);
        assert.match(b.json.recordatorio, /borra .*\.env\.manual/);
        // Portada sin fecha ni razón social: sin línea vacía. Regla fija de lo que no se edita. Envíos al final.
        assert.doesNotMatch(h, /class="sub"/);
        assert.match(h, /Lo que no se edita en cada página/);
        assert.match(h, /se editan una sola vez en <b>Ajustes del sitio<\/b>/);
        assert.match(indice, /Envíos de formularios/);
        assert.ok(h.indexOf('Envíos de formularios') > h.indexOf('Menús y logo'), 'los extras van al final');
        assert.match(h, /"juntar":false/);
    });

    test('build --html-only: fecha opcional, --juntar e "Incluir: no"', () => {
        const { dir, manual } = preparado();
        writeFileSync(join(manual, '_manual.md'), readFileSync(join(manual, '_manual.md'), 'utf8').replace(/- \*\*Fecha:\*\*.*/, '- **Fecha:** Noviembre 2026'));
        const sitio = join(manual, 'sitio.md');
        writeFileSync(sitio, readFileSync(sitio, 'utf8').replace(/(- \*\*Estado:\*\*.*)/, '$1\n- **Incluir:** no'));
        const c = run('check.mjs', [], dir);
        assert.equal(c.code, 0, c.stdout);
        assert.deepEqual(c.json.omitidos, ['sitio']);
        const b = run('build.mjs', ['--html-only', '--juntar', '--formato', 'ambos'], dir);
        assert.equal(b.code, 0, b.stdout);
        assert.match(b.json.avisoJuntar, /solo .*horizontal/);
        const h = readFileSync(join(manual, 'salida', 'manual-horizontal.html'), 'utf8');
        const v = readFileSync(join(manual, 'salida', 'manual-vertical.html'), 'utf8');
        assert.match(h, /<p class="sub">Noviembre 2026<\/p>/, 'sin razón social, sin <br> de más');
        assert.doesNotMatch(h, /Menús y logo/);
        assert.match(h, /"juntar":true/);
        assert.match(v, /"juntar":false/);
        assert.match(readFileSync(join(manual, 'salida', 'reporte.html'), 'utf8'), /omitido \(Incluir: no\)/);
    });

    test('check: capturas lisas, solapes de build y una nota repetida', () => {
        const { dir, manual } = preparado();
        const capturas = join(manual, 'capturas');
        mkdirSync(capturas, { recursive: true });
        png(join(capturas, 'pagina-home-home_hero.png'), 200, 100, () => [200, 200, 200]);
        writeFileSync(join(capturas, 'mapa.json'), JSON.stringify({ comunes: {}, capitulos: { 'pagina-home': { secciones: { home_hero: { admin: 'pagina-home-home_hero.png', web: null, numeros: ['1', '2', '3', '4', '4.1', '4.2'] } } } } }));
        mkdirSync(join(manual, 'salida'), { recursive: true });
        writeFileSync(join(manual, 'salida', 'revision-horizontal.json'), JSON.stringify({ paginas: 20, solapes: [{ pagina: 12, titulo: 'Inicio · 01 Hero', problema: 'la imagen x.png se monta sobre el texto (campos)' }] }));
        for (const id of ['pagina-home', 'pagina-servicio', 'opciones-ajustes']) {
            const path = join(manual, `${id}.md`);
            writeFileSync(path, readFileSync(path, 'utf8').replace(/(## Cómo llegar\n\n(?:\d+\..*\n)+)/, '$1\n> Las migas de pan son fijas.\n'));
        }
        const c = run('check.mjs', [], dir);
        assert.equal(c.code, 1, c.stdout);
        const errores = c.json.errors.map((e) => e.message).join('\n');
        assert.match(errores, /home_hero: la captura del admin .* es de un solo color/);
        assert.match(errores, /Pág\. 12 .*se monta sobre el texto/);
        assert.ok(c.json.warnings.some((w) => /se repite en 3 capítulos/.test(w.message)));
    });
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallos' : ''}.`);
