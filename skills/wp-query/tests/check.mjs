#!/usr/bin/env node
// Prueba de wp-query: generate, install, check y status contra un tema de ejemplo, y el motor PHP con funciones de
// WordPress simuladas (tests/motor.php) si hay php. Sin dependencias.
//
// Uso: node skills/wp-query/tests/check.mjs [--php <ruta a php>]
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(skillDir, '..', '..');
const fixture = join(skillDir, 'tests', 'fixtures', 'tema');

const run = (name, args) => {
    const result = spawnSync(process.execPath, [join(skillDir, 'scripts', name), ...args], { encoding: 'utf8' });
    let json = null;
    try {
        json = JSON.parse(result.stdout);
    } catch {
        // la salida no era JSON: el assert que la use lo mostrará
    }
    return { code: result.status, json, stdout: result.stdout, stderr: result.stderr };
};

const tmp = mkdtempSync(join(tmpdir(), 'wp-query-'));
let passed = 0;
let skipped = 0;
const test = async (name, fn) => {
    try {
        if ((await fn()) === 'skip') {
            skipped++;
            console.log(`skip ${name}`);
            return;
        }
        passed++;
        console.log(`ok   ${name}`);
    } catch (e) {
        console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
        process.exitCode = 1;
    }
};

// Copia del tema de ejemplo en <tmp>/<n>/demo (el prefijo sale del nombre de la carpeta: demo).
let counter = 0;
const theme = (edit = () => {}) => {
    const dir = join(tmp, String(counter++), 'demo');
    mkdirSync(dirname(dir), { recursive: true });
    cpSync(fixture, dir, { recursive: true });
    edit(dir);
    return dir;
};
const change = (file, from, to) => (dir) => {
    const path = join(dir, file);
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); // Windows puede traer los fixtures con CRLF
    assert.ok(text.includes(from), `el fixture ya no contiene "${from}"`);
    writeFileSync(path, text.replace(from, to));
};
const all = (...edits) => (dir) => edits.forEach((edit) => edit(dir));
const messages = (r) => [...(r.json?.errors ?? [])].map((e) => e.message).join('\n');
const warnings = (r) => [...(r.json?.warnings ?? [])].map((e) => e.message).join('\n');
const ready = (edit = () => {}) => {
    const dir = theme(edit);
    assert.equal(run('install.mjs', ['--target', dir]).code, 0);
    const g = run('generate.mjs', ['--target', dir]);
    assert.equal(g.code, 0, g.stdout);
    return dir;
};
const loadDef = (dir, rel) => readFileSync(join(dir, rel), 'utf8');

function findPhp() {
    const arg = process.argv.indexOf('--php');
    const candidates = arg > -1 ? [process.argv[arg + 1]] : ['php', 'C:/php/php.exe', '/c/php/php', '/usr/bin/php'];
    return candidates.find((bin) => bin && spawnSync(bin, ['-v'], { encoding: 'utf8' }).status === 0) ?? null;
}
const php = findPhp();

try {
    // ---------- generate ----------
    await test('generate --dry-run: lista los listados y no escribe nada', () => {
        const dir = theme();
        const r = run('generate.mjs', ['--target', dir, '--dry-run']);
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.listings.map((l) => l.rel).sort(), ['inc/query/post.php', 'inc/query/producto.php']);
        assert.deepEqual(r.json.listings.find((l) => l.contenido === 'producto').filtros, ['categoria', 'precio', 'material', 'colores', 'destacado', 'q', 'orden']);
        assert.ok(!existsSync(join(dir, 'inc/query')), 'un dry-run no escribe');
    });

    await test('generate: definición con las claves de ACF, el orden corto y las etiquetas del listado', () => {
        const dir = theme();
        assert.equal(run('generate.mjs', ['--target', dir]).code, 0);
        const def = loadDef(dir, 'inc/query/producto.php');
        assert.match(def, /^<\?php\ndefined\('ABSPATH'\) \|\| exit;/);
        assert.match(def, /no se edita a mano/);
        assert.match(def, /'post_type' => 'producto'/);
        assert.match(def, /'por_pagina' => 12/);
        assert.match(def, /'al_filtrar' => 'auto'/);
        assert.match(def, /'movil' => 'panel'/);
        assert.match(def, /'cafe_claro' => 'Café claro'/);
        assert.match(def, /'precio-asc' => \[\n\s+'orderby' => 'meta_value_num',\n\s+'order' => 'ASC',\n\s+'campo' => 'producto_ficha_precio'/);
        assert.match(def, /'acf' => 'checkbox'/);
        assert.match(def, /'varios' => 'y',\n\s+'conteo' => 'fijo'/);
        const post = loadDef(dir, 'inc/query/post.php');
        assert.match(post, /'post_type' => 'post'/);
        assert.match(post, /'paginacion' => 'cargar_mas'/);
        assert.match(post, /'al_filtrar' => 'boton'/);
        assert.match(post, /'fuente' => 'post_date'/);
    });

    await test('generate: regenerar no cambia nada y un archivo editado es un conflicto', () => {
        const dir = theme();
        assert.equal(run('generate.mjs', ['--target', dir]).code, 0);
        const again = run('generate.mjs', ['--target', dir]);
        assert.equal(again.code, 0, again.stdout);
        assert.deepEqual(again.json.written, []);
        assert.equal(again.json.unchanged.length, 2);

        writeFileSync(join(dir, 'inc/query/producto.php'), loadDef(dir, 'inc/query/producto.php').replace("'por_pagina' => 12", "'por_pagina' => 24"));
        const conflict = run('generate.mjs', ['--target', dir]);
        assert.equal(conflict.code, 2, conflict.stdout);
        assert.deepEqual(conflict.json.unresolved, ['inc/query/producto.php']);
        assert.equal(run('generate.mjs', ['--target', dir, '--skip', 'inc/query/producto.php']).code, 0);
        assert.match(loadDef(dir, 'inc/query/producto.php'), /'por_pagina' => 24/);
        assert.equal(run('generate.mjs', ['--target', dir, '--overwrite', 'inc/query/producto.php']).code, 0);
        assert.match(loadDef(dir, 'inc/query/producto.php'), /'por_pagina' => 12/);
    });

    await test('generate: errores de los specs salen con 4', () => {
        const fuente = run('generate.mjs', ['--target', theme(change('specs/productos.md', '| rango | `producto_ficha_precio`', '| rango | `producto_ficha_peso`'))]);
        assert.equal(fuente.code, 4, fuente.stdout);
        assert.match(messages(fuente), /"producto_ficha_peso" no está en el spec de detalle/);

        const tipo = run('generate.mjs', ['--target', theme(change('specs/productos.md', '| rango | `producto_ficha_precio`', '| rango | `producto_ficha_material`'))]);
        assert.match(messages(tipo), /es select y este filtro necesita number, range/);

        const opciones = run('generate.mjs', ['--target', theme(change('specs/producto.md', 'Material principal. Opciones: Madera, Metal, Tela', 'Material principal'))]);
        assert.match(messages(opciones), /no trae "Opciones: a, b, c"/);

        const tabla = run('generate.mjs', ['--target', theme(change('specs/blog.md', '**Filtros**', 'Sin tabla'))]);
        assert.equal(tabla.code, 4);
        assert.match(messages(tabla), /Falta la tabla "Filtros"/);

        const woo = run('generate.mjs', ['--target', theme(change('specs/_shared.md', '| producto | cpt |', '| producto | woo |'))]);
        assert.match(messages(woo), /WooCommerce/);
    });

    await test('generate: --page y --states eligen los listados', () => {
        const dir = theme();
        const r = run('generate.mjs', ['--target', dir, '--page', 'blog']);
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.written, ['inc/query/post.php']);
        const none = run('generate.mjs', ['--target', theme(), '--states', 'pendiente']);
        assert.equal(none.code, 1);
    });

    // ---------- install ----------
    await test('install: motor con el prefijo, sin placeholders, require_once y bloque de CLAUDE.md', () => {
        const dir = theme((d) => writeFileSync(join(d, 'CLAUDE.md'), '# Tema\n'));
        const r = run('install.mjs', ['--target', dir]);
        assert.equal(r.code, 0, r.stdout);
        const motor = readFileSync(join(dir, 'inc/query/motor.php'), 'utf8').replace(/\r\n/g, '\n'); // la plantilla puede venir con CRLF (git en Windows)
        assert.ok(!/\{\{[A-Z_]+\}\}/.test(motor), 'quedaron placeholders');
        assert.match(motor, /function demo_query_filters\(/);
        assert.match(motor, /Versión del motor: 1\.1\.0/);
        assert.match(motor, /^<\?php\ndefined\('ABSPATH'\) \|\| exit;/);
        assert.ok(!/\bquery_posts\s*\(/.test(motor), 'el motor no usa query_posts');
        assert.match(readFileSync(join(dir, 'functions.php'), 'utf8'), /require_once get_theme_file_path\('\/inc\/query\/motor\.php'\);/);
        assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /<!-- wp-query:start -->[\s\S]*demo_query_filters[\s\S]*<!-- wp-query:end -->/);

        const again = run('install.mjs', ['--target', dir]);
        assert.equal(again.code, 0, again.stdout);
        assert.deepEqual(again.json.written, []);
        assert.equal(again.json.claudeMd, 'unchanged');
        assert.equal(readFileSync(join(dir, 'functions.php'), 'utf8').split('inc/query/motor.php').length, 2, 'no duplica el require_once');
    });

    await test('install: un motor distinto es conflicto y --check informa lo que falta', () => {
        const dir = theme();
        const missing = run('install.mjs', ['--target', dir, '--check']);
        assert.equal(missing.code, 4);
        assert.deepEqual(missing.json.missing, ['engine', 'functions', 'main']);

        assert.equal(run('install.mjs', ['--target', dir]).code, 0);
        assert.equal(run('install.mjs', ['--target', dir, '--check']).code, 0);
        writeFileSync(join(dir, 'inc/query/motor.php'), readFileSync(join(dir, 'inc/query/motor.php'), 'utf8').replace('Versión del motor: 1.1.0', 'Versión del motor: 0.9.0'));
        const old = run('install.mjs', ['--target', dir, '--check']);
        assert.equal(old.json.engineVersion.installed, '0.9.0');
        assert.match(old.json.hints.join(' '), /--overwrite inc\/query\/motor\.php,src\/js\/modules\/query\.js/);
        assert.equal(run('install.mjs', ['--target', dir]).code, 2);
        assert.equal(run('install.mjs', ['--target', dir, '--overwrite', 'inc/query/motor.php']).code, 0);
    });

    await test('install: copia el JS y lo importa una sola vez en el JS principal de Vite', () => {
        const dir = theme();
        const dry = run('install.mjs', ['--target', dir, '--dry-run']);
        assert.equal(dry.json.entry, 'src/js/main.js');
        assert.deepEqual(dry.json.wire, ['functions.php', 'src/js/main.js']);
        assert.equal(run('install.mjs', ['--target', dir]).code, 0);
        const js = readFileSync(join(dir, 'src/js/modules/query.js'), 'utf8');
        assert.ok(!/\{\{[A-Z_]+\}\}/.test(js), 'quedaron placeholders en el JS');
        assert.match(js, /export function initQuery\(/);
        const main = () => readFileSync(join(dir, 'src/js/main.js'), 'utf8');
        assert.match(main(), /import\('\.\/modules\/query\.js'\)\.then\(\(\{ initQuery \}\) => initQuery\(\)\)/);
        assert.match(main(), /import '\.\/modules\/menu\.js';/, 'no toca lo que ya tenía');
        assert.equal(run('install.mjs', ['--target', dir]).code, 0);
        assert.equal(main().split('modules/query.js').length, 2, 'no duplica el import');

        const sinVite = theme((d) => rmSync(join(d, 'vite.config.ts')));
        assert.equal(run('install.mjs', ['--target', sinVite]).code, 1);
        const conEntry = run('install.mjs', ['--target', sinVite, '--entry', 'src/js/main.js']);
        assert.equal(conEntry.code, 0, conEntry.stdout);
        assert.equal(run('install.mjs', ['--target', theme(), '--entry', '../fuera.js']).code, 1);
    });

    await test('JS: parámetros limpios de la URL', async () => {
        const dir = theme();
        assert.equal(run('install.mjs', ['--target', dir]).code, 0);
        const { queryParams, buildUrl } = await import(pathToFileURL(join(dir, 'src/js/modules/query.js')).href);
        const params = queryParams([
            ['categoria[]', 'sillas'], ['categoria[]', 'mesas'], ['categoria[]', 'sillas'],
            ['precio_min', '0'], ['precio_max', '300'], ['q', '  silla  '], ['orden', ''], ['paged', '3'], ['archivo', {}],
        ], { precio_min: '0', precio_max: '900' });
        assert.equal(params.toString(), 'categoria=sillas%2Cmesas&precio_max=300&q=silla');
        assert.equal(buildUrl('https://demo.test/productos/page/2/?x=1#a', params), 'https://demo.test/productos/page/2/?categoria=sillas,mesas&precio_max=300&q=silla');
        assert.equal(buildUrl('https://demo.test/productos/', queryParams([])), 'https://demo.test/productos/');
    });

    // ---------- check ----------
    await test('check: el tema de ejemplo conectado pasa', () => {
        const r = run('check.mjs', ['--target', ready()]);
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.connected, 1);
        assert.equal(r.json.prefix, 'demo');
    });

    await test('check: sin motor ni definición', () => {
        const r = run('check.mjs', ['--target', theme()]);
        assert.equal(r.code, 4);
        assert.match(messages(r), /Falta el motor/);
        assert.match(messages(r), /Falta la definición del listado productos/);

        const dir = ready();
        writeFileSync(join(dir, 'inc/query/post.php'), loadDef(dir, 'inc/query/post.php').replace("'por_pagina' => 9", "'por_pagina' => 3"));
        assert.match(messages(run('check.mjs', ['--target', dir])), /La definición no coincide/);
    });

    await test('check: el JS del motor debe estar copiado e importado', () => {
        const sinJs = ready((d) => d);
        rmSync(join(sinJs, 'src/js/modules/query.js'));
        assert.match(messages(run('check.mjs', ['--target', sinJs])), /Falta el JS del motor/);
        const sinImport = ready();
        writeFileSync(join(sinImport, 'src/js/main.js'), "import './modules/menu.js';\n");
        assert.match(messages(run('check.mjs', ['--target', sinImport])), /no importa modules\/query\.js/);
    });

    await test('check: zonas data-query faltantes', () => {
        const dir = ready(all(
            change('archive-producto.php', 'data-query="resultados"', ''),
            change('archive-producto.php', 'data-query="paginacion"', ''),
            change('archive-producto.php', 'data-query="total"', ''),
        ));
        const r = run('check.mjs', ['--target', dir]);
        assert.equal(r.code, 4);
        assert.match(messages(r), /data-query="resultados"/);
        assert.match(messages(r), /data-query="paginacion"/);
        assert.match(warnings(r), /data-query="total"/);
    });

    await test('check: sin el helper, cada filtro necesita su name', () => {
        const conectar = change('specs/blog.md', '- **Comportamiento:** rejilla de entradas', '- **Query:** conectado\n- **Comportamiento:** rejilla de entradas');
        const ok = run('check.mjs', ['--target', ready(conectar)]);
        assert.equal(ok.code, 0, ok.stdout);
        assert.equal(ok.json.connected, 2);
        const r = run('check.mjs', ['--target', ready(all(conectar, change('home.php', 'name="anio"', 'name="year"')))]);
        assert.equal(r.code, 4);
        assert.match(messages(r), /Filtro "anio": falta un control con name="anio"/);
    });

    await test('check: query_posts, WP_Query en el archivo y salida sin escapar', () => {
        const dir = ready(all(
            change('archive-producto.php', 'get_header();', "get_header();\n$extra = new WP_Query(['post_type' => 'producto']);"),
            change('archive-producto.php', '<main class="container">', '<main class="container"><?php echo $total; ?>'),
            (d) => writeFileSync(join(d, 'sidebar.php'), "<?php\nquery_posts('cat=1');\n"),
        ));
        const r = run('check.mjs', ['--target', dir]);
        assert.equal(r.code, 4);
        assert.match(messages(r), /query_posts\(\) rompe la consulta principal/);
        assert.match(messages(r), /reemplaza la consulta principal/);
        assert.match(warnings(r), /sin wp_reset_postdata/);
        assert.match(warnings(r), /Salida sin escapar: echo \$total/);
    });

    await test('check: php -l detecta un error de sintaxis', () => {
        if (!php) return 'skip';
        const dir = ready(change('archive-producto.php', '<?php if (have_posts()) : ?>', '<?php if (have_posts() : ?>'));
        const r = run('check.mjs', ['--target', dir, '--php', php]);
        assert.equal(r.code, 4, r.stdout);
        assert.match(messages(r), /php -l/);
    });

    // ---------- status ----------
    await test('status: next en cada etapa', () => {
        const dir = theme();
        const first = run('status.mjs', ['--target', dir]);
        assert.equal(first.code, 0, first.stdout);
        assert.equal(first.json.engine.installed, false);
        assert.match(first.json.next[0], /install\.mjs/);
        assert.match(first.json.next.join('\n'), /Generar las definiciones: generate\.mjs \(post falta, producto falta\)/);
        assert.match(first.json.next.join('\n'), /Conectar las plantillas: blog/);

        assert.equal(run('install.mjs', ['--target', dir]).code, 0);
        assert.equal(run('generate.mjs', ['--target', dir]).code, 0);
        const later = run('status.mjs', ['--target', dir]);
        assert.equal(later.json.engine.upToDate, true);
        assert.deepEqual(later.json.definitions.map((d) => d.state), ['al día', 'al día']);
        assert.deepEqual(later.json.next, ['Conectar las plantillas: blog']);
        const productos = later.json.listados.find((l) => l.slug === 'productos');
        assert.deepEqual([productos.filtros, productos.connected], [7, 1]);

        const sinTabla = run('status.mjs', ['--target', theme(change('specs/blog.md', '**Filtros**', 'Sin tabla'))]);
        assert.match(sinTabla.json.next.join('\n'), /Falta la tabla "Filtros" en: blog/);
    });

    // ---------- motor PHP ----------
    await test('motor: lista blanca y armado de la consulta (php)', () => {
        if (!php) return 'skip';
        const dir = ready();
        const r = spawnSync(php, [join(skillDir, 'tests', 'motor.php'), join(dir, 'inc/query/motor.php'), join(dir, 'inc/query/producto.php'), join(dir, 'inc/query/post.php')], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.ok(JSON.parse(r.stdout).passed > 30);
        const lint = spawnSync(php, ['-l', join(dir, 'inc/query/motor.php')], { encoding: 'utf8' });
        assert.equal(lint.status, 0, lint.stdout);
    });

    // ---------- código común ----------
    await test('las copias de shared/ están al día', () => {
        const r = spawnSync(process.execPath, [join(repoDir, 'scripts', 'sync-shared.mjs'), '--check'], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stdout);
    });
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${skipped ? `, ${skipped} omitidas (no hay php)` : ''}.`);
