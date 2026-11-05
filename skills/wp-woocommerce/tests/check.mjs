#!/usr/bin/env node
// Prueba de wp-woocommerce: install, status y check contra un tema de ejemplo y una copia falsa de WooCommerce
// (solo las plantillas necesarias). Sin dependencias.
//
// Uso: node skills/wp-woocommerce/tests/check.mjs [--php <ruta a php>]
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = readFileSync(join(skillDir, 'SKILL.md'), 'utf8').match(/version:\s*"([^"]+)"/)[1];
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

const tmp = mkdtempSync(join(tmpdir(), 'wp-woocommerce-'));
let passed = 0;
const test = async (name, fn) => {
    try {
        await fn();
        passed++;
        console.log(`ok   ${name}`);
    } catch (e) {
        console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
        process.exitCode = 1;
    }
};

// Copia del tema de ejemplo en <tmp>/<n>/wp-content/themes/demo: así WooCommerce se busca en ../../plugins/woocommerce.
let counter = 0;
const theme = (edit = () => {}) => {
    const root = join(tmp, String(counter++));
    const dir = join(root, 'wp-content', 'themes', 'demo');
    mkdirSync(dirname(dir), { recursive: true });
    cpSync(fixture, dir, { recursive: true });
    edit(dir);
    return dir;
};
const change = (file, from, to) => (dir) => {
    const path = join(dir, file);
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); // Windows puede traer los fixtures con CRLF
    assert.ok(text.includes(from), `el fixture ya no contiene "${from}" en ${file}`);
    writeFileSync(path, text.replace(from, to));
};
const put = (file, content) => (dir) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
};
const all = (...edits) => (dir) => edits.forEach((edit) => edit(dir));
const messages = (r) => [...(r.json?.errors ?? [])].map((e) => e.message).join('\n');
const warnings = (r) => [...(r.json?.warnings ?? [])].map((e) => e.message).join('\n');

// Las plantillas originales de WooCommerce (falsas): la misma ruta, el @version y los do_action del tema de ejemplo.
const core = (dir, edit = () => {}) => {
    const templates = join(dir, '..', '..', 'plugins', 'woocommerce', 'templates');
    const file = (rel, versionNumber, body) => {
        mkdirSync(dirname(join(templates, rel)), { recursive: true });
        writeFileSync(join(templates, rel), `<?php\n/**\n * @version ${versionNumber}\n */\n${body}\n`);
    };
    file('archive-product.php', '8.6.0', "do_action('woocommerce_after_shop_loop');\ndo_action('woocommerce_no_products_found');");
    file('content-product.php', '9.4.0', '');
    file('single-product.php', '1.6.4', '');
    file('cart/cart.php', '10.0.0', "do_action('woocommerce_before_cart');\ndo_action('woocommerce_after_cart');");
    edit(templates);
};
const coreFile = (rel, versionNumber, body = '') => (templates) => {
    mkdirSync(dirname(join(templates, rel)), { recursive: true });
    writeFileSync(join(templates, rel), `<?php\n/**\n * @version ${versionNumber}\n */\n${body}\n`);
};

// Todos los marcadores `woo:` del tema de ejemplo, reemplazados por llamadas reales.
const connected = all(
    change('woocommerce/content-product.php', '<!-- woo: imagen -->', "<?php echo wp_kses_post($product->get_image('woocommerce_thumbnail')); ?>"),
    change('woocommerce/content-product.php', '<!-- woo: precio -->', '<?php echo wp_kses_post($product->get_price_html()); ?>'),
    change('woocommerce/content-product.php', '<?php // woo: boton ?>', '<?php woocommerce_template_loop_add_to_cart(); ?>'),
    change('woocommerce/single-product.php', '<?php // woo: precio ?>', '<?php echo wp_kses_post($product->get_price_html()); ?>'),
    change('woocommerce/single-product.php', '<?php // woo: boton ?>', '<?php woocommerce_template_single_add_to_cart(); ?>'),
    change('woocommerce/cart/cart.php', '<?php // woo: lineas del carrito ?>', '<!-- lineas -->'),
);
const installed = (edit = () => {}) => {
    const dir = theme(edit);
    const r = run('install.mjs', ['--target', dir]);
    assert.equal(r.code, 0, r.stdout);
    return dir;
};
const checkoutClassic = change('specs/_shared.md', '| checkout | bloques |', '| checkout | clásico |');
const formCheckout = put('woocommerce/checkout/form-checkout.php', '<?php\n/**\n * @version 9.8.0\n */\n');

await test('install: --dry-run no escribe nada y dice qué copiaría según el spec', () => {
    const dir = theme();
    const r = run('install.mjs', ['--target', dir, '--dry-run']);
    assert.equal(r.code, 0, r.stdout);
    assert.deepEqual([...r.json.create].sort(), ['inc/woocommerce/base.php', 'inc/woocommerce/fragments.php', 'page.php', 'src/css/woocommerce.css']);
    assert.deepEqual(r.json.wire, ['functions.php', 'src/css/input.css']);
    assert.equal(existsSync(join(dir, 'inc')), false);
});

await test('install: copia la base, conecta functions.php y el CSS, y deja el bloque en CLAUDE.md', () => {
    const dir = installed();
    const base = readFileSync(join(dir, 'inc/woocommerce/base.php'), 'utf8');
    assert.match(base, new RegExp(`Versión del motor: ${version.replaceAll('.', '\\.')}`));
    assert.match(base, /function demo_woo_setup\(\)/);
    assert.match(readFileSync(join(dir, 'functions.php'), 'utf8'), /inc\/woocommerce\/base\.php/);
    const css = readFileSync(join(dir, 'src/css/input.css'), 'utf8').replace(/\r\n/g, '\n');
    assert.match(css, /@import "tailwindcss";\n@import "\.\/woocommerce\.css";/);
    assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /<!-- wp-woocommerce:start -->[\s\S]*<!-- wp-woocommerce:end -->/);
    assert.match(readFileSync(join(dir, 'inc/woocommerce/fragments.php'), 'utf8'), /function demo_woo_cart_count_html\(\)/);
    assert.doesNotMatch(readFileSync(join(dir, 'src/css/woocommerce.css'), 'utf8'), /\{\{/);
});

await test('install: repetirlo no cambia nada y --check lo confirma', () => {
    const dir = installed();
    const again = run('install.mjs', ['--target', dir]);
    assert.equal(again.code, 0, again.stdout);
    assert.deepEqual(again.json.written, []);
    assert.deepEqual(again.json.wired, []);
    const check = run('install.mjs', ['--target', dir, '--check']);
    assert.equal(check.code, 0, check.stdout);
    assert.equal(check.json.version.installed, version);
});

await test('install: sin mini-carrito clásico no copia fragmentos; sin piezas en bloques no copia el CSS', () => {
    const dir = theme(all(checkoutClassic, change('specs/_shared.md', '| mini-carrito | clásico |', '| mini-carrito | no aplica |')));
    const r = run('install.mjs', ['--target', dir]);
    assert.equal(r.code, 0, r.stdout);
    assert.deepEqual([...r.json.written].sort(), ['inc/woocommerce/base.php', 'page.php']);
    assert.equal(r.json.cssEntry, null);
    assert.doesNotMatch(readFileSync(join(dir, 'src/css/input.css'), 'utf8'), /woocommerce\.css/);
});

await test('install: page.php solo si el tema no tiene plantilla de página; check lo exige para carrito, checkout y cuenta', () => {
    const dir = installed();
    assert.match(readFileSync(join(dir, 'page.php'), 'utf8'), /the_content\(\)/);
    const own = theme(put('page.php', '<?php // mía\n'));
    const r = run('install.mjs', ['--target', own]);
    assert.equal(r.code, 0, r.stdout);
    assert.ok(!r.json.written.includes('page.php'));
    assert.equal(readFileSync(join(own, 'page.php'), 'utf8'), '<?php // mía\n');
    const singular = theme(put('singular.php', '<?php // singular\n'));
    assert.ok(!run('install.mjs', ['--target', singular, '--dry-run']).json.create.includes('page.php'));
    const missing = installed(connected);
    rmSync(join(missing, 'page.php'));
    core(missing);
    assert.match(messages(run('check.mjs', ['--target', missing])), /no tiene page\.php ni singular\.php/);
    const none = installed(all(change('specs/_shared.md', '| carrito | clásico |', '| carrito | no aplica |'), change('specs/_shared.md', '| checkout | bloques |', '| checkout | no aplica |')));
    assert.ok(!existsSync(join(none, 'page.php')));
});

await test('install: no instala si el spec no decidió (sin contenido woo, sin tabla, pieza sin modo, sin specs)', () => {
    const noWoo = run('install.mjs', ['--target', theme(change('specs/_shared.md', '| producto | woo |', '| producto | cpt |'))]);
    assert.equal(noWoo.code, 1);
    assert.match(noWoo.json.error, /no tiene contenido con Origen woo/);
    const noTable = run('install.mjs', ['--target', theme(change('specs/_shared.md', '## WooCommerce', '## Otra cosa'))]);
    assert.equal(noTable.code, 1);
    assert.match(noTable.json.error, /Falta la sección "WooCommerce"/);
    const noMode = run('install.mjs', ['--target', theme(change('specs/_shared.md', '| cuenta | no aplica |', '| cuenta | tal vez |'))]);
    assert.equal(noMode.code, 1);
    assert.match(noMode.json.error, /falta el modo de: cuenta/);
    const noSpecs = run('install.mjs', ['--target', theme((dir) => rmSync(join(dir, 'specs'), { recursive: true }))]);
    assert.equal(noSpecs.code, 1);
    assert.match(noSpecs.json.error, /Faltan specs\/_index\.md/);
});

await test('install: un archivo distinto es conflicto (2) y --overwrite lo actualiza', () => {
    const dir = installed();
    writeFileSync(join(dir, 'inc/woocommerce/base.php'), '<?php // editado a mano\n');
    const blocked = run('install.mjs', ['--target', dir]);
    assert.equal(blocked.code, 2);
    assert.deepEqual(blocked.json.unresolved, ['inc/woocommerce/base.php']);
    const fixed = run('install.mjs', ['--target', dir, '--overwrite', 'inc/woocommerce/base.php']);
    assert.equal(fixed.code, 0, fixed.stdout);
    assert.match(readFileSync(join(dir, 'inc/woocommerce/base.php'), 'utf8'), /Versión del motor/);
});

await test('install: --css-entry debe ser un archivo del tema', () => {
    const forced = run('install.mjs', ['--target', theme(), '--css-entry', 'src/css/nope.css']);
    assert.equal(forced.code, 1);
    assert.match(forced.json.error, /no es un archivo dentro del tema/);
    const ok = run('install.mjs', ['--target', theme(), '--css-entry', 'src/css/input.css', '--dry-run']);
    assert.equal(ok.code, 0, ok.stdout);
});

await test('status: sin base dice instalar; con base y marcadores dice conectar; no inventa lo que el spec no decidió', () => {
    const before = run('status.mjs', ['--target', theme()]);
    assert.equal(before.code, 0);
    assert.ok(before.json.next.some((n) => /Instalar la base/.test(n)));
    const after = run('status.mjs', ['--target', installed()]);
    assert.ok(after.json.next.some((n) => /Conectar las plantillas.*content-product\.php \(3\)/.test(n)), after.json.next.join('\n'));
    assert.ok(after.json.next.some((n) => /Escribir el CSS de los bloques/.test(n)));
    assert.ok(after.json.next.some((n) => /Sin la carpeta templates\/ de WooCommerce/.test(n)));
    const cart = after.json.overrides.find((o) => o.rel === 'woocommerce/cart/cart.php');
    assert.equal(cart.piece, 'carrito');
    assert.equal(cart.markers.length, 1);
    const noWoo = run('status.mjs', ['--target', theme(change('specs/_shared.md', '| producto | woo |', '| producto | cpt |'))]);
    assert.ok(noWoo.json.next.some((n) => /no hace falta/.test(n)));
});

await test('status: filtros de tienda y variaciones en "sí" quedan pendientes', () => {
    const dir = installed(all(
        change('specs/_shared.md', '- **Variaciones:** no', '- **Variaciones:** sí'),
        change('specs/_shared.md', '- **Filtros de tienda:** no', '- **Filtros de tienda:** sí'),
    ));
    const r = run('status.mjs', ['--target', dir]);
    assert.ok(r.json.next.some((n) => /Filtros de tienda: sí, y wp-query no está instalada/.test(n)));
    assert.ok(r.json.next.some((n) => /Variaciones: pendientes/.test(n)));
    // Con wp-query instalada los filtros de tienda ya no quedan pendientes.
    const withQuery = installed(all(
        change('specs/_shared.md', '- **Filtros de tienda:** no', '- **Filtros de tienda:** sí'),
        put('inc/query/motor.php', '<?php\n'),
    ));
    assert.ok(!run('status.mjs', ['--target', withQuery]).json.next.some((n) => /Filtros de tienda/.test(n)));
});

await test('check: un tema recién instalado falla por los marcadores sin conectar y avisa que no compara con WooCommerce', () => {
    const r = run('check.mjs', ['--target', installed()]);
    assert.equal(r.code, 4);
    assert.match(messages(r), /Marcadores `woo:` sin conectar \(3\): imagen, precio, boton/);
    assert.match(messages(r), /Marcadores `woo:` sin conectar \(2\): precio, boton/);
    assert.match(warnings(r), /No encontré la carpeta templates\/ de WooCommerce/);
});

await test('check: conectado y al día con WooCommerce sale 0', () => {
    const dir = installed(connected);
    core(dir);
    const r = run('check.mjs', ['--target', dir]);
    assert.equal(r.code, 0, messages(r));
    assert.equal(r.json.core, true);
    assert.ok(r.json.overrides.every((o) => o.state === 'al día'), JSON.stringify(r.json.overrides));
    assert.match(warnings(r), /todavía no tiene reglas/);
});

await test('check: @version desactualizada, más nueva, ausente o sin original', () => {
    const outdated = installed(connected);
    core(outdated, coreFile('cart/cart.php', '10.4.0', "do_action('woocommerce_before_cart');\ndo_action('woocommerce_after_cart');"));
    const r = run('check.mjs', ['--target', outdated]);
    assert.equal(r.code, 4);
    assert.match(messages(r), /@version 10\.0\.0, la original trae 10\.4\.0/);

    const newer = installed(connected);
    core(newer, coreFile('content-product.php', '9.0.0'));
    assert.match(warnings(run('check.mjs', ['--target', newer])), /9\.4\.0 es mayor que el de la original \(9\.0\.0\)/);

    const missing = installed(all(connected, change('woocommerce/single-product.php', ' * @version 1.6.4\n', '')));
    core(missing);
    assert.match(messages(run('check.mjs', ['--target', missing])), /Falta el @version/);

    const own = installed(all(connected, put('woocommerce/propio.php', '<?php\n/**\n * @version 1.0.0\n */\n')));
    core(own);
    assert.match(warnings(run('check.mjs', ['--target', own])), /WooCommerce no tiene una plantilla con esta ruta/);
});

await test('check: un do_action de la original que falta en la plantilla del tema es error', () => {
    const dir = installed(all(connected, change('woocommerce/cart/cart.php', "do_action('woocommerce_after_cart');", '')));
    core(dir);
    const r = run('check.mjs', ['--target', dir]);
    assert.equal(r.code, 4);
    assert.match(messages(r), /Falta do_action\('woocommerce_after_cart'\)/);
});

await test('check: una pieza en bloques con su plantilla clásica es error (WooCommerce la ignora)', () => {
    const dir = installed(all(connected, formCheckout));
    core(dir);
    const r = run('check.mjs', ['--target', dir]);
    assert.equal(r.code, 4);
    assert.match(messages(r), /La pieza "checkout" va en bloques y WooCommerce ignora esta plantilla/);
    const classic = installed(all(checkoutClassic, connected, formCheckout));
    core(classic, coreFile('checkout/form-checkout.php', '9.8.0'));
    const ok = run('check.mjs', ['--target', classic]);
    assert.equal(ok.code, 0, messages(ok));
});

await test('check: lógica de negocio en el tema es error; ganchos del checkout clásico con bloques, aviso', () => {
    const dir = installed(all(connected, put('inc/pago.php', "<?php\nclass Demo_Gateway extends WC_Payment_Gateway {}\nadd_action('woocommerce_payment_complete', 'x');\n")));
    core(dir);
    const r = run('check.mjs', ['--target', dir]);
    assert.equal(r.code, 4);
    assert.match(messages(r), /una pasarela de pago/);
    assert.match(messages(r), /un gancho de pedidos/);
    const fields = installed(all(connected, put('inc/campos.php', "<?php\nadd_filter('woocommerce_checkout_fields', 'x');\n")));
    core(fields);
    const w = run('check.mjs', ['--target', fields]);
    assert.equal(w.code, 0, messages(w));
    assert.match(warnings(w), /Gancho del checkout clásico con el checkout en bloques/);
});

await test('check: el CSS de los bloques con @layer es error; sin importarlo en el CSS principal también', () => {
    const layered = installed(connected);
    core(layered);
    writeFileSync(join(layered, 'src/css/woocommerce.css'), '@layer components { .wc-block-checkout { color: red; } }\n');
    assert.match(messages(run('check.mjs', ['--target', layered])), /no va dentro de @layer/);
    const notImported = installed(connected);
    core(notImported);
    writeFileSync(join(notImported, 'src/css/input.css'), '@import "tailwindcss";\n');
    assert.match(messages(run('check.mjs', ['--target', notImported])), /no importa woocommerce\.css/);
});

await test('check: sin la base, o con mini-carrito clásico sin fragmentos, es error', () => {
    const noBase = run('check.mjs', ['--target', theme(connected)]);
    assert.equal(noBase.code, 4);
    assert.match(messages(noBase), /Falta la base: corre install\.mjs/);
    const dir = installed(connected);
    core(dir);
    rmSync(join(dir, 'inc/woocommerce/fragments.php'));
    assert.match(messages(run('check.mjs', ['--target', dir])), /faltan los fragmentos/);
});

await test('check: filtros de tienda y variaciones pendientes son avisos, no errores', () => {
    const dir = installed(all(
        connected,
        change('specs/_shared.md', '- **Variaciones:** no', '- **Variaciones:** sí'),
        change('specs/_shared.md', '- **Filtros de tienda:** no', '- **Filtros de tienda:** sí'),
    ));
    core(dir);
    const r = run('check.mjs', ['--target', dir]);
    assert.equal(r.code, 0, messages(r));
    assert.match(warnings(r), /Filtros de tienda: sí, pero wp-query no está instalada/);
    assert.match(warnings(r), /Variaciones: esta versión solo cubre productos simples/);
    const withQuery = installed(all(connected, change('specs/_shared.md', '- **Filtros de tienda:** no', '- **Filtros de tienda:** sí'), put('inc/query/motor.php', '<?php\n')));
    core(withQuery);
    assert.doesNotMatch(warnings(run('check.mjs', ['--target', withQuery])), /Filtros de tienda/);
});

await test('check: --woo con una ruta sin templates/ falla con código 1', () => {
    const r = run('check.mjs', ['--target', installed(connected), '--woo', join(tmp, 'no-existe')]);
    assert.equal(r.code, 1);
    assert.match(r.json.error, /no tiene una carpeta templates\//);
});

function findPhp() {
    const arg = process.argv.indexOf('--php');
    const candidates = arg > -1 ? [process.argv[arg + 1]] : ['php', 'C:/php/php.exe', '/c/php/php', '/usr/bin/php'];
    return candidates.find((bin) => bin && spawnSync(bin, ['-v'], { encoding: 'utf8' }).status === 0) ?? null;
}

await test('php -l de la base y los fragmentos instalados (si hay php)', () => {
    const php = findPhp();
    if (!php) {
        console.log('     (no hay php: se omite)');
        return;
    }
    const dir = installed();
    for (const rel of ['inc/woocommerce/base.php', 'inc/woocommerce/fragments.php']) {
        const r = spawnSync(php, ['-l', join(dir, rel)], { encoding: 'utf8' });
        assert.equal(r.status, 0, `${rel}: ${r.stdout}${r.stderr}`);
    }
});

await test('base.php: quita lo que WooCommerce imprime por defecto y deja los avisos y "sin productos" (si hay php)', () => {
    const php = findPhp();
    if (!php) {
        console.log('     (no hay php: se omite)');
        return;
    }
    const dir = installed();
    const r = spawnSync(php, [join(skillDir, 'tests', 'base.php'), join(dir, 'inc/woocommerce/base.php'), 'demo'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.left, [
        'woocommerce_before_shop_loop > woocommerce_output_all_notices',
        'woocommerce_before_single_product > woocommerce_output_all_notices',
        'woocommerce_no_products_found > wc_no_products_found',
    ]);
    assert.ok(out.supports.includes('woocommerce'));
    assert.ok(out.supports.includes('wc-product-gallery-slider'));
    assert.equal(out.styles, true);
});

console.log(`\n${passed} pruebas pasaron.`);
