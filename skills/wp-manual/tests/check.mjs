#!/usr/bin/env node
// Prueba de wp-manual. Sin navegador ni dependencias: inventario, numeración, .env.manual, borradores,
// reglas de check.mjs y el HTML de los dos formatos (build.mjs --html-only).
//
// Uso: node skills/wp-manual/tests/check.mjs
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flatten, numberFields, readAcfJson, sectionsOf } from '../scripts/manual/acf.mjs';
import { PENDIENTE, inline, parseBorrador, skeleton } from '../scripts/manual/borrador.mjs';
import { buildInventory } from '../scripts/manual/inventario.mjs';
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
        for (const id of ['opciones-ajustes', 'pagina-home', 'pagina-servicio', 'contenido-noticia', 'sitio']) assert.ok(existsSync(join(dir, 'specs', 'manual', `${id}.md`)), id);
        assert.match(readFileSync(join(dir, 'specs', 'manual', '_manual.md'), 'utf8'), /- \*\*Cliente:\*\* Demo/);
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
        assert.ok(s.json.chapters.filter((c) => c.id !== 'sitio').every((c) => /pendientes/.test(c.borrador)));
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

        for (const id of ['opciones-ajustes', 'pagina-home', 'pagina-servicio', 'contenido-noticia', 'sitio']) redactar(dir, id, join(manual, `${id}.md`));
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
    });
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallos' : ''}.`);
