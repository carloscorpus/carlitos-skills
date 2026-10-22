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
        const spec = readFileSync(join(theme, 'specs/productos.md'), 'utf8');
        assert.match(spec, /\*\*Tipo:\*\* listado/);
        assert.match(spec, /\*\*Contenido:\*\* producto/);
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
        rmSync(join(theme, 'specs/productos.md'));
        rmSync(join(theme, 'specs/producto.md'));
        const indexPath = join(theme, 'specs/_index.md');
        writeFileSync(indexPath, readFileSync(indexPath, 'utf8').split('\n').filter((line) => !/\((productos|producto)\.md\)/.test(line)).join('\n'));
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
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallos' : ''}.`);
