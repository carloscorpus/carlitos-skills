#!/usr/bin/env node
// Prueba de wp-helper: instala los helpers en un tema temporal con scripts/install.mjs y corre
// tests/cases.json contra el PHP real (con las funciones de WordPress simuladas en stubs.php).
// Sin dependencias; necesita `php`.
//
// Uso: node check.mjs [--php <ruta a php>]
// Sale con 0 si todo pasa, 1 si algo falla o no hay PHP.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const testsDir = dirname(fileURLToPath(import.meta.url));
const install = resolve(testsDir, '..', 'scripts', 'install.mjs');
const cases = JSON.parse(readFileSync(join(testsDir, 'cases.json'), 'utf8'));
const { values: args } = parseArgs({ options: { php: { type: 'string' } } });

const failures = [];
let total = 0;
const expect = (ok, label, detail = '') => {
    total++;
    if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
};

// ---------- PHP ----------

function findPhp() {
    if (args.php) return args.php;
    if (spawnSync('php', ['-v']).status === 0) return 'php';
    const roots = [
        join(process.env.APPDATA ?? '', 'Local/lightning-services'),
        join(homedir(), 'Library/Application Support/Local/lightning-services'),
        join(homedir(), '.config/Local/lightning-services'),
    ];
    for (const root of roots.filter(existsSync)) {
        const versions = readdirSync(root).filter((d) => d.startsWith('php-')).sort().reverse();
        for (const v of versions) {
            for (const rel of ['bin/win32/php.exe', 'bin/darwin/bin/php', 'bin/darwin-arm64/bin/php', 'bin/linux/bin/php']) {
                if (existsSync(join(root, v, rel))) return join(root, v, rel);
            }
        }
    }
    return null;
}

const php = findPhp();
if (!php) {
    console.log(JSON.stringify({ ok: false, error: 'No encontré php. Pásalo con --php <ruta> o agrégalo al PATH.' }, null, 2));
    process.exit(1);
}

// ---------- Tema temporal ----------

const work = mkdtempSync(join(tmpdir(), 'wp-helper-'));
const run = (theme, ...a) => spawnSync(process.execPath, [install, '--target', theme, ...a], { encoding: 'utf8' });
const json = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

function makeTheme(name) {
    const theme = join(work, name);
    spawnSync(process.execPath, ['-e', `require('fs').mkdirSync(${JSON.stringify(theme)}, { recursive: true })`]);
    writeFileSync(join(theme, 'style.css'), '/* Theme Name: Demo */\n');
    writeFileSync(join(theme, 'functions.php'), "<?php\ndefined('ABSPATH') || exit;\n\nrequire_once get_theme_file_path('/inc/setup.php');\n");
    writeFileSync(join(theme, 'CLAUDE.md'), '# Demo\n');
    return theme;
}

function evaluate(theme, items) {
    const input = join(work, 'job.json');
    writeFileSync(input, JSON.stringify({ attachments: cases.attachments, items }));
    const r = spawnSync(php, [join(testsDir, 'runner.php'), theme, input], { encoding: 'utf8' });
    try {
        return JSON.parse(r.stdout);
    } catch {
        failures.push(`runner.php no devolvió JSON: ${(r.stderr || r.stdout).slice(0, 300)}`);
        return null;
    }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
    // ---------- Instalador ----------
    const theme = makeTheme('demo');

    const dry = json(run(theme, '--helpers', 'images,text', '--dry-run'));
    expect(dry?.ok && dry.create.length === 3 && dry.conflicts.length === 0, 'dry-run: 3 archivos y sin conflictos', JSON.stringify(dry));
    expect(!existsSync(join(theme, 'inc')), 'dry-run no escribe');

    const first = run(theme, '--helpers', 'images,text');
    expect(first.status === 0, 'instalar images,text sale con 0', first.stdout);
    expect(run(theme, '--check').status === 0, '--check sale con 0 tras instalar');

    const functions = readFileSync(join(theme, 'functions.php'), 'utf8');
    for (const rel of ['inc/helpers/images.php', 'inc/helpers/text.php']) {
        expect(functions.split(`require_once get_theme_file_path('/${rel}');`).length === 2, `functions.php conecta ${rel} una vez`);
    }
    expect(readFileSync(join(theme, 'CLAUDE.md'), 'utf8').includes('demo_image('), 'CLAUDE.md lleva el bloque de imágenes');

    // Reinstalar es idempotente y no pisa la configuración del proyecto.
    const styled = json(run(theme, '--add-style', '--name', 'naranja', '--marker', '|', '--class', 'text-anaranjado'));
    expect(styled?.ok, '--add-style agrega el primer estilo', JSON.stringify(styled));
    const stylesBefore = readFileSync(join(theme, 'inc/helpers/text-styles.php'), 'utf8');
    const again = json(run(theme, '--helpers', 'images,text'));
    expect(again?.ok && again.conflicts.length === 0 && again.keptConfig.length === 1, 'reinstalar: sin conflictos y conserva text-styles.php', JSON.stringify(again));
    expect(readFileSync(join(theme, 'inc/helpers/text-styles.php'), 'utf8') === stylesBefore, 'reinstalar no cambia text-styles.php');
    expect(readFileSync(join(theme, 'functions.php'), 'utf8') === functions, 'reinstalar no duplica require_once');
    expect(readFileSync(join(theme, 'CLAUDE.md'), 'utf8').split('<!-- wp-helper:start -->').length === 2, 'reinstalar no duplica el bloque de CLAUDE.md');

    // Anti-colisión.
    const sameMarker = run(theme, '--add-style', '--name', 'otro', '--marker', '|', '--class', 'text-x');
    expect(sameMarker.status === 1 && json(sameMarker)?.free?.length === 4, 'marcador repetido sale con 1 y lista los libres', sameMarker.stdout);
    expect(run(theme, '--add-style', '--name', 'naranja', '--marker', '*', '--class', 'text-x').status === 1, 'nombre repetido sale con 1');
    expect(run(theme, '--add-style', '--name', 'x', '--marker', '&', '--class', 'text-x').status === 1, 'marcador fuera de la lista sale con 1');
    for (const marker of ['-', '_']) {
        expect(run(theme, '--add-style', '--name', 'x', '--marker', marker, '--class', 'text-x').status === 1, `marcador "${marker}" no se acepta`);
    }
    expect(run(theme, '--add-style', '--name', 'x', '--marker', '*', '--class', "a'b").status === 1, 'clase con comilla sale con 1');
    expect(run(theme, '--add-style', '--name', 'x', '--marker', '*', '--class', 'text-x', '--dry-run').status === 0
        && !readFileSync(join(theme, 'inc/helpers/text-styles.php'), 'utf8').includes("'x'"), '--add-style --dry-run no escribe');

    // Un cambio en el motor se detecta como conflicto, no se pisa.
    writeFileSync(join(theme, 'inc/helpers/images.php'), '<?php // editado a mano\n');
    const conflict = run(theme, '--helpers', 'images');
    expect(conflict.status === 2 && json(conflict)?.unresolved?.includes('inc/helpers/images.php'), 'motor editado: sale con 2', conflict.stdout);
    expect(run(theme, '--helpers', 'images', '--overwrite', 'inc/helpers/images.php').status === 0, '--overwrite repone el motor');

    // Línea irreconocible en el registro: no se adivina.
    writeFileSync(join(theme, 'inc/helpers/text-styles.php'), stylesBefore.replace('// wp-helper:styles:end', "bogus line\n    // wp-helper:styles:end"));
    expect(run(theme, '--list').status === 1, 'línea desconocida en el bloque: --list sale con 1');

    expect(run(makeTheme('vacio'), '--check').status === 4, '--check sin helpers sale con 4');
    expect(run(makeTheme('otro'), '--helpers', 'nada').status === 1, 'helper desconocido sale con 1');

    // ---------- Imágenes (tema sin estilos) ----------
    const imgTheme = makeTheme('imagenes');
    run(imgTheme, '--helpers', 'images,text');
    for (const rel of ['images.php', 'text.php', 'text-styles.php']) {
        const lint = spawnSync(php, ['-l', join(imgTheme, 'inc/helpers', rel)], { encoding: 'utf8' });
        expect(lint.status === 0, `php -l ${rel}`, lint.stdout + lint.stderr);
    }

    const items = [
        ...cases.data.map((c) => ({ kind: 'data', input: c.input, size: c.size })),
        ...cases.image.map((c) => ({ kind: 'image', input: c.input, args: c.args })),
    ];
    const out = evaluate(imgTheme, items);
    if (out) {
        cases.data.forEach((c, i) => expect(same(out[i], c.expect), `imagen/datos: ${c.name}`, JSON.stringify(out[i])));
        cases.image.forEach((c, j) => {
            const html = out[cases.data.length + j];
            const label = `imagen/html: ${c.name}`;
            if (c.equals !== undefined) expect(html === c.equals, label, JSON.stringify(html));
            for (const piece of c.contains ?? []) expect(html.includes(piece), label, `falta ${piece} en ${html}`);
            for (const piece of c.notContains ?? []) expect(!html.includes(piece), label, `sobra ${piece} en ${html}`);
        });
    }

    // ---------- Enlaces ----------
    const linkTheme = makeTheme('enlaces');
    expect(run(linkTheme, '--helpers', 'links').status === 0, 'instalar links sale con 0');
    expect(run(linkTheme, '--check').status === 0, 'links: --check sale con 0');
    const linkFunctions = readFileSync(join(linkTheme, 'functions.php'), 'utf8');
    expect(linkFunctions.split("require_once get_theme_file_path('/inc/helpers/links.php');").length === 2, 'functions.php conecta links.php una vez');
    expect(run(linkTheme, '--helpers', 'links').status === 0 && readFileSync(join(linkTheme, 'functions.php'), 'utf8') === linkFunctions, 'reinstalar links no duplica el require_once');
    expect(json(run(linkTheme, '--list'))?.helpers?.links?.wired === true, '--list muestra links conectado');
    expect(readFileSync(join(linkTheme, 'CLAUDE.md'), 'utf8').includes('enlace de un campo ACF'), 'CLAUDE.md lleva el bloque de enlaces');
    const lint = spawnSync(php, ['-l', join(linkTheme, 'inc/helpers/links.php')], { encoding: 'utf8' });
    expect(lint.status === 0, 'php -l links.php', lint.stdout + lint.stderr);

    const linkItems = [
        ...cases.links.data.map((c) => ({ kind: 'link_data', input: c.input })),
        ...cases.links.html.map((c) => ({ kind: c.kind, input: c.input, args: c.args })),
    ];
    const linkOut = evaluate(linkTheme, linkItems);
    if (linkOut) {
        cases.links.data.forEach((c, i) => {
            const got = linkOut[i];
            const ok = c.expect === null ? got === null : got !== null && Object.entries(c.expect).every(([k, v]) => got[k] === v);
            expect(ok, `enlace/datos: ${c.name}`, JSON.stringify(got));
        });
        cases.links.html.forEach((c, j) => {
            const html = linkOut[cases.links.data.length + j];
            const label = `enlace/html: ${c.name}`;
            if (c.equals !== undefined) expect(html === c.equals, label, JSON.stringify(html));
            for (const piece of c.contains ?? []) expect(html.includes(piece), label, `falta ${piece} en ${html}`);
            for (const piece of c.notContains ?? []) expect(!html.includes(piece), label, `sobra ${piece} en ${html}`);
        });
    }

    // ---------- Texto (un tema por grupo de estilos) ----------
    for (const group of cases.groups) {
        const t = makeTheme(`texto-${cases.groups.indexOf(group)}`);
        run(t, '--helpers', 'text');
        for (const s of group.styles) {
            const r = run(t, '--add-style', '--name', s.name, '--marker', s.marker, '--class', s.class);
            expect(r.status === 0, `${group.name}: estilo ${s.name}`, r.stdout);
        }
        const res = evaluate(t, group.text.map((c) => ({ kind: 'text', input: c.input, only: c.only })));
        if (res) group.text.forEach((c, i) => expect(res[i] === c.expect, `texto (${group.name}): ${c.name}`, JSON.stringify(res[i])));
    }
} finally {
    rmSync(work, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: failures.length === 0, php, checks: total, failed: failures.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
