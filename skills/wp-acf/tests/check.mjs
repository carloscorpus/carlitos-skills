#!/usr/bin/env node
// Prueba de wp-acf: generate, check e install contra un tema de ejemplo. Sin dependencias.
//
// Uso: node skills/wp-acf/tests/check.mjs
// Sale 0 si todo pasa, 1 si algo falla. El PHP del motor no se ejecuta aquí (no hay php en la prueba):
// solo se comprueba que se instale con el prefijo del tema y sin placeholders.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

const tmp = mkdtempSync(join(tmpdir(), 'wp-acf-'));
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

// Copia del tema de ejemplo; `edit` lo modifica antes de usarlo.
let counter = 0;
const theme = (edit = () => {}) => {
    const dir = join(tmp, `tema-${counter++}`);
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
const readJson = (dir, rel) => JSON.parse(readFileSync(join(dir, rel), 'utf8'));
const messages = (r) => (r.json?.errors ?? []).map((e) => e.message).join('\n');
const generated = () => {
    const dir = theme();
    const r = run('generate.mjs', ['--target', dir]);
    assert.equal(r.code, 0, r.stdout);
    return { dir, r };
};

try {
    // ---------- generate ----------
    test('generate --dry-run: resume lo que escribiría y no escribe nada', () => {
        const dir = theme();
        const r = run('generate.mjs', ['--target', dir, '--dry-run']);
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.dryRun, true);
        assert.deepEqual([...r.json.pages].sort(), ['home', 'opciones', 'producto', 'productos']);
        assert.equal(r.json.groups, 4);
        assert.deepEqual(r.json.postTypes, ['producto']);
        assert.deepEqual(r.json.taxonomies, ['categoria_producto']);
        assert.deepEqual(r.json.optionsPages.sort(), ['ajustes-del-sitio', 'archivo-de-producto']);
        assert.ok(!existsSync(join(dir, 'acf-json')), 'un dry-run no escribe');
    });

    test('generate: escribe un JSON por grupo, tipo de contenido, taxonomía y página de opciones', () => {
        const { dir, r } = generated();
        assert.equal(r.json.written.length, 9);
        const files = readdirSync(join(dir, 'acf-json'));
        assert.equal(files.filter((f) => f.startsWith('group_')).length, 4);
        assert.equal(files.filter((f) => f.startsWith('post_type_')).length, 1);
        assert.equal(files.filter((f) => f.startsWith('taxonomy_')).length, 1);
        assert.equal(files.filter((f) => f.startsWith('ui_options_page_')).length, 2);
        assert.ok(existsSync(join(dir, 'inc/acf/paginas.php')));
    });

    test('generate: el grupo de la portada trae sus secciones, subcampos, repeater y ubicación', () => {
        const { dir, r } = generated();
        const rel = r.json.files.find((f) => f.kind === 'group' && f.name === 'home').rel;
        const group = readJson(dir, rel);
        assert.equal(group.title, 'Inicio');
        assert.deepEqual(group.location, [[{ param: 'page_type', operator: '==', value: 'front_page' }]]);
        const hero = group.fields[0];
        assert.equal(hero.name, 'home_hero');
        assert.equal(hero.type, 'group');
        assert.equal(hero['aria-label'], '', 'ACF usa "aria-label" con guion');
        assert.equal(group.display_title, '');
        assert.deepEqual(hero.sub_fields.map((f) => f.name), ['titulo', 'boton', 'slides']);
        const titulo = hero.sub_fields[0];
        assert.equal(titulo.required, 1);
        assert.match(titulo.instructions, /Recomendado: ~30 caracteres/);
        assert.equal(titulo.maxlength, '', 'sin límites impuestos');
        assert.equal(titulo.label, 'Título');
        const slides = hero.sub_fields[2];
        assert.equal(slides.type, 'repeater');
        assert.deepEqual(slides.sub_fields.map((f) => [f.name, f.type]), [['imagen', 'image'], ['alt', 'text']]);
        assert.equal(slides.max, 0, 'sin límite de filas');
    });

    test('generate: ubicaciones de opciones y de tipo de contenido', () => {
        const { dir, r } = generated();
        const loc = (name) => readJson(dir, r.json.files.find((f) => f.kind === 'group' && f.name === name).rel).location[0][0];
        assert.deepEqual(loc('opciones'), { param: 'options_page', operator: '==', value: 'ajustes-del-sitio' });
        assert.deepEqual(loc('productos'), { param: 'options_page', operator: '==', value: 'archivo-de-producto' });
        assert.deepEqual(loc('producto'), { param: 'post_type', operator: '==', value: 'producto' });
    });

    test('generate: tipo de contenido, taxonomía y opciones en español y sin PHP', () => {
        const { dir, r } = generated();
        const pt = readJson(dir, r.json.files.find((f) => f.kind === 'post_type').rel);
        assert.equal(pt.post_type, 'producto');
        assert.equal(pt.labels.name, 'Productos');
        assert.equal(pt.labels.singular_name, 'Producto');
        assert.deepEqual(pt.taxonomies, ['categoria_producto']);
        const tax = readJson(dir, r.json.files.find((f) => f.kind === 'taxonomy').rel);
        assert.equal(tax.taxonomy, 'categoria_producto');
        assert.deepEqual(tax.object_type, ['producto']);
        assert.equal(tax.hierarchical, true);
        assert.equal(tax.labels.name, 'Categorías de producto');
        const options = r.json.files.filter((f) => f.kind === 'options_page').map((f) => readJson(dir, f.rel));
        const site = options.find((o) => o.menu_slug === 'ajustes-del-sitio');
        const archive = options.find((o) => o.menu_slug === 'archivo-de-producto');
        assert.equal(site.parent_slug, '');
        assert.equal(archive.parent_slug, 'ajustes-del-sitio', 'las demás páginas de opciones cuelgan de Ajustes del sitio');
        assert.equal(site.page_title, 'Ajustes del sitio');
    });

    test('generate: select con opciones, número, galería y true_false', () => {
        const { dir, r } = generated();
        const group = readJson(dir, r.json.files.find((f) => f.kind === 'group' && f.name === 'producto').rel);
        const byName = Object.fromEntries(group.fields[0].sub_fields.map((f) => [f.name, f]));
        assert.deepEqual(byName.material.choices, { madera: 'Madera', metal: 'Metal', tela: 'Tela' });
        assert.equal(byName.precio.type, 'number');
        assert.equal(byName.galeria.type, 'gallery');
        assert.equal(byName.destacado.ui, 1);
    });

    test('generate: claves estables y sin cambios si no cambia el spec', () => {
        const { dir, r } = generated();
        const before = Object.fromEntries(r.json.files.map((f) => [f.rel, readFileSync(join(dir, f.rel), 'utf8')]));
        const again = run('generate.mjs', ['--target', dir]);
        assert.equal(again.code, 0, again.stdout);
        assert.equal(again.json.written.length, 0);
        assert.equal(again.json.unchanged.length, 8 + 1, 'los 8 JSON y paginas.php');
        for (const [rel, text] of Object.entries(before)) assert.equal(readFileSync(join(dir, rel), 'utf8'), text, rel);
    });

    test('generate: un cambio en el spec es un conflicto que se resuelve con --overwrite', () => {
        const { dir, r } = generated();
        change('specs/opciones.md', '© Demo', '© Demo 2026')(dir);
        change('specs/opciones.md', '| `opciones_pie_copyright` | text |', '| `opciones_pie_telefono` | text | Teléfono del pie | (01) 500 | no |\n| `opciones_pie_copyright` | text |')(dir);
        const blocked = run('generate.mjs', ['--target', dir]);
        assert.equal(blocked.code, 2, blocked.stdout);
        const rel = r.json.files.find((f) => f.kind === 'group' && f.name === 'opciones').rel;
        assert.deepEqual(blocked.json.unresolved, [rel]);
        const done = run('generate.mjs', ['--target', dir, '--overwrite', rel]);
        assert.equal(done.code, 0, done.stdout);
        assert.deepEqual(readJson(dir, rel).fields[0].sub_fields.map((f) => f.name), ['telefono', 'copyright']);
        change('specs/opciones.md', '| `opciones_pie_copyright` | text |', '| `opciones_pie_correo` | email | Correo del pie | a@b.pe | no |\n| `opciones_pie_copyright` | text |')(dir);
        const skipped = run('generate.mjs', ['--target', dir, '--skip', rel]);
        assert.equal(skipped.code, 0, skipped.stdout);
        assert.deepEqual(skipped.json.skipped, [rel]);
        assert.deepEqual(readJson(dir, rel).fields[0].sub_fields.map((f) => f.name), ['telefono', 'copyright'], 'lo omitido no cambia');
    });

    test('generate: solo toma el estado pedido y respeta --page', () => {
        const dir = theme();
        const some = run('generate.mjs', ['--target', dir, '--dry-run', '--page', 'home']);
        assert.deepEqual(some.json.pages, ['home']);
        const more = run('generate.mjs', ['--target', dir, '--dry-run', '--states', 'aplicado,pendiente']);
        assert.ok(more.json.pages.includes('nosotros'));
        const none = run('generate.mjs', ['--target', dir, '--dry-run', '--page', 'nosotros']);
        assert.equal(none.code, 1);
        const unknown = run('generate.mjs', ['--target', dir, '--dry-run', '--page', 'nada']);
        assert.equal(unknown.code, 1);
    });

    test('generate: paginas.php lista las páginas estáticas con el estado pedido', () => {
        const { dir } = generated();
        const php = readFileSync(join(dir, 'inc/acf/paginas.php'), 'utf8');
        assert.match(php, /'home' => \['titulo' => 'Inicio', 'slug' => 'inicio', 'frente' => true, 'plantilla' => '', 'padre' => ''\]/);
        assert.ok(!php.includes("'productos'"), 'un listado no es una página de WordPress');
        assert.ok(!php.includes("'nosotros'"), 'está pendiente');
        const more = theme();
        run('generate.mjs', ['--target', more, '--states', 'aplicado,pendiente']);
        assert.match(readFileSync(join(more, 'inc/acf/paginas.php'), 'utf8'), /'nosotros' => \['titulo' => 'Nosotros', 'slug' => 'nosotros', 'frente' => false, 'plantilla' => 'pages\/template-nosotros\.php', 'padre' => ''\]/);
    });

    // equipo.md: una copia de nosotros.md (pendiente) que cuelga de `padre`.
    const child = (parent) => (dir) => {
        const text = readFileSync(join(dir, 'specs/nosotros.md'), 'utf8').replace(/\r\n/g, '\n');
        writeFileSync(join(dir, 'specs/equipo.md'), text.replaceAll('nosotros', 'equipo').replaceAll('Nosotros', 'Equipo')
            .replace('- **Notas de página:**', `- **Padre:** ${parent}\n- **Notas de página:**`));
        change('specs/_index.md', '<!-- design-import:paginas:fin -->', '| Equipo | [equipo.md](equipo.md) | `pages/template-equipo.php` | pendiente |\n<!-- design-import:paginas:fin -->')(dir);
    };
    const pending = ['--states', 'aplicado,pendiente'];

    test('generate: una página hija lleva su padre y va después de él en paginas.php', () => {
        const dir = theme(child('nosotros'));
        const r = run('generate.mjs', ['--target', dir, ...pending]);
        assert.equal(r.code, 0, r.stdout);
        const php = readFileSync(join(dir, 'inc/acf/paginas.php'), 'utf8');
        assert.match(php, /'equipo' => \[.*'slug' => 'equipo', .*'padre' => 'nosotros'\]/);
        assert.match(php, /'nosotros' => \[.*'padre' => ''\]/);
        assert.match(php, /'home' => \[.*'frente' => true, 'plantilla' => '', 'padre' => ''\]/);
        assert.ok(php.indexOf("'nosotros' =>") < php.indexOf("'equipo' =>"), 'el padre va antes que la hija');
    });

    test('generate: errores del padre', () => {
        const bad = (edit, states = pending) => run('generate.mjs', ['--target', theme(edit), '--dry-run', ...states]);
        const stateless = bad(child('home'), ['--states', 'pendiente']);
        assert.equal(stateless.code, 4, stateless.stdout);
        assert.match(messages(stateless), /Padre "home": está aplicado; aplícala primero o inclúyela en --states/);
        assert.match(messages(bad(child('productos'))), /Padre "productos": no es una página estática/);
        const cycle = bad(all(child('nosotros'), change('specs/nosotros.md', '- **Notas de página:**', '- **Padre:** equipo\n- **Notas de página:**')));
        assert.equal(cycle.json.errors.length, 1, cycle.stdout);
        assert.match(messages(cycle), /ciclo \(.+ → .+ → .+\)/);
    });

    test('generate: errores del spec que impiden generar', () => {
        const bad = (edit) => run('generate.mjs', ['--target', theme(edit), '--dry-run']);
        const type = bad(change('specs/producto.md', '| `producto_ficha_precio` | number |', '| `producto_ficha_precio` | post_object |'));
        assert.equal(type.code, 4);
        assert.match(messages(type), /post_object.*aún no lo genera/);
        const choices = bad(change('specs/producto.md', ' Opciones: Madera, Metal, Tela', ''));
        assert.match(messages(choices), /necesita "Opciones: a, b, c"/);
        const location = bad(change('specs/home.md', 'página de inicio (front page)', 'en algún lado'));
        assert.match(messages(location), /Ubicación no reconocida/);
        const parent = bad(change('specs/home.md', '| `home_hero_slides` | repeater | Fotos del slider | — | sí |\n', ''));
        assert.match(messages(parent), /falta la fila del repetidor "home_hero_slides"/);
        const content = bad(change('specs/producto.md', 'tipo de contenido = producto', 'tipo de contenido = servicio'));
        assert.match(messages(content), /"servicio" que no está en "Contenido dinámico"/);
        const long = bad(all(
            change('specs/_shared.md', '| producto | cpt |', '| producto_con_nombre_muy_largo | cpt |'),
            change('specs/producto.md', 'tipo de contenido = producto', 'tipo de contenido = producto_con_nombre_muy_largo'),
        ));
        assert.match(messages(long), /hasta 20 caracteres/);
    });

    // ---------- check ----------
    const checked = (edit = () => {}, args = []) => {
        const { dir } = generated();
        edit(dir);
        return { dir, r: run('check.mjs', ['--target', dir, ...args]) };
    };

    test('check: el tema de ejemplo pasa', () => {
        const { r } = checked();
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.pages, 4);
        assert.equal(r.json.connected, 2);
        assert.equal(r.json.groups, 4);
        assert.deepEqual(r.json.errors, []);
    });

    test('check: falta el JSON de una página', () => {
        const { r } = checked((dir) => {
            const home = readdirSync(join(dir, 'acf-json')).filter((f) => f.startsWith('group_')).find((f) => JSON.parse(readFileSync(join(dir, 'acf-json', f), 'utf8')).title === 'Inicio');
            rmSync(join(dir, 'acf-json', home));
        });
        assert.equal(r.code, 4);
        assert.match(messages(r), /Falta el JSON de la página home/);
    });

    test('check: un campo del spec que falta, que sobra o con otro tipo en el JSON', () => {
        const edited = (mutate) => checked((dir) => {
            const file = readdirSync(join(dir, 'acf-json')).filter((f) => f.startsWith('group_')).find((f) => JSON.parse(readFileSync(join(dir, 'acf-json', f), 'utf8')).title === 'Inicio');
            const json = readJson(dir, `acf-json/${file}`);
            mutate(json);
            writeFileSync(join(dir, 'acf-json', file), JSON.stringify(json, null, 4));
        }).r;
        assert.match(messages(edited((json) => json.fields[0].sub_fields.pop())), /El campo home_hero_slides del spec no está en el JSON/);
        assert.match(messages(edited((json) => json.fields[0].sub_fields.push({ key: 'field_extra', name: 'extra', type: 'text' }))), /home_hero_extra está en el JSON pero no en el spec/);
        assert.match(messages(edited((json) => { json.fields[0].sub_fields[0].type = 'textarea'; })), /home_hero_titulo: el spec dice text y el JSON textarea/);
        assert.match(messages(edited((json) => { json.fields[0].sub_fields[0].required = 0; })), /home_hero_titulo: "Requerido" no coincide/);
        assert.match(messages(edited((json) => { json.location = [[{ param: 'page_type', operator: '==', value: 'posts_page' }]]; })), /La ubicación del JSON no coincide/);
    });

    test('check: claves repetidas entre archivos', () => {
        const { r } = checked((dir) => {
            const files = readdirSync(join(dir, 'acf-json')).filter((f) => f.startsWith('group_'));
            const first = readJson(dir, `acf-json/${files[0]}`);
            const second = readJson(dir, `acf-json/${files[1]}`);
            second.fields[0].key = first.fields[0].key;
            writeFileSync(join(dir, 'acf-json', files[1]), JSON.stringify(second, null, 4));
        });
        assert.match(messages(r), /La clave field_.* también está en/);
    });

    test('check: la plantilla de una sección conectada debe leer su grupo', () => {
        const hero = 'template-parts/pages/home/hero.php';
        assert.match(messages(checked(change(hero, "get_field('home_hero')", "get_field('otro')")).r), /falta get_field\('home_hero'\)/);
        const footer = checked(change('footer.php', "get_field('opciones_pie', 'option')", "get_field('opciones_pie')")).r;
        assert.match(messages(footer), /lee get_field\('opciones_pie', 'option'\)/);
    });

    test('check: el texto fijo que sigue en la plantilla avisa', () => {
        const { r } = checked(change('template-parts/pages/home/hero.php', '<h1><?= esc_html($hero[\'titulo\'] ?? \'\') ?></h1>', '<h1>Hacemos crecer tu negocio</h1>'));
        assert.equal(r.code, 0, r.stdout);
        assert.ok(r.json.warnings.some((w) => /home_hero_titulo.*sigue fijo en la plantilla/.test(w.message)), JSON.stringify(r.json.warnings));
    });

    test('check: la carga debe existir y traer el grupo, los textos y los archivos', () => {
        const noSeed = checked((dir) => rmSync(join(dir, 'inc/acf/seed/home.php'))).r;
        assert.match(messages(noSeed), /Falta la carga inc\/acf\/seed\/home\.php/);
        const noGroup = checked(change('inc/acf/seed/home.php', "'home_hero' =>", "'otro' =>")).r;
        assert.match(messages(noGroup), /no trae el grupo home_hero/);
        const noText = checked(change('inc/acf/seed/home.php', "'titulo' => 'Hacemos crecer tu negocio'", "'titulo' => 'Otro'")).r;
        assert.match(messages(noText), /home_hero_titulo: el valor actual/);
        const noFile = checked(change('inc/acf/seed/home.php', 'assets/img/hero.webp', 'assets/img/nada.webp')).r;
        assert.match(messages(noFile), /El archivo "assets\/img\/nada\.webp" de la carga no existe/);
        const noPage = checked(change('inc/acf/seed/home.php', "'page'   => 'home'", "'page'   => 'otra'")).r;
        assert.match(messages(noPage), /lleva 'page' => 'home'/);
        const noOption = checked(change('inc/acf/seed/opciones.php', "'option' => true", "'option' => false")).r;
        assert.match(messages(noOption), /lleva 'option' => true/);
    });

    test('check: un valor actual con * o | se compara sin esos marcadores, igual que la carga', () => {
        const texto = 'Los campos con * son obligatorios.';
        const { r } = checked(all(
            change('specs/home.md', '| Hacemos crecer tu negocio |', `| ${texto} |`),
            change('inc/acf/seed/home.php', "'titulo' => 'Hacemos crecer tu negocio'", `'titulo' => '${texto}'`),
        ));
        assert.equal(r.code, 0, r.stdout);
        const resaltado = checked(all(
            change('specs/home.md', '| Hacemos crecer tu negocio |', '| Hacemos crecer \\|tu negocio\\| |'),
            change('inc/acf/seed/home.php', "'titulo' => 'Hacemos crecer tu negocio'", "'titulo' => 'Hacemos crecer |tu negocio|'"),
        )).r;
        assert.equal(resaltado.code, 0, resaltado.stdout);
    });

    test('check: una carga con la dirección absoluta del sitio es un error; rutas relativas y _page pasan', () => {
        const local = checked(change('inc/acf/seed/home.php', "['_page' => 'contacto']", "'http://copam.local/contacto/'")).r;
        assert.match(messages(local), /Enlace absoluto de desarrollo "http:\/\/copam\.local\/contacto\/"/);
        const relative = checked(change('inc/acf/seed/home.php', "['_page' => 'contacto']", "'/contacto/'")).r;
        assert.equal(relative.json.ok, true);
        assert.equal(checked().r.json.ok, true);
    });

    test('check: sin el motor instalado falla; una sección sin conectar solo avisa', () => {
        const noEngine = checked((dir) => rmSync(join(dir, 'inc/acf/runner.php'))).r;
        assert.match(messages(noEngine), /El motor no está instalado/);
        const noRequire = checked(change('functions.php', "require_once get_theme_file_path('/inc/acf/runner.php');", '')).r;
        assert.match(messages(noRequire), /no carga inc\/acf\/runner\.php/);
        const open = checked(change('specs/home.md', '- **ACF:** conectado\n', '')).r;
        assert.equal(open.code, 0, open.stdout);
        assert.ok(open.json.warnings.some((w) => /no conectada a ACF/.test(w.message)));
    });

    test('check: --states, --page y un spec con errores', () => {
        const { r } = checked(() => {}, ['--page', 'home']);
        assert.equal(r.json.pages, 1);
        const empty = checked(() => {}, ['--page', 'nosotros']);
        assert.equal(empty.r.code, 1);
        const bad = checked(change('specs/home.md', 'página de inicio (front page)', 'en algún lado')).r;
        assert.match(messages(bad), /Ubicación no reconocida/);
    });

    // ---------- install ----------
    const bare = () => theme((dir) => {
        rmSync(join(dir, 'inc'), { recursive: true });
        writeFileSync(join(dir, 'functions.php'), "<?php\ndefined('ABSPATH') || exit;\n\nrequire_once get_theme_file_path('/inc/setup.php');\n");
        writeFileSync(join(dir, 'CLAUDE.md'), '# Demo\n');
    });

    test('install --dry-run: no escribe', () => {
        const dir = bare();
        const r = run('install.mjs', ['--target', dir, '--slug', 'demo-theme', '--dry-run']);
        assert.equal(r.code, 0, r.stdout);
        assert.equal(r.json.values.PREFIX, 'demo_theme');
        assert.ok(r.json.create.includes('inc/acf/runner.php'));
        assert.ok(!existsSync(join(dir, 'inc')));
    });

    test('install: motor con el prefijo del tema, datos del proyecto, require y bloque en CLAUDE.md', () => {
        const dir = bare();
        const r = run('install.mjs', ['--target', dir, '--slug', 'demo-theme']);
        assert.equal(r.code, 0, r.stdout);
        const runner = readFileSync(join(dir, 'inc/acf/runner.php'), 'utf8');
        assert.match(runner, /function demo_theme_acf_run\(\): array/);
        assert.match(runner, /'demo-theme-carga'/);
        assert.ok(!/\{\{[A-Z_]+\}\}/.test(runner), 'sin placeholders');
        assert.match(runner, /Versión del motor: \d+\.\d+\.\d+/);
        assert.ok(existsSync(join(dir, 'inc/acf/sitio.php')));
        assert.ok(existsSync(join(dir, 'inc/acf/seed/.gitkeep')));
        assert.match(readFileSync(join(dir, 'functions.php'), 'utf8'), /require_once get_theme_file_path\('\/inc\/acf\/runner\.php'\);/);
        assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /<!-- wp-acf:start -->[\s\S]*ACF administrable[\s\S]*<!-- wp-acf:end -->/);
    });

    test('install: repetirlo no cambia nada y un motor distinto es un conflicto', () => {
        const dir = bare();
        run('install.mjs', ['--target', dir, '--slug', 'demo-theme']);
        const again = run('install.mjs', ['--target', dir, '--slug', 'demo-theme']);
        assert.equal(again.code, 0, again.stdout);
        assert.equal(again.json.written.length, 0);
        assert.equal(again.json.functionsPhp, 'unchanged');
        assert.equal(again.json.claudeMd, 'unchanged');
        writeFileSync(join(dir, 'inc/acf/runner.php'), '<?php // editado');
        const blocked = run('install.mjs', ['--target', dir, '--slug', 'demo-theme']);
        assert.equal(blocked.code, 2, blocked.stdout);
        assert.deepEqual(blocked.json.unresolved, ['inc/acf/runner.php']);
        const done = run('install.mjs', ['--target', dir, '--slug', 'demo-theme', '--overwrite', 'inc/acf/runner.php']);
        assert.equal(done.code, 0, done.stdout);
        assert.match(readFileSync(join(dir, 'inc/acf/runner.php'), 'utf8'), /demo_theme_acf_run/);
    });

    test('install: un tema sin style.css o functions.php se rechaza', () => {
        const dir = theme((d) => rmSync(join(d, 'style.css')));
        assert.equal(run('install.mjs', ['--target', dir, '--slug', 'demo']).code, 1);
    });

    test('status: sin motor pide instalarlo; instalado y al día no; lista lo que falta conectar', () => {
        const dir = bare();
        const before = run('status.mjs', ['--target', dir]);
        assert.equal(before.code, 0, before.stdout);
        assert.equal(before.json.engine.runner, false);
        assert.match(before.json.next[0], /Instalar el motor/);
        run('install.mjs', ['--target', dir, '--slug', 'demo-theme']);
        const after = run('status.mjs', ['--target', dir]);
        assert.equal(after.json.engine.upToDate, true);
        assert.ok(!after.json.next.some((n) => /motor/.test(n)), after.stdout);
        const full = run('status.mjs', ['--target', theme()]);
        assert.ok(full.json.pages.some((p) => p.slug === 'home' && p.connected === p.sections), full.stdout);
    });

    test('status: un motor de otra versión se avisa; un tema sin style.css falla', () => {
        const dir = bare();
        run('install.mjs', ['--target', dir, '--slug', 'demo-theme']);
        writeFileSync(join(dir, 'inc/acf/runner.php'), readFileSync(join(dir, 'inc/acf/runner.php'), 'utf8').replace(/Versión del motor: \S+/, 'Versión del motor: 0.9.0'));
        const r = run('status.mjs', ['--target', dir]);
        assert.equal(r.json.engine.upToDate, false);
        assert.match(r.json.next[0], /Actualizar el motor \(instalado 0\.9\.0/);
        assert.equal(run('status.mjs', ['--target', theme((d) => rmSync(join(d, 'style.css')))]).code, 1);
    });
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallos' : ''}.`);
