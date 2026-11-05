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

    test('analyze: el listado con filtros y precios es candidato a contenido dinámico', () => {
        const catalog = run('analyze.mjs', ['--source', join(fixtures, 'fuente-catalogo')]);
        assert.equal(catalog.code, 0, catalog.stderr);
        const [candidate] = catalog.json.dynamicCandidates;
        assert.equal(candidate.file, 'productos.html');
        for (const reason of ['nombre', 'filtros', 'comercio', 'paginación', 'repetidos']) assert.ok(candidate.reasons.includes(reason), `falta el motivo ${reason}`);
        const filter = catalog.json.interactions.find((i) => i.type === 'form');
        assert.equal(filter.kind, 'filter');
        assert.equal(filter.suggestedSkill, null, 'un filtro no es un formulario de envío');
        assert.deepEqual(analysis.json.dynamicCandidates, [], 'la fuente estática no tiene candidatos');
        assert.equal(analysis.json.interactions.find((i) => i.type === 'form').kind, undefined);
    });

    test('analyze: cabecera y pie repetidos son contenido de todo el sitio', () => {
        const byTag = Object.fromEntries(analysis.json.siteWide.chrome.map((c) => [c.tag, c]));
        assert.deepEqual(byTag.header.files, ['index.html', 'nosotros.html']);
        assert.deepEqual(byTag.header.links.map((l) => l.text), ['Inicio', 'Nosotros']);
        assert.ok(byTag.footer.texts.includes('© Demo'));
        assert.deepEqual(analysis.json.siteWide.repeated, [], 'las cards son de una sola página');
    });

    test('analyze: las imágenes PNG y JPEG que no son webp se avisan (informativo); SVG y webp no', () => {
        const pagina = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>x</title></head><body><h1>x</h1></body></html>';
        const conRaster = join(tmp, 'fuente-raster');
        mkdirSync(join(conRaster, 'img'), { recursive: true });
        writeFileSync(join(conRaster, 'index.html'), pagina);
        for (const name of ['foto.jpg', 'otra.JPEG', 'logo.png', 'icono.svg', 'ya.webp']) writeFileSync(join(conRaster, 'img', name), 'x');
        const finding = run('analyze.mjs', ['--source', conRaster]).json.findings.find((f) => f.id === 'raster-not-webp');
        assert.ok(finding, 'falta el hallazgo raster-not-webp');
        assert.equal(finding.count, 3, 'jpg, jpeg y png; no el svg ni el webp');
        assert.equal(finding.severity, 'low');
        assert.deepEqual(finding.locations.map((l) => l.file).sort(), ['img/foto.jpg', 'img/logo.png', 'img/otra.JPEG']);

        const sinRaster = join(tmp, 'fuente-sin-raster');
        mkdirSync(join(sinRaster, 'img'), { recursive: true });
        writeFileSync(join(sinRaster, 'index.html'), pagina);
        writeFileSync(join(sinRaster, 'img', 'icono.svg'), 'x');
        writeFileSync(join(sinRaster, 'img', 'ya.webp'), 'x');
        assert.equal(run('analyze.mjs', ['--source', sinRaster]).json.findings.some((f) => f.id === 'raster-not-webp'), false);
        assert.equal(analysis.json.findings.some((f) => f.id === 'raster-not-webp'), false, 'el fixture de siempre no cambia');
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

    test('init --page: tipo, contenido y ubicación por defecto', () => {
        const base = ['--target', theme, '--source', 'productos.html'];
        const list = run('init.mjs', [...base, '--page', 'productos', '--title', 'Productos', '--template', 'archive-producto.php', '--type', 'listado', '--content', 'producto']);
        assert.equal(list.code, 0, list.stdout);
        const spec = readFileSync(join(theme, 'specs/productos.md'), 'utf8').replace(/\r\n/g, '\n'); // Windows: \r\n
        assert.match(spec, /\*\*Tipo:\*\* listado/);
        assert.match(spec, /\*\*Contenido:\*\* producto/);
        assert.match(spec, /\*\*Al filtrar:\*\* sin recargar\n- \*\*Paginación:\*\* números/);
        assert.match(spec, /- \*\*Estado:\*\* pendiente\n\n\*\*Filtros\*\*\n\n\| Filtro \| Tipo \| Fuente \| Varios \| Conteo \| Vista \|/);
        assert.ok(!readFileSync(join(theme, 'specs/sobre-nosotros.md'), 'utf8').includes('**Filtros**'), 'una estática no lleva filtros');
        assert.match(spec, /\*\*Grupo ACF:\*\* Productos/);
        assert.match(spec, /\*\*Ubicación:\*\* página de opciones: archivo de producto/);
        const detail = run('init.mjs', [...base, '--page', 'producto', '--title', 'Producto', '--template', 'single-producto.php', '--type', 'detalle', '--content', 'producto']);
        assert.equal(detail.code, 0, detail.stdout);
        assert.match(readFileSync(join(theme, 'specs/producto.md'), 'utf8'), /\*\*Ubicación:\*\* tipo de contenido = producto/);
        assert.match(readFileSync(join(theme, 'specs/sobre-nosotros.md'), 'utf8'), /\*\*Ubicación:\*\* plantilla pages\/template-sobre-nosotros\.php/);
        const bad = (extra) => run('init.mjs', [...base, '--page', 'otra', '--title', 'Otra', '--template', 'p.php', ...extra]).code;
        assert.equal(bad(['--type', 'listado']), 1, 'un listado exige --content');
        assert.equal(bad(['--type', 'tienda']), 1, 'tipo desconocido');
        assert.equal(bad(['--content', 'producto']), 1, 'una estática no lleva contenido');
        assert.equal(bad(['--type', 'detalle', '--content', 'Producto Nuevo']), 1, 'contenido en snake_case');
        assert.match(readFileSync(join(theme, 'specs/sobre-nosotros.md'), 'utf8'), /\*\*Padre:\*\* ninguno/);
        assert.equal(bad(['--type', 'listado', '--content', 'producto', '--parent', 'sobre-nosotros']), 1, 'un listado no lleva padre');
        assert.equal(bad(['--parent', 'Sobre Nosotros']), 1, 'el padre es un slug');
        assert.equal(bad(['--parent', 'otra']), 1, 'no es su propio padre');
        const child = run('init.mjs', [...base, '--page', 'equipo', '--title', 'Equipo', '--template', 'pages/template-equipo.php', '--parent', 'sobre-nosotros']);
        assert.equal(child.code, 0, child.stdout);
        assert.match(readFileSync(join(theme, 'specs/equipo.md'), 'utf8'), /\*\*Padre:\*\* sobre-nosotros/);
        for (const slug of ['productos', 'producto', 'equipo']) rmSync(join(theme, `specs/${slug}.md`));
        const indexPath = join(theme, 'specs/_index.md');
        writeFileSync(indexPath, readFileSync(indexPath, 'utf8').split('\n').filter((line) => !/\((productos|producto|equipo)\.md\)/.test(line)).join('\n'));
    });

    test('init --page: el spec global es siempre "opciones"', () => {
        const base = ['--target', theme, '--source', 'index.html', '--template', 'header.php', '--title', 'Ajustes del sitio'];
        assert.equal(run('init.mjs', [...base, '--page', 'sitio', '--type', 'global']).code, 1, 'el slug debe ser opciones');
        assert.equal(run('init.mjs', [...base, '--page', 'opciones']).code, 1, 'opciones es global');
        assert.equal(run('init.mjs', [...base, '--page', 'opciones', '--type', 'global', '--content', 'producto']).code, 1, 'global no lleva contenido');
        const r = run('init.mjs', [...base, '--page', 'opciones', '--type', 'global']);
        assert.equal(r.code, 0, r.stdout);
        const spec = readFileSync(join(theme, 'specs/opciones.md'), 'utf8');
        assert.match(spec, /\*\*Tipo:\*\* global/);
        assert.match(spec, /\*\*Ubicación:\*\* página de opciones: Ajustes del sitio/);
        rmSync(join(theme, 'specs/opciones.md'));
        const indexPath = join(theme, 'specs/_index.md');
        writeFileSync(indexPath, readFileSync(indexPath, 'utf8').split('\n').filter((line) => !/\(opciones\.md\)/.test(line)).join('\n'));
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
        assert.equal(r.json.fields, 6);
        assert.equal(r.json.groups, 4);
        assert.deepEqual(r.json.warnings, []);
    });

    const common = ["Un solo `h1` por página y los encabezados no saltan de nivel","Sin estilos inline, `!important` ni manejadores `onclick=` en el HTML","Controles correctos: acciones con `<button>`, navegación con `<a href>`, campos con `<label>`","Imágenes con `alt` (vacío si son decorativas) y proporción fija (`aspect-ratio` + `object-cover`)","`php -l` sin errores en cada archivo creado y `pnpm build` sin errores"];
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

    test('check: un texto partido en un campo por línea avisa; <br> en "valor actual" no', () => {
        const titulo = '| `home_hero_titulo` | text | Título principal de la portada. Se muestra en grande. Recomendado: ~50 caracteres | Hacemos crecer tu negocio | sí |';
        const split = broken('lineas', edit('specs/home.md', titulo, [
            '| `home_hero_titulo_linea_1` | text | Primera línea del título | Hacemos crecer | sí |',
            '| `home_hero_titulo_linea_2` | text | Segunda línea del título | tu negocio | sí |',
        ].join('\n')));
        assert.equal(split.code, 0, split.stdout);
        assert.ok(split.json.warnings.some((w) => /home_hero_titulo_linea_1, home_hero_titulo_linea_2: es un solo texto/.test(w.message)));
        const joined = broken('lineas-br', edit('specs/home.md', titulo, titulo.replace('| text |', '| textarea |').replace('Hacemos crecer tu negocio', 'Hacemos crecer<br>tu negocio')));
        assert.equal(joined.code, 0, joined.stdout);
        assert.deepEqual(joined.json.warnings, []);
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
        const r = broken('criterios', edit('specs/home.md', '- [x] La imagen de fondo', '- [ ] La imagen de fondo'));
        assert.match(messages(r), /sin marcar/);
    });

    test('check: el valor actual debe estar en el PHP y los textos sueltos avisan', () => {
        const r = broken('coherencia', edit('template-parts/pages/home/hero.php', 'Hacemos crecer tu negocio', 'Otro título'));
        assert.equal(r.code, 4);
        assert.match(messages(r), /home_hero_titulo: el valor actual/);
        assert.ok(r.json.warnings.some((w) => /Otro título/.test(w.message)));
    });

    test('check: el valor actual también puede estar en una variable de la plantilla', () => {
        const r = broken('variable', (dir) => {
            const path = join(dir, 'template-parts/pages/home/hero.php');
            const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
            writeFileSync(path, text.replace('<h1 class="text-4xl">Hacemos crecer tu negocio</h1>', "<?php $titulo = 'Hacemos |crecer| tu negocio'; ?>\n    <h1 class=\"text-4xl\"><?= esc_html($titulo) ?></h1>"));
        });
        assert.equal(r.code, 0, r.stdout);
    });

    test('check: una sección con ACF conectado no compara el valor actual con la plantilla', () => {
        const comportamiento = '- **Comportamiento:** el botón lleva a la sección contacto\n';
        const conectado = broken('acf-conectado', (dir) => {
            edit('specs/home.md', comportamiento, comportamiento + '- **ACF:** conectado\n')(dir);
            edit('template-parts/pages/home/hero.php', 'Hacemos crecer tu negocio', '<?= esc_html((string) get_field("x")) ?>')(dir);
        });
        assert.equal(conectado.code, 0, conectado.stdout);
        const invalido = broken('acf-invalido', edit('specs/home.md', comportamiento, comportamiento + '- **ACF:** hecho\n'));
        assert.match(messages(invalido), /ACF inválido/);
    });

    test('check: etiqueta Query solo en listados y detalles', () => {
        const catalogo = '- **Comportamiento:** rejilla de tarjetas';
        const ok = broken('query-ok', edit('specs/productos.md', catalogo, '- **Query:** conectado\n' + catalogo));
        assert.equal(ok.code, 0, ok.stdout);
        const invalido = broken('query-invalido', edit('specs/productos.md', catalogo, '- **Query:** hecho\n' + catalogo));
        assert.match(messages(invalido), /Query inválido/);
        const comportamiento = '- **Comportamiento:** el botón lleva a la sección contacto\n';
        const home = broken('query-home', edit('specs/home.md', comportamiento, comportamiento + '- **Query:** conectado\n'));
        assert.match(messages(home), /Query solo va/);
    });

    test('check: un subcampo necesita la fila de su repetidor', () => {
        const r = broken('sin-repetidor', edit('specs/home.md', '| `home_hero_imagen` | image |', '| `home_hero_items.titulo` | text | Título del ítem | A | sí |\n| `home_hero_imagen` | image |'));
        assert.match(messages(r), /falta la fila del repetidor "home_hero_items"/);
    });

    test('check: destino inexistente y estados incoherentes', () => {
        const r = broken('destino', (dir) => {
            edit('specs/home.md', '`template-parts/pages/home/hero.php`', '`template-parts/pages/home/nada.php`')(dir);
            edit('specs/_index.md', '| aplicado |', '| pendiente |')(dir);
        });
        assert.match(messages(r), /destino .* no existe/);
        assert.ok(r.json.warnings.some((w) => /no coincide con _index/.test(w.message)));
    });

    test('check: un spec de la 1.0 avisa, no falla', () => {
        const r = broken('legacy', (dir) => {
            const path = join(dir, 'specs/home.md');
            const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
                .replace(/- \*\*(Tipo|Contenido|Grupo ACF|Ubicación):\*\*.*\n/g, '').replace(/- \*\*Grupo:\*\*.*\n/g, '');
            writeFileSync(path, text);
        });
        assert.equal(r.code, 0, r.stdout);
        assert.ok(r.json.warnings.some((w) => /formato 1\.0/.test(w.message)));
    });

    test('check: el grupo de la sección y sus campos', () => {
        assert.match(messages(broken('grupo-pagina', edit('specs/home.md', '**Grupo:** `home_hero`', '**Grupo:** `inicio_hero`'))), /debe empezar con "home_"/);
        assert.match(messages(broken('grupo-campo', edit('specs/home.md', '**Grupo:** `home_hero`', '**Grupo:** `home_portada`'))), /debe empezar con el grupo "home_portada_"/);
        assert.match(messages(broken('grupo-falta', edit('specs/home.md', '- **Grupo:** `home_hero`\n', ''))), /Falta "Grupo"/);
        assert.match(messages(broken('grupo-ninguno', edit('specs/home.md', '**Grupo:** `home_hero`', '**Grupo:** ninguno'))), /tiene campos/);
        assert.match(messages(broken('grupo-repetido', edit('specs/producto.md', '`producto_ficha`', '`home_hero`'))), /debe empezar con "producto_"/);
    });

    test('check: contenido dinámico en el spec y en _shared.md', () => {
        assert.match(messages(broken('contenido', edit('specs/productos.md', '**Contenido:** producto', '**Contenido:** servicio'))), /"servicio" no está en la tabla/);
        assert.match(messages(broken('tipo', edit('specs/productos.md', '**Tipo:** listado', '**Tipo:** tienda'))), /Tipo inválido/);
        assert.match(messages(broken('estatica', edit('specs/home.md', '**Contenido:** ninguno', '**Contenido:** producto'))), /lleva "Contenido: ninguno"/);
        assert.match(messages(broken('origen', edit('specs/_shared.md', '| cpt |', '| tienda |'))), /Origen "tienda"/);
        assert.match(messages(broken('accion', edit('specs/_shared.md', '| WhatsApp con "Hola, me interesa {producto}"; número en un campo global |', '|  |'))), /falta "Acción"/);
        assert.match(messages(broken('alcance', edit('specs/_shared.md', '| productos.html | catálogo | producto |', '| productos.html | catálogo | ninguno |'))), /necesita un Contenido/);
        assert.match(messages(broken('alcance-2', edit('specs/_shared.md', '| productos.html | catálogo | producto |', '| productos.html | tienda | producto |'))), /"Qué es" debe ser/);
    });

    // Una página estática pendiente (sin secciones) que cuelga de otra.
    const addPage = (slug, parent) => (dir) => writeFileSync(join(dir, 'specs', `${slug}.md`), [
        `# Página: ${slug}`, '',
        '- **Resumen:** r', '- **Fuente:** `x.html`', `- **Plantilla:** \`pages/template-${slug}.php\``, '- **Tipo:** estática',
        '- **Contenido:** ninguno', '- **Secciones (en orden):** ninguna', '- **Skills usadas:** ninguna', `- **Grupo ACF:** ${slug}`,
        `- **Ubicación:** plantilla pages/template-${slug}.php`, `- **Padre:** ${parent}`, '- **Notas de página:** ninguna', '- **Estado:** pendiente', '',
    ].join('\n'));
    const both = (...edits) => (dir) => edits.forEach((fn) => fn(dir));

    test('check: Padre de una página estática', () => {
        const ok = broken('padre-ok', both(addPage('servicios', 'ninguno'), addPage('diseno-web', 'servicios')));
        assert.ok(!/Padre|padre/.test(messages(ok)), messages(ok));
        assert.match(messages(broken('padre-falta', addPage('diseno-web', 'servicios'))), /no hay un spec servicios\.md/);
        assert.match(messages(broken('padre-dinamico', addPage('diseno-web', 'productos'))), /tiene que ser estática/);
        assert.match(messages(broken('padre-mismo', addPage('diseno-web', 'diseno-web'))), /su propio padre/);
        assert.match(messages(broken('padre-inicio', edit('specs/home.md', '- **Estado:** aplicado\n', '- **Padre:** productos\n- **Estado:** aplicado\n'))), /no es la de inicio/);
        assert.match(messages(broken('padre-ciclo', both(addPage('a', 'b'), addPage('b', 'a')))), /ciclo \(a → b → a\)/);
    });

    test('check: tabla Filtros de un listado', () => {
        const spec = 'specs/productos.md';
        const bad = (name, from, to) => messages(broken(`filtros-${name}`, edit(spec, from, to)));
        assert.match(bad('taxonomia', '`categoria_producto` | sí (o)', '`marca` | sí (o)'), /la taxonomía "marca" no está en la fila "producto"/);
        assert.match(bad('campo', '| rango | `producto_ficha_precio` |', '| rango | `producto_ficha_peso` |'), /"producto_ficha_peso" no está en el spec de detalle/);
        assert.match(bad('tipo-campo', '| `precio` | rango |', '| `precio` | opciones |'), /es number; un filtro de opciones necesita select/);
        assert.match(bad('reservado', '| `q` | búsqueda |', '| `s` | búsqueda |'), /"s" choca con una variable de WordPress/);
        assert.match(bad('taxonomia-nombre', '| `categoria` | taxonomía |', '| `categoria_producto` | taxonomía |'), /choca con una variable/);
        assert.match(bad('tipo', '| `precio` | rango |', '| `precio` | slider |'), /Tipo "slider" inválido/);
        assert.match(bad('varios', '| `producto_ficha_precio` | no | — |', '| `producto_ficha_precio` | sí (o) | — |'), /no admite varios valores/);
        assert.match(bad('varios-texto', '| sí (o) | dinámico |', '| quizás | dinámico |'), /"Varios" debe ser/);
        assert.match(bad('conteo', '| sí (o) | dinámico |', '| sí (o) | siempre |'), /"Conteo" debe ser/);
        assert.match(bad('orden', 'reciente, az,', 'reciente, popular,'), /Orden "popular" desconocido/);
        assert.match(bad('repetido', '| `q` | búsqueda |', '| `categoria` | búsqueda |'), /Filtro repetido/);
        assert.match(bad('vista', '| — | dos casillas |', '| — |  |'), /Falta "Vista"/);
        assert.match(bad('paginacion', '**Paginación:** números', '**Paginación:** páginas'), /"Paginación" inválido/);
        assert.match(bad('por-pagina', '**Por página:** 12', '**Por página:** doce'), /"Por página" inválido/);
        const home = messages(broken('filtros-home', edit('specs/home.md', '- **Estado:** aplicado\n', '- **Estado:** aplicado\n\n**Filtros**\n\n| Filtro | Tipo | Fuente | Varios | Conteo | Vista |\n|---|---|---|---|---|---|\n| `x` | búsqueda | texto | — | — | campo |\n')));
        assert.match(home, /solo va en un listado/);
        const old = broken('filtros-sin-tabla', edit(spec, '\n**Filtros**\n', '\n**Otra cosa**\n'));
        assert.equal(old.code, 0, 'un listado sin tabla solo avisa');
        assert.ok(old.json.warnings.some((w) => /Falta la tabla "Filtros" \(el diseño muestra: categoría, orden\)/.test(w.message)));
    });

    test('check: spec global y menús', () => {
        assert.match(messages(broken('global-tipo', edit('specs/opciones.md', '**Tipo:** global', '**Tipo:** estática'))), /"opciones" es del tipo global/);
        assert.match(messages(broken('global-contenido', edit('specs/opciones.md', '**Contenido:** ninguno', '**Contenido:** producto'))), /global lleva "Contenido: ninguno"/);
        assert.match(messages(broken('global-prefijo', edit('specs/opciones.md', '`opciones_pie_copyright`', '`pie_copyright`'))), /debe empezar con "opciones_"/);
        assert.match(messages(broken('menu-nombre', edit('specs/_shared.md', '| principal |', '| Menú Principal |'))), /la ubicación va en minúsculas/);
        assert.match(messages(broken('menu-enlaces', edit('specs/_shared.md', '| Inicio, Nosotros |', '|  |'))), /falta dónde se muestra o los enlaces/);
    });

    test('check: los criterios comunes se declaran una vez', () => {
        const base = common.map((c) => '- [x] ' + c).join('\n');
        const repeated = broken('criterios-repetidos', edit('specs/home.md', '- [x] Cumple los criterios comunes de `_shared.md`', base));
        assert.equal(repeated.code, 0, repeated.stdout);
        assert.ok(repeated.json.warnings.some((w) => /Repite 5 criterios/.test(w.message)));
        const orphan = broken('criterios-sin-shared', (d) => {
            edit('specs/_shared.md', '## Criterios comunes', '## Otra cosa')(d);
        });
        assert.ok(orphan.json.warnings.some((w) => /no tiene esa sección/.test(w.message)));
    });

    test('check: las notas de página van en lista y avisan si son un párrafo largo', () => {
        const long = broken('notas-largas', edit('specs/home.md', '- **Notas de página:**\n  - h1 en el hero\n  - título SEO "Inicio"\n', '- **Notas de página:** ' + 'una nota muy larga '.repeat(20) + '\n'));
        assert.equal(long.code, 0, long.stdout);
        assert.ok(long.json.warnings.some((w) => /párrafo largo/.test(w.message)));
        const empty = broken('notas-vacias', edit('specs/home.md', '- **Notas de página:**\n  - h1 en el hero\n  - título SEO "Inicio"\n', '- **Notas de página:**\n'));
        assert.match(messages(empty), /Falta "Notas de página"/);
        const duplicated = broken('notas-criterios', edit('specs/home.md', '  - h1 en el hero', '  - Criterios de página: [ ] check.mjs sale con 0'));
        assert.ok(duplicated.json.warnings.some((w) => /criterios de página ya están/.test(w.message)));
    });

    test('check: no se aprueban páginas con _shared.md pendiente', () => {
        const r = broken('shared', edit('specs/_shared.md', 'aprobado', 'pendiente'));
        assert.match(messages(r), /Aprueba _shared\.md/);
    });

    // _shared.md documenta el componente "titulo-seccion" con sus argumentos; `php` es cómo quedó en el tema.
    const withComponent = (php, args = '`titulo` (string, sí), `texto` (string, no)') => (dir) => {
        edit('specs/_shared.md', '## Criterios comunes', `## Componentes compartidos\n\nCada componente vive en \`template-parts/components/<nombre>.php\` y recibe sus datos por \`$args\`.\n\n### titulo-seccion\n\n- **Origen:** index.html:40-44\n- **Destino:** \`template-parts/components/titulo-seccion.php\`\n- **Argumentos:** ${args}\n- **Se usa en:** home › hero\n\n## Criterios comunes`)(dir);
        if (php !== null) {
            mkdirSync(join(dir, 'template-parts/components'), { recursive: true });
            writeFileSync(join(dir, 'template-parts/components/titulo-seccion.php'), php);
        }
    };
    const componentPhp = (keys) => `<?php\ndefined('ABSPATH') || exit;\n${keys.map((k) => `$${k} = $args['${k}'] ?? '';`).join('\n')}\n`;
    const componentWarnings = (r) => r.json.warnings.filter((w) => /Componente|componente|Argumentos|destino/.test(w.message));

    test('check: un componente igual a lo que dice _shared.md no avisa', () => {
        const r = broken('componente-ok', withComponent(componentPhp(['titulo', 'texto'])));
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(componentWarnings(r), []);
    });

    test('check: un componente cambiado en el código sin tocar el spec avisa', () => {
        const extra = broken('componente-extra', withComponent(componentPhp(['titulo', 'texto', 'titulo_color'])));
        assert.ok(extra.json.warnings.some((w) => /usa \$args\['titulo_color'\], que no está en "Argumentos"/.test(w.message)), JSON.stringify(extra.json.warnings));
        const gone = broken('componente-menos', withComponent(componentPhp(['titulo'])));
        assert.ok(gone.json.warnings.some((w) => /"Argumentos" lista texto, que el componente ya no usa/.test(w.message)), JSON.stringify(gone.json.warnings));
        const moved = broken('componente-movido', withComponent(null));
        assert.ok(moved.json.warnings.some((w) => /no existe en el tema: si se movió o se renombró/.test(w.message)), JSON.stringify(moved.json.warnings));
        const undocumented = broken('componente-nuevo', (dir) => {
            withComponent(componentPhp(['titulo', 'texto']))(dir);
            writeFileSync(join(dir, 'template-parts/components/boton.php'), componentPhp(['texto']));
        });
        assert.ok(undocumented.json.warnings.some((w) => w.file === 'template-parts/components/boton.php' && /sin documentar/.test(w.message)), JSON.stringify(undocumented.json.warnings));
    });

    test('check: "Argumentos" sin comillas invertidas también se lee', () => {
        const r = broken('componente-sin-comillas', withComponent(componentPhp(['titulo', 'texto']), 'titulo (string, sí), texto (string, no)'));
        assert.deepEqual(componentWarnings(r), []);
    });

    // ---------- status ----------
    const viteTheme = () => {
        const dir = join(tmp, `status-${Math.random().toString(36).slice(2)}`);
        cpSync(join(fixtures, 'tema-ok'), dir, { recursive: true });
        for (const rel of ['pages', 'template-parts', 'inc']) mkdirSync(join(dir, rel), { recursive: true });
        writeFileSync(join(dir, 'front-page.php'), '<?php\n');
        writeFileSync(join(dir, 'inc/enqueue.php'), '<?php\n');
        writeFileSync(join(dir, 'vite.config.ts'), '');
        writeFileSync(join(dir, 'inc/images.php'), "<?php\nfunction demo_image($img) {}\nfunction demo_link($l) {}\nfunction demo_highlight($t) {}\n");
        return dir;
    };

    test('status: un tema wp-vite-theme no pregunta la estructura y trae prefijo, helpers y páginas por estado', () => {
        const r = run('status.mjs', ['--target', viteTheme()]);
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.viteTheme, true);
        assert.equal(r.json.askStructure, false);
        assert.equal(r.json.prefix, 'demo');
        assert.deepEqual(r.json.helpers, { images: 'demo', links: 'demo', text: 'demo' });
        assert.equal(r.json.specs, true);
        assert.ok(Object.keys(r.json.pagesByState).length > 0);
        assert.equal(r.json.acfEngine, null);
    });

    test('status: sin las señales de wp-vite-theme pide confirmar la estructura; sin tema falla', () => {
        const r = run('status.mjs', ['--target', join(fixtures, 'tema-ok')]);
        assert.equal(r.json.askStructure, true);
        assert.match(r.json.next[0], /Estructura distinta/);
        const noTheme = run('status.mjs', ['--target', tmp]);
        assert.equal(noTheme.code, 1);
    });

    // ---------- fuente Figma: specs/figma/enlaces ----------
    const figmaTheme = join(tmp, 'tema-figma');
    mkdirSync(figmaTheme);
    writeFileSync(join(figmaTheme, 'style.css'), '/*\nTheme Name: Demo Figma\n*/\n');
    writeFileSync(join(figmaTheme, 'functions.php'), '<?php\n');
    const enlaces = (name) => join(figmaTheme, 'specs/figma/enlaces', name);

    test('init --figma: dry-run no escribe nada', () => {
        const r = run('init.mjs', ['--figma', '--target', figmaTheme, '--dry-run']);
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.create, ['specs/figma/enlaces/_ejemplo.md', 'specs/figma/enlaces/home.md']);
        assert.equal(existsSync(join(figmaTheme, 'specs')), false);
    });

    test('init --figma: crea solo _ejemplo.md y home.md, sin tocar specs/_index.md ni CLAUDE.md', () => {
        const r = run('init.mjs', ['--figma', '--target', figmaTheme]);
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.written, ['specs/figma/enlaces/_ejemplo.md', 'specs/figma/enlaces/home.md']);
        assert.match(readFileSync(enlaces('home.md'), 'utf8'), /^# Figma: home/);
        assert.match(readFileSync(enlaces('home.md'), 'utf8'), /\*\*Frame de la página:\*\* pendiente/);
        assert.doesNotMatch(readFileSync(enlaces('home.md'), 'utf8'), /\{\{/);
        assert.match(readFileSync(enlaces('_ejemplo.md'), 'utf8'), /node-id=1-2/);
        assert.equal(existsSync(join(figmaTheme, 'specs/_index.md')), false);
        assert.equal(existsSync(join(figmaTheme, 'CLAUDE.md')), false);
    });

    test('init --figma: un segundo init es conflicto (2) y no pisa lo que el usuario ya llenó', () => {
        writeFileSync(enlaces('home.md'), '# Figma: home\n\nmi contenido\n');
        const r = run('init.mjs', ['--figma', '--target', figmaTheme]);
        assert.equal(r.code, 2, r.stdout);
        assert.equal(readFileSync(enlaces('home.md'), 'utf8'), '# Figma: home\n\nmi contenido\n');
        const skip = run('init.mjs', ['--figma', '--target', figmaTheme, '--skip', 'specs/figma/enlaces/_ejemplo.md,specs/figma/enlaces/home.md']);
        assert.equal(skip.code, 0, skip.stdout);
        assert.deepEqual(skip.json.written, []);
        assert.equal(readFileSync(enlaces('home.md'), 'utf8'), '# Figma: home\n\nmi contenido\n');
        const over = run('init.mjs', ['--figma', '--target', figmaTheme, '--overwrite', 'specs/figma/enlaces/home.md', '--skip', 'specs/figma/enlaces/_ejemplo.md']);
        assert.equal(over.code, 0, over.stdout);
        assert.match(readFileSync(enlaces('home.md'), 'utf8'), /pendiente/);
    });

    test('init --page: una fuente "figma:<página>" exige su archivo en specs/figma/enlaces/', () => {
        const dir = join(tmp, 'tema-fuente-figma');
        mkdirSync(dir);
        writeFileSync(join(dir, 'style.css'), '/*\nTheme Name: Demo Fuente\n*/\n');
        writeFileSync(join(dir, 'functions.php'), '<?php\n');
        assert.equal(run('init.mjs', ['--target', dir]).code, 0);
        const page = (source) => run('init.mjs', ['--target', dir, '--page', 'home', '--title', 'Inicio', '--source', source, '--template', 'front-page.php']);

        const missing = page('figma:home');
        assert.equal(missing.code, 1, missing.stdout);
        assert.match(missing.json.error, /falta specs\/figma\/enlaces\/home\.md/);
        assert.equal(existsSync(join(dir, 'specs/home.md')), false, 'no registra la página si faltan los enlaces');
        assert.equal(page('figma:Sobre Nosotros').code, 1);

        assert.equal(run('init.mjs', ['--figma', '--target', dir]).code, 0);
        const ok = page('figma:home');
        assert.equal(ok.code, 0, ok.stdout);
        assert.match(readFileSync(join(dir, 'specs/home.md'), 'utf8'), /\*\*Fuente:\*\* `figma:home`/);
        assert.match(readFileSync(join(dir, 'specs/_index.md'), 'utf8'), /\[home\.md\]\(home\.md\)/);
    });

    test('init --figma: no se combina con --page', () => {
        const r = run('init.mjs', ['--figma', '--page', 'home', '--target', figmaTheme]);
        assert.equal(r.code, 1);
    });

    test('status: sin specs/figma/ no aparece "figma" y con ella cuenta las páginas con y sin links', () => {
        const plain = join(tmp, 'tema-sin-figma');
        mkdirSync(plain);
        writeFileSync(join(plain, 'style.css'), '/*\nTheme Name: Demo\n*/\n');
        writeFileSync(join(plain, 'functions.php'), '<?php\n');
        const without = run('status.mjs', ['--target', plain]);
        assert.equal(without.code, 0, without.stdout);
        assert.equal('figma' in without.json, false);

        // home.md recién creada (sin links) y una página con un link fuera de comentarios
        writeFileSync(enlaces('home.md'), '# Figma: home\n\n- **Frame de la página:** pendiente\n\n<!-- https://www.figma.com/design/AAA/Demo?node-id=1-2 -->\n');
        writeFileSync(enlaces('servicios.md'), '# Figma: servicios\n\n- **Frame de la página:** https://www.figma.com/design/BBB/Demo?node-id=3-4\n');
        const r = run('status.mjs', ['--target', figmaTheme]);
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.figma, { pages: 2, withLinks: ['servicios'], withoutLinks: ['home'] });
        assert.ok(r.json.next.some((line) => /Figma: faltan los links de 1 página\(s\): home/.test(line)), r.stdout);

        writeFileSync(enlaces('home.md'), '# Figma: home\n\n- **Frame de la página:** https://www.figma.com/design/AAA/Demo?node-id=1-2\n');
        const done = run('status.mjs', ['--target', figmaTheme]);
        assert.deepEqual(done.json.figma, { pages: 2, withLinks: ['home', 'servicios'], withoutLinks: [] });
        assert.equal(done.json.next.some((line) => /^Figma:/.test(line)), false);
    });

    // ---------- figma-links: validador de specs/figma/enlaces ----------
    const linksTheme = join(tmp, 'tema-enlaces');
    mkdirSync(linksTheme);
    writeFileSync(join(linksTheme, 'style.css'), '/*\nTheme Name: Demo Enlaces\n*/\n');
    writeFileSync(join(linksTheme, 'functions.php'), '<?php\n');
    const KEY = 'FumWuCPT1PPDg5vBTYoufA';
    const OTHER = 'ZZZZZZZZZZZZZZZZZZZZZZ';
    const fig = (node, key = KEY) => `https://www.figma.com/design/${key}/Demo?node-id=${node}&t=abc-4`;
    const writeEnlaces = (name, text) => {
        mkdirSync(join(linksTheme, 'specs/figma/enlaces'), { recursive: true });
        writeFileSync(join(linksTheme, 'specs/figma/enlaces', name), text);
    };
    const links = (...extra) => run('figma-links.mjs', ['--target', linksTheme, ...extra]);
    const errorMessages = (r) => r.json.pages.flatMap((p) => p.errors.map((e) => e.message)).join('\n');

    test('figma-links: sin specs/figma/enlaces falla con código 1', () => {
        const r = links();
        assert.equal(r.code, 1);
        assert.match(r.json.error, /init\.mjs --figma/);
    });

    test('figma-links: la home de ejemplo recién creada es válida pero pendiente', () => {
        assert.equal(run('init.mjs', ['--figma', '--target', linksTheme]).code, 0);
        const r = links();
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.summary.pending, ['home']);
        assert.equal(r.json.summary.errors, 0);
        assert.equal(r.json.pages.length, 1, '_ejemplo.md es una guía y no se lee');
        const strict = links('--require-complete');
        assert.equal(strict.code, 4);
        assert.match(errorMessages(strict), /sigue en "pendiente"/);
    });

    test('figma-links: una página completa (frame y secciones con nombre propio) es válida', () => {
        writeEnlaces('home.md', [
            '# Figma: home', '', `- **Frame de la página:** ${fig('3638-2095')}`, '', '## Secciones', '',
            '<!-- los comentarios no cuentan: - cualquier: cosa -->',
            `- cintillo: ${fig('3638-2096')}`, `- header: ${fig('3704-18079')}`, `- hero: ${fig('3638-2098')}`,
            `- servicios: ${fig('3638-2125')}`, `- sobre-barbara: ${fig('3638-2200')}`, `- footer: ${fig('3704-18144')}`, '',
        ].join('\n'));
        const r = links('--page', 'home');
        assert.equal(r.code, 0, r.stdout);
        const home = r.json.pages[0];
        assert.equal(home.frame.fileKey, KEY);
        assert.equal(home.frame.nodeId, '3638:2095', 'el node-id queda con ":" como pide el MCP');
        assert.deepEqual(home.sections.map((s) => s.name), ['cintillo', 'header', 'hero', 'servicios', 'sobre-barbara', 'footer']);
        assert.equal(home.sections[2].nodeId, '3638:2098');
        assert.equal(r.json.summary.sections, 6);
        assert.deepEqual(r.json.summary.pending, []);
    });

    test('figma-links: un link de rama usa la clave de la rama y las secciones pueden quedar vacías', () => {
        writeEnlaces('contacto.md', `# Figma: contacto\n\n- **Frame de la página:** https://www.figma.com/design/${KEY}/branch/${OTHER}/Demo?node-id=5%3A6\n\n## Secciones\n`);
        const r = links('--page', 'contacto');
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.pages[0].frame.fileKey, OTHER);
        assert.equal(r.json.pages[0].frame.nodeId, '5:6');
        assert.deepEqual(r.json.pages[0].sections, []);
    });

    test('figma-links: avisa cada error con su línea (links, nombres, repetidos y título)', () => {
        writeEnlaces('mal.md', [
            '# Figma: otra', // 1: el título no es "mal"
            '', // 2
            '<!-- comentario', // 3
            'de dos líneas -->', // 4
            `- **Frame de la página:** https://www.figma.com/design/${KEY}/Demo`, // 5: sin node-id
            '', '## Secciones', '', // 6-8
            `- Sobre Nosotros: ${fig('1-2')}`, // 9: nombre inválido (con espacio)
            `- hero ${fig('1-3')}`, // 10: falta ":"
            `- hero: ${fig('1-4')}`, // 11: ok
            `- hero: ${fig('1-5')}`, // 12: nombre repetido
            `- precios: ${fig('1-4')}`, // 13: mismo frame que hero
            `- tablero: https://www.figma.com/board/${KEY}/Demo?node-id=1-6`, // 14: no es de diseño
            `- clave: https://www.figma.com/design/corta/Demo?node-id=1-7`, // 15: clave inválida
            '- vacio: algo sin link', // 16
            'texto suelto', // 17
        ].join('\n'));
        const r = links('--page', 'mal');
        assert.equal(r.code, 4, r.stdout);
        const byLine = Object.fromEntries(r.json.pages[0].errors.map((e) => [e.line, e.message]));
        assert.match(byLine[1], /"otra" pero el archivo es "mal\.md"/);
        assert.match(byLine[5], /no trae node-id/);
        assert.match(byLine[9], /Nombre de sección inválido "Sobre Nosotros"/);
        assert.match(byLine[10], /¿Falta ":" después del nombre\?/);
        assert.equal(byLine[11], undefined, 'la primera "hero" es válida');
        assert.match(byLine[12], /ya está en la línea 11/);
        assert.match(byLine[13], /mismo frame que "hero"/);
        assert.match(byLine[14], /"board" no sirve/);
        assert.match(byLine[15], /clave del archivo/);
        assert.match(byLine[16], /necesita un link de Figma/);
        assert.match(byLine[17], /No se entiende la línea/);
    });

    test('figma-links: avisos (no errores) para una sección de otro archivo o que es la página entera', () => {
        writeEnlaces('avisos.md', [
            '# Figma: avisos', '', `- **Frame de la página:** ${fig('9-1')}`, '', '## Secciones', '',
            `- completa: ${fig('9-1')}`, `- ajena: ${fig('9-2', OTHER)}`, `- pronto: pendiente`, '',
        ].join('\n'));
        const r = links('--page', 'avisos');
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.summary.errors, 0);
        assert.equal(r.json.summary.warnings, 2);
        assert.match(r.json.pages[0].warnings.map((w) => w.message).join('\n'), /frame completo de la página/);
        assert.equal(r.json.summary.sections, 2, 'la sección "pendiente" no cuenta como leída');
    });

    test('figma-links: --page con una página que no existe falla con código 1', () => {
        const r = links('--page', 'nada');
        assert.equal(r.code, 1);
        assert.ok(r.json.available.includes('home'));
    });

    // ---------- figma-lectura y figma-inventario: specs/figma/lectura ----------
    const lecTheme = join(tmp, 'tema-lectura');
    mkdirSync(lecTheme);
    writeFileSync(join(lecTheme, 'style.css'), '/*\nTheme Name: Demo Lectura\n*/\n');
    writeFileSync(join(lecTheme, 'functions.php'), '<?php\n');
    const lecDir = join(lecTheme, 'specs/figma/lectura');
    const touch = (rel, content = 'x') => {
        mkdirSync(dirname(join(lecDir, rel)), { recursive: true });
        writeFileSync(join(lecDir, rel), content);
    };
    // Cabeceras reales: el validador mira los primeros bytes, no solo la extensión.
    const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const JPG_BYTES = Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex');
    // Una sección leída con sus archivos (referencia, captura e imagen) creados de verdad.
    const seccion = (page, name, nodeId, extra = {}) => {
        touch(`${page}/${name}.ref.txt`, 'export default function Frame() {}');
        touch(`${page}/${name}.png`, 'png');
        touch(`${page}/assets/${name}-foto.png`, PNG_BYTES);
        return {
            nombre: name, nodeId, nombreCapa: 'Frame 40', estado: 'leida', leidoEn: '2026-11-04', tamano: { ancho: 1920, alto: 626 },
            referencia: `${page}/${name}.ref.txt`, captura: `${page}/${name}.png`,
            textos: [{ nodeId: '1:1', texto: 'Hola', estilo: '2026/Display', color: 'color/verde', rol: 'titulo' }],
            sueltos: { espacios: [{ valor: 22, usos: 2 }], colores: [], radios: [{ valor: 100, usos: 1 }] },
            imagenes: [{ id: `${name}-foto`, nodeId: '1:2', tipo: 'png', ancho: 940, alto: 626, rol: 'contenido', archivo: `${page}/assets/${name}-foto.png` }],
            componentes: [{ nombre: 'Botón', variante: 'Frambuesa', props: { texto: 'Ir', flecha: true } }],
            senales: [],
            ...extra,
        };
    };
    const pendiente = (name, nodeId) => ({ nombre: name, nodeId, estado: 'pendiente' });
    const pagina = (page, secciones, tokens = {}) => ({
        formato: 1, pagina: page, fuente: { fileKey: KEY, nodeId: '3638:2095', ancho: 1920, alto: 6509 },
        tokens: {
            colores: { 'color/verde': '#234549', 'color/teal': '#9cb0b0' },
            texto: { '2026/Display': { familia: 'Barlow Condensed', peso: 600, tamano: 52, interlineado: 1, espaciado: { valor: 0, unidad: '%' } } },
            sombras: {},
            ...tokens,
        },
        secciones,
    });
    const writeLectura = (data) => {
        mkdirSync(lecDir, { recursive: true });
        writeFileSync(join(lecDir, `${data.pagina}.json`), JSON.stringify(data, null, 2));
    };
    const lectura = (...extra) => run('figma-lectura.mjs', ['--target', lecTheme, ...extra]);
    const inventario = (...extra) => run('figma-inventario.mjs', ['--target', lecTheme, ...extra]);
    const lecErrors = (r) => r.json.pages.flatMap((p) => p.errors.map((e) => `${e.path}: ${e.message}`)).join('\n');

    test('figma-lectura / figma-inventario: sin lecturas fallan con código 1', () => {
        assert.equal(lectura().code, 1);
        assert.match(lectura().json.error, /todavía no se leyó/);
        assert.equal(inventario().code, 1);
    });

    test('figma-lectura: una lectura completa es válida y la sección sin leer cuenta como pendiente', () => {
        writeLectura(pagina('home', [
            seccion('home', 'hero', '3638:2098'), seccion('home', 'servicios', '3638:2125'), pendiente('contacto', '3638:2200'),
        ]));
        const r = lectura();
        assert.equal(r.code, 0, r.stdout);
        assert.deepEqual(r.json.summary, { pages: 1, sectionsRead: 2, sectionsPending: 1, errors: 0, warnings: 0 });
    });

    test('figma-lectura: acepta los nodeId de nodos dentro de una instancia de componente', () => {
        const header = seccion('instancia', 'header', '3704:18079');
        header.textos[0].nodeId = 'I3704:18079;3704:22279';
        header.imagenes[0].nodeId = 'I3704:18079;3704:22280;3704:22281';
        writeLectura(pagina('instancia', [header]));
        const ok = lectura('--page', 'instancia');
        assert.equal(ok.code, 0, ok.stdout);
        header.textos[0].nodeId = 'I3704;abc';
        writeLectura(pagina('instancia', [header]));
        const bad = lectura('--page', 'instancia');
        assert.equal(bad.code, 4);
        assert.match(lecErrors(bad), /nodeId inválido/);
        rmSync(join(lecDir, 'instancia.json'));
    });

    test('figma-lectura: errores de forma, archivos, imágenes y links temporales', () => {
        const hero = seccion('mala', 'hero', '3638:2098');
        hero.referencia = '../afuera.txt';
        hero.captura = 'mala/no-existe.png';
        hero.textos[0].rol = 'gigante';
        hero.imagenes = [
            { id: 'a', nodeId: '1:3', tipo: 'bmp', ancho: 10, alto: 10, rol: 'contenido', archivo: 'mala/assets/hero-foto.png' },
            { id: 'a', nodeId: '1:4', tipo: 'svg', ancho: 10, alto: 10, rol: 'decorativa', archivo: 'mala/assets/hero-foto.png' },
            { id: 'b', nodeId: '1:5', tipo: 'png', ancho: 10, alto: 10, rol: 'contenido', archivo: 'https://www.figma.com/api/mcp/asset/abc/7ad66.png' },
        ];
        touch('mala/assets/disfrazada.png', JPG_BYTES); // un JPEG bajo un nombre .png (lo que Figma entregó en el hero)
        touch('mala/assets/vacia.jpg', 'esto no es una imagen');
        hero.imagenes.push(
            { id: 'c', nodeId: '1:6', tipo: 'png', ancho: 10, alto: 10, rol: 'contenido', archivo: 'mala/assets/disfrazada.png' },
            { id: 'd', nodeId: '1:7', tipo: 'jpg', ancho: 10, alto: 10, rol: 'contenido', archivo: 'mala/assets/vacia.jpg' },
        );
        hero.senales = [{ tipo: 'slider', evidencia: 'flechas', estado: 'quizá' }];
        const data = pagina('mala', [hero], {
            colores: { 'color/verde': 'verde' },
            texto: { '2026/Eyebrow': { familia: 'Barlow Condensed', peso: 500, tamano: 18, interlineado: 1.3, espaciado: 4 } },
        });
        data.formato = 2;
        writeLectura(data);
        const r = lectura('--page', 'mala');
        assert.equal(r.code, 4, r.stdout);
        const messages = lecErrors(r);
        assert.match(messages, /"formato" debe ser 1/);
        assert.match(messages, /links temporales de descarga/);
        assert.match(messages, /color\/verde: El color debe ser hexadecimal/);
        assert.match(messages, /espaciado: El espaciado entre letras lleva su unidad/);
        assert.match(messages, /referencia: La ruta "\.\.\/afuera\.txt" debe ser relativa/);
        assert.match(messages, /captura: No existe el archivo "mala\/no-existe\.png"/);
        assert.match(messages, /rol: "rol" debe ser uno de: eyebrow/);
        assert.match(messages, /tipo: "tipo" debe ser uno de: png, jpg, svg/);
        assert.match(messages, /El id "a" está repetido/);
        assert.match(messages, /La extensión "\.png" no coincide con el tipo "svg"/);
        assert.match(messages, /es realmente un JPG, no un PNG: pon tipo "jpg" y la extensión "\.jpg"/);
        assert.match(messages, /"mala\/assets\/vacia\.jpg" no parece una imagen/);
        assert.match(messages, /estado: "estado" debe ser "propuesto"/);
        assert.match(r.json.pages[0].warnings.map((w) => w.message).join('\n'), /"2026\/Display" no está en los tokens de la página/);
    });

    test('figma-lectura: si el link de enlaces/ cambió, la lectura queda vieja', () => {
        mkdirSync(join(lecTheme, 'specs/figma/enlaces'), { recursive: true });
        writeFileSync(join(lecTheme, 'specs/figma/enlaces/home.md'), [
            '# Figma: home', '', `- **Frame de la página:** ${fig('3638-9999')}`, '', '## Secciones', '',
            `- hero: ${fig('3638-7777')}`, `- servicios: ${fig('3638-2125')}`, `- nueva: ${fig('3638-5555')}`, '',
        ].join('\n'));
        const r = lectura('--page', 'home');
        assert.equal(r.code, 4, r.stdout);
        const messages = lecErrors(r);
        assert.match(messages, /fuente: El frame de la página en enlaces\/ ya no es el que se leyó/);
        assert.match(messages, /El link de "hero" cambió en enlaces\/ \(3638:7777\) y la lectura es de 3638:2098/);
        assert.match(r.json.pages[0].warnings.map((w) => w.message).join('\n'), /"nueva" está en enlaces\/ pero todavía no se lee/);
        rmSync(join(lecTheme, 'specs/figma/enlaces'), { recursive: true, force: true });
    });

    test('figma-inventario: no arma nada si hay lecturas con errores', () => {
        const r = inventario();
        assert.equal(r.code, 4, r.stdout);
        assert.equal(existsSync(join(lecDir, '_inventario.json')), false);
        assert.equal(r.json.pages[0].page, 'mala');
    });

    test('figma-inventario: une las páginas con las claves de analyze.mjs', () => {
        rmSync(join(lecDir, 'mala.json'));
        const header = (page, node) => seccion(page, 'header', node, { componentes: [{ nombre: 'Header', variante: null, props: {} }], imagenes: [] });
        const hero = seccion('home', 'hero', '3638:2098', {
            sueltos: { espacios: [{ valor: 22, usos: 2 }], colores: [{ valor: '#9EC0C1', usos: 3 }], radios: [{ valor: 100, usos: 1 }] },
            senales: [{ tipo: 'slider', evidencia: 'dos flechas a los lados de las cards', estado: 'propuesto' }],
        });
        const form = seccion('nosotros', 'contacto', '4:2', {
            senales: [
                { tipo: 'formulario', evidencia: 'campos y botón enviar', estado: 'confirmado' },
                { tipo: 'listado', evidencia: 'tarjetas con "ver más"', estado: 'propuesto' },
            ],
            sueltos: { espacios: [{ valor: 22, usos: 1 }, { valor: 16, usos: 5 }], colores: [], radios: [] },
        });
        writeLectura(pagina('home', [header('home', '3704:1'), hero, seccion('home', 'servicios', '3638:2125'), pendiente('contacto', '3638:2200')]));
        writeLectura(pagina('nosotros', [header('nosotros', '3704:2'), form], {
            colores: { 'color/verde': '#234550', 'color/teal': '#9cb0b0', 'green 20': '#9EC0C0' },
            sombras: { 'shadow header': 'Effect(type: DROP_SHADOW)' },
        }));
        const r = inventario();
        assert.equal(r.code, 0, r.stdout);
        const inv = JSON.parse(readFileSync(join(lecDir, '_inventario.json'), 'utf8'));

        for (const key of Object.keys(analysis.json).filter((k) => k !== 'ok')) assert.ok(key in inv, `falta la clave "${key}" de analyze.mjs`);
        assert.equal(inv.source, 'figma');
        assert.deepEqual(inv.summary, { pages: 2, sections: 5, sectionsPending: 1, images: 3, repeatedGroups: 2, interactions: 2, dynamicCandidates: 1, findings: 4 });

        const ids = Object.fromEntries(inv.findings.map((f) => [f.id, f]));
        assert.deepEqual(Object.keys(ids).sort(), ['figma-color-parecido', 'figma-seccion-pendiente', 'figma-senal-propuesta', 'figma-token-conflict']);
        assert.equal(ids['figma-token-conflict'].locations[0].token, 'color/verde');
        assert.ok(ids['figma-color-parecido'].locations.some((l) => /green 20/.test(l.b) && /color\/teal/.test(l.a)), 'green 20 y color/teal son casi iguales');
        assert.deepEqual(ids['figma-seccion-pendiente'].locations, [{ page: 'home', section: 'contacto' }]);

        const suelto = inv.tokens.colors.find((c) => c.suelto);
        assert.equal(suelto.value, '#9ec0c1');
        assert.equal(suelto.cercano.name, 'green 20');
        assert.deepEqual(inv.tokens.spacing.find((s) => s.valor === 16), { valor: 16, usos: 5, paginas: ['nosotros'] });
        assert.deepEqual(inv.tokens.spacing[0], { valor: 22, usos: 9, paginas: ['home', 'nosotros'] }, 'suma entre páginas y va primero (el más usado)');
        assert.deepEqual(inv.tokens.fonts, [{ familia: 'Barlow Condensed', pesos: [600] }]);
        assert.equal(inv.tokens.shadows[0].name, 'shadow header');

        const grupoHeader = inv.repeated.find((g) => g.nombre === 'Header');
        assert.ok(grupoHeader && grupoHeader.kind === 'cross-page' && grupoHeader.count === 2, 'el Header sale en las dos páginas');
        assert.equal(inv.repeated.find((g) => g.nombre === 'Botón').kind, 'cross-page');
        assert.deepEqual(inv.siteWide.chrome.map((g) => g.nombre), ['Header']);
        assert.deepEqual(inv.siteWide.repeated.map((g) => g.nombre), ['Botón']);

        assert.deepEqual(inv.interactions.map((i) => [i.type, i.suggestedSkill]).sort(), [['formulario', 'wp-form'], ['slider', null]]);
        assert.equal(inv.dynamicCandidates[0].page, 'nosotros');
        assert.equal(inv.assets.images.length, 3);
        assert.equal(inv.pages.find((p) => p.title === 'home').sections.find((s) => s.name === 'contacto').estado, 'pendiente');
    });

    test('figma-inventario: --page une solo esa página y --out cambia el destino', () => {
        const out = join(tmp, 'solo-home.json');
        const r = inventario('--page', 'home', '--out', out);
        assert.equal(r.code, 0, r.stdout);
        const inv = JSON.parse(readFileSync(out, 'utf8'));
        assert.deepEqual(inv.pages.map((p) => p.title), ['home']);
        assert.equal(inv.repeated.find((g) => g.nombre === 'Header'), undefined, 'con una sola página el Header no se repite');
    });
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallos' : ''}.`);
