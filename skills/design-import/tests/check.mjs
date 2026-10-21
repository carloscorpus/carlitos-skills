#!/usr/bin/env node
// Prueba de design-import: analyze, init y check contra fixtures. Sin dependencias.
//
// Uso: node skills/design-import/tests/check.mjs
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(skillDir, 'tests', 'fixtures');
const script = (name) => join(skillDir, 'scripts', name);

const run = (name, args) => {
    const result = spawnSync(process.execPath, [script(name), ...args], { encoding: 'utf8' });
    let json = null;
    try {
        json = JSON.parse(result.stdout);
    } catch {
        // la salida no era JSON: el assert que la use lo mostrará
    }
    return { code: result.status, json, stdout: result.stdout, stderr: result.stderr };
};

const tmp = mkdtempSync(join(tmpdir(), 'design-import-'));
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

try {
    // ---------- analyze ----------
    const source = join(fixtures, 'fuente');
    const analysis = run('analyze.mjs', ['--source', source]);

    test('analyze: sale 0 y devuelve JSON', () => {
        assert.equal(analysis.code, 0, analysis.stderr);
        assert.equal(analysis.json.ok, true);
        assert.equal(analysis.json.summary.pages, 2);
    });

    test('analyze: detecta las malas prácticas conocidas', () => {
        const ids = new Set(analysis.json.findings.map((f) => f.id));
        for (const id of [
            'inline-style', 'inline-style-tag', 'inline-script', 'inline-handler', 'clickable-non-interactive',
            'img-no-alt', 'link-placeholder', 'input-no-label', 'heading-skip', 'h1-count', 'html-no-lang',
            'no-viewport', 'important', 'id-selector', 'deep-selector', 'fixed-height', 'duplicate-declarations',
            'jquery', 'inner-html', 'alert', 'console-log', 'var-declaration', 'global-function',
        ]) assert.ok(ids.has(id), `falta el hallazgo ${id}`);
    });

    test('analyze: las páginas bien hechas no generan falsos positivos', () => {
        const byId = Object.fromEntries(analysis.json.findings.map((f) => [f.id, f]));
        assert.equal(byId['html-no-lang'].count, 1, 'solo index.html no tiene lang');
        assert.equal(byId['no-viewport'].count, 1, 'solo index.html no tiene viewport');
        assert.equal(byId['img-no-alt'].count, 1);
        assert.equal(byId['broken-reference'], undefined, 'todas las referencias del fixture existen');
    });

    test('analyze: bloques repetidos (cards en la página, header y footer entre páginas)', () => {
        const cards = analysis.json.repeated.find((g) => g.tag === 'div' && g.classes.includes('card'));
        assert.ok(cards && cards.count === 3 && cards.kind === 'in-page', 'faltan las 3 cards');
        const header = analysis.json.repeated.find((g) => g.tag === 'header');
        assert.ok(header && header.kind === 'cross-page', 'falta el header compartido');
        assert.ok(analysis.json.repeated.find((g) => g.tag === 'footer'), 'falta el footer compartido');
    });

    test('analyze: interacciones y skill sugerida', () => {
        const byType = Object.fromEntries(analysis.json.interactions.map((i) => [i.type, i]));
        assert.equal(byType.form.suggestedSkill, 'wp-form');
        assert.equal(byType.form.fields.length, 2);
        assert.equal(byType.modal.suggestedSkill, 'wp-modal');
        assert.equal(byType.accordion.suggestedSkill, 'wp-accordion');
        assert.equal(analysis.json.interactions.filter((i) => i.type === 'accordion').length, 1, 'un acordeón es una sola interacción');
    });

    test('analyze: tokens normalizados y secciones', () => {
        const colors = Object.fromEntries(analysis.json.tokens.colors.map((c) => [c.value, c.count]));
        assert.equal(colors['#ff6600'], 3);
        assert.equal(colors['#333333'], 3, '#333 se normaliza a #333333');
        assert.ok(analysis.json.tokens.variables.some((v) => v.name === '--brand'));
        const home = analysis.json.pages.find((p) => p.file === 'index.html');
        assert.equal(home.sections.length, 6);
        assert.equal(home.sections[1].headings[0].text, 'Hola mundo');
        assert.ok(home.sections[1].texts.some((t) => t.text === 'Texto del hero.'));
    });

    test('analyze: error si falta la fuente o --out cae dentro de ella', () => {
        assert.equal(run('analyze.mjs', []).code, 1);
        assert.equal(run('analyze.mjs', ['--source', source, '--out', join(source, 'x.json')]).code, 1);
        assert.equal(existsSync(join(source, 'x.json')), false);
    });

    // ---------- init ----------
    const theme = join(tmp, 'tema');
    mkdirSync(theme);
    writeFileSync(join(theme, 'style.css'), '/*\nTheme Name: Demo\n*/\n');
    writeFileSync(join(theme, 'functions.php'), '<?php\n');
    writeFileSync(join(theme, 'CLAUDE.md'), '# Demo\n');

    test('init: dry-run no escribe nada', () => {
        const r = run('init.mjs', ['--target', theme, '--dry-run']);
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.create, ['specs/_index.md', 'specs/_shared.md']);
        assert.equal(existsSync(join(theme, 'specs')), false);
    });

    test('init: crea specs/ y el bloque en CLAUDE.md', () => {
        const r = run('init.mjs', ['--target', theme]);
        assert.equal(r.code, 0, r.stdout);
        assert.ok(existsSync(join(theme, 'specs/_index.md')));
        assert.match(readFileSync(join(theme, 'CLAUDE.md'), 'utf8'), /<!-- design-import:start -->[\s\S]*specs\/[\s\S]*<!-- design-import:end -->/);
    });

    test('init: un segundo init es conflicto (2) y no pisa', () => {
        const r = run('init.mjs', ['--target', theme]);
        assert.equal(r.code, 2);
        assert.deepEqual(r.json.unresolved.sort(), ['specs/_index.md', 'specs/_shared.md']);
    });

    test('init --page: crea el spec y agrega la fila una sola vez', () => {
        const args = ['--target', theme, '--page', 'sobre-nosotros', '--title', 'Sobre nosotros', '--source', 'nosotros.html', '--template', 'pages/template-sobre-nosotros.php'];
        const r = run('init.mjs', args);
        assert.equal(r.code, 0, r.stdout);
        assert.ok(existsSync(join(theme, 'specs/sobre-nosotros.md')));
        const again = run('init.mjs', [...args, '--overwrite', 'specs/sobre-nosotros.md']);
        assert.equal(again.code, 0, again.stdout);
        const index = readFileSync(join(theme, 'specs/_index.md'), 'utf8');
        assert.equal(index.match(/\(sobre-nosotros\.md\)/g).length, 1);
        assert.equal(run('init.mjs', ['--target', theme, '--page', 'Sobre Nosotros', '--title', 't', '--source', 's', '--template', 'p']).code, 1);
    });

    test('check: una página recién creada (sin secciones) pasa', () => {
        const r = run('check.mjs', ['--target', theme]);
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.pages, 1);
    });

    // ---------- check ----------
    const ok = join(fixtures, 'tema-ok');
    test('check: el tema de ejemplo pasa', () => {
        const r = run('check.mjs', ['--target', ok]);
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.fields, 3);
        assert.deepEqual(r.json.warnings, []);
    });

    const broken = (name, edit) => {
        const dir = join(tmp, name);
        cpSync(ok, dir, { recursive: true });
        edit(dir);
        return run('check.mjs', ['--target', dir]);
    };
    const edit = (file, from, to) => (dir) => {
        const path = join(dir, file);
        const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); // Windows puede traer los fixtures con CRLF
        assert.ok(text.includes(from), `el fixture ya no contiene "${from}"`);
        writeFileSync(path, text.replace(from, to));
    };
    const messages = (r) => r.json.errors.map((e) => e.message).join('\n');

    test('check: nombre de campo fuera de la nomenclatura', () => {
        const r = broken('nombre', edit('specs/home.md', '`home_hero_titulo`', '`Titulo`'));
        assert.equal(r.code, 4);
        assert.match(messages(r), /Nombre de campo inválido/);
    });

    test('check: campo con otra página como prefijo', () => {
        const r = broken('prefijo', edit('specs/home.md', '`home_hero_bajada`', '`nosotros_hero_bajada`'));
        assert.match(messages(r), /debe empezar con "home_"/);
    });

    test('check: campo repetido, tipo desconocido y descripción vacía', () => {
        const r = broken('tabla', edit('specs/home.md', '| `home_hero_bajada` | textarea | Frase bajo el título. Recomendado: ~120 caracteres |', '| `home_hero_titulo` | texto |  |'));
        assert.match(messages(r), /ya existe/);
        assert.match(messages(r), /no es un tipo de ACF conocido/);
        assert.match(messages(r), /falta la descripción/);
    });

    test('check: falta una parte de la sección y los criterios', () => {
        const r = broken('partes', (dir) => {
            edit('specs/home.md', '- **Comportamiento:** el botón lleva a la sección contacto\n', '')(dir);
            const path = join(dir, 'specs/home.md');
            writeFileSync(path, readFileSync(path, 'utf8').replace(/- \[x\] .+\n/g, ''));
        });
        assert.match(messages(r), /Falta "Comportamiento"/);
        assert.match(messages(r), /al menos un ítem/);
    });

    test('check: aplicado con criterios sin marcar', () => {
        const r = broken('criterios', edit('specs/home.md', '- [x] Tokens del `_shared.md`', '- [ ] Tokens del `_shared.md`'));
        assert.match(messages(r), /sin marcar/);
    });

    test('check: el valor actual debe estar en el PHP y los textos sueltos avisan', () => {
        const r = broken('coherencia', edit('template-parts/pages/home/hero.php', 'Hacemos crecer tu negocio', 'Otro título'));
        assert.equal(r.code, 4);
        assert.match(messages(r), /home_hero_titulo: el valor actual/);
        assert.ok(r.json.warnings.some((w) => /Otro título/.test(w.message)));
    });

    test('check: destino inexistente y estados incoherentes', () => {
        const r = broken('destino', (dir) => {
            edit('specs/home.md', '`template-parts/pages/home/hero.php`', '`template-parts/pages/home/nada.php`')(dir);
            edit('specs/_index.md', '| aplicado |', '| pendiente |')(dir);
        });
        assert.match(messages(r), /destino .* no existe/);
        assert.ok(r.json.warnings.some((w) => /no coincide con _index/.test(w.message)));
    });

    test('check: no se aprueban páginas con _shared.md pendiente', () => {
        const r = broken('shared', edit('specs/_shared.md', 'aprobado', 'pendiente'));
        assert.match(messages(r), /Aprueba _shared\.md/);
    });
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallos' : ''}.`);
