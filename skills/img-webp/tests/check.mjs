#!/usr/bin/env node
// Prueba de img-webp. Sin dependencias: las imágenes se arman con bytes crudos y el codificador es un `sharp` falso.
// Si hay un `sharp` real (variable IMG_WEBP_SHARP_FROM o instalado en la skill), una prueba extra convierte de verdad.
//
// Uso: node skills/img-webp/tests/check.mjs
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alcancePorDefecto, carpetaRespaldo, convertir, escanear, planificar } from '../scripts/webp/ejecutar.mjs';
import { formatoReal, leerImagen, medidasVisibles } from '../scripts/webp/imagen.mjs';
import { gestorDePaquetes, resolverSharp } from '../scripts/webp/codificador.mjs';
import { nombreWebp, planificarTamano } from '../scripts/webp/plan.mjs';
import { procesarTexto, revertirReferencias, trabajarReferencias } from '../scripts/webp/referencias.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(skillDir, 'scripts', 'webp.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'img-webp-'));
let passed = 0;
let omitidas = 0;
// Las pruebas asíncronas se esperan al final (antes de borrar la carpeta temporal).
const pendientes = [];
const test = (name, fn) => {
    const hecho = (ok, e) => {
        if (ok) { passed++; console.log(`ok   ${name}`); return; }
        console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
        process.exitCode = 1;
    };
    try {
        const r = fn();
        if (r instanceof Promise) { pendientes.push(r.then(() => hecho(true), (e) => hecho(false, e))); return; }
        hecho(true);
    } catch (e) {
        hecho(false, e);
    }
};

// ---------- imágenes mínimas con cabeceras reales ----------
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const relleno = (peso, base) => Buffer.concat([base, Buffer.alloc(Math.max(0, peso - base.length), 0x41)]);

function png(ancho, alto, { alfa = false, trns = false, peso = 4000 } = {}) {
    const ihdr = Buffer.concat([u32(ancho), u32(alto), Buffer.from([8, alfa ? 6 : 2, 0, 0, 0])]);
    const bloque = (tipo, datos) => Buffer.concat([u32(datos.length), Buffer.from(tipo), datos, Buffer.alloc(4)]);
    const base = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), bloque('IHDR', ihdr), trns ? bloque('tRNS', Buffer.from([0, 0])) : Buffer.alloc(0), bloque('IDAT', Buffer.alloc(10))]);
    return relleno(peso, base);
}

function jpg(ancho, alto, { orientacion = 0, peso = 4000 } = {}) {
    const exif = orientacion
        ? (() => {
            const tiff = Buffer.concat([Buffer.from('II*\0'), Buffer.from([8, 0, 0, 0]), Buffer.from([1, 0]), Buffer.from([0x12, 0x01, 3, 0, 1, 0, 0, 0, orientacion, 0, 0, 0]), Buffer.alloc(4)]);
            const datos = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
            return Buffer.concat([Buffer.from([0xff, 0xe1]), u16(datos.length + 2), datos]);
        })()
        : Buffer.alloc(0);
    const sof = Buffer.concat([Buffer.from([0xff, 0xc0]), u16(17), Buffer.from([8]), u16(alto), u16(ancho), Buffer.from([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])]);
    return relleno(peso, Buffer.concat([Buffer.from([0xff, 0xd8]), exif, sof]));
}

const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([10, 0, 10, 0]), Buffer.alloc(40)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(30)]);
const AVIF = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif'), Buffer.alloc(30)]);

const nuevoProyecto = (nombre, archivos) => {
    const raiz = join(tmp, nombre);
    for (const [rel, contenido] of Object.entries(archivos)) {
        mkdirSync(dirname(join(raiz, rel)), { recursive: true });
        writeFileSync(join(raiz, rel), contenido);
    }
    return raiz;
};

// Un codificador falso: devuelve un "WebP" del 20 % del peso (o el que se pida).
const webpFalso = (largo) => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(Math.max(8, largo))]);
const falso = (factor = 0.2) => async (bytes) => ({ bytes: webpFalso(Math.floor(bytes.length * factor)) });

// Un "sharp" falso para probar la CLI de punta a punta sin instalar nada.
const sharpFalso = (carpeta) => {
    mkdirSync(join(carpeta, 'node_modules', 'sharp'), { recursive: true });
    writeFileSync(join(carpeta, 'node_modules', 'sharp', 'package.json'), '{"name":"sharp","version":"0.0.0","main":"index.js"}');
    writeFileSync(join(carpeta, 'node_modules', 'sharp', 'index.js'), `
module.exports = function sharp(buf) {
  const estado = {};
  const api = {
    rotate() { return api; },
    resize(o) { estado.resize = o; return api; },
    webp(o) { estado.webp = o; return api; },
    async toBuffer() {
      const data = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(Math.max(16, Math.floor(buf.length * 0.2)))]);
      return { data, info: { width: estado.resize && estado.resize.width, height: undefined } };
    },
  };
  return api;
};
module.exports.versions = { sharp: '0.0.0-falso' };
`);
};

const correr = (args, { cwd } = {}) => {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* la salida no era JSON: el assert que la use lo mostrará */ }
    return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
};

try {
    // ---------- formato real y medidas ----------
    test('formatoReal: reconoce por los bytes, no por la extensión', () => {
        assert.equal(formatoReal(png(10, 10)), 'png');
        assert.equal(formatoReal(jpg(10, 10)), 'jpg');
        assert.equal(formatoReal(GIF), 'gif');
        assert.equal(formatoReal(WEBP), 'webp');
        assert.equal(formatoReal(AVIF), 'avif');
        assert.equal(formatoReal(SVG), 'svg');
        assert.equal(formatoReal(Buffer.from('esto no es una imagen')), null);
    });

    test('leerImagen: medidas de PNG y JPEG, transparencia y orientación Exif', () => {
        const raiz = nuevoProyecto('leer', {
            'a.png': png(353, 255, { alfa: true }), 'b.png': png(100, 80), 'c.png': png(100, 80, { trns: true }),
            'd.jpg': jpg(4096, 2731), 'e.jpg': jpg(2731, 4096, { orientacion: 6 }),
        });
        const a = leerImagen(join(raiz, 'a.png'));
        assert.deepEqual([a.formato, a.ancho, a.alto, a.alfa], ['png', 353, 255, true]);
        assert.equal(leerImagen(join(raiz, 'b.png')).alfa, false, 'un PNG sin alfa ni tRNS no tiene transparencia');
        assert.equal(leerImagen(join(raiz, 'c.png')).alfa, true, 'tRNS también es transparencia');
        const d = leerImagen(join(raiz, 'd.jpg'));
        assert.deepEqual([d.formato, d.ancho, d.alto, d.orientacion], ['jpg', 4096, 2731, 1]);
        const e = leerImagen(join(raiz, 'e.jpg'));
        assert.equal(e.orientacion, 6);
        assert.deepEqual(medidasVisibles(e), { ancho: 4096, alto: 2731 }, 'con orientación 6 la foto se ve girada: ancho y alto se intercambian');
    });

    // ---------- reglas de tamaño ----------
    test('planificarTamano: solo se reduce lo que pasa de 2000 px y nunca se amplía', () => {
        assert.deepEqual(planificarTamano({ ancho: 4096, alto: 2731 }), { reducir: true, ancho: 2000, alto: 1333 });
        assert.deepEqual(planificarTamano({ ancho: 2731, alto: 4096 }), { reducir: true, ancho: 2000, alto: 3000 });
        assert.equal(planificarTamano({ ancho: 2000, alto: 1000 }).reducir, false, '2000 exactos se quedan');
        assert.equal(planificarTamano({ ancho: 1600, alto: 1066 }).reducir, false);
        assert.deepEqual(planificarTamano({ ancho: 353, alto: 255 }), { reducir: false, ancho: 353, alto: 255 }, 'una imagen chica se queda como viene');
        assert.deepEqual(planificarTamano({ ancho: 720, alto: 1520 }), { reducir: false, ancho: 720, alto: 1520 });
        assert.equal(planificarTamano({}).reducir, false, 'sin medidas no se toca el tamaño');
        assert.deepEqual(planificarTamano({ ancho: 3000, alto: 2000 }, 1000), { reducir: true, ancho: 1000, alto: 667 }, 'con otro máximo (--max-width)');
        const r = planificarTamano({ ancho: 4096, alto: 2731 });
        assert.ok(Math.abs(r.ancho / r.alto - 4096 / 2731) < 0.002, 'mantiene la proporción');
    });

    test('nombreWebp: mismo nombre y carpeta con extensión .webp', () => {
        assert.equal(nombreWebp('assets/img/hero.jpg'), 'assets/img/hero.webp');
        assert.equal(nombreWebp('a/B.JPEG'), 'a/B.webp');
        assert.equal(nombreWebp('x.PNG'), 'x.webp');
    });

    // ---------- escanear y planificar ----------
    const proyectoMixto = () => nuevoProyecto('mixto', {
        'style.css': '/*\nTheme Name: Demo\n*/\n', 'functions.php': '<?php\n',
        'assets/img/hero.jpg': jpg(4096, 2731, { peso: 9000 }), 'assets/img/logo.png': png(353, 255, { alfa: true }),
        'assets/img/disfrazada.png': jpg(800, 600), 'assets/img/Foto.JPEG': jpg(1200, 800), 'assets/img/sub/otra.jpg': jpg(500, 500),
        'assets/img/icono.svg': SVG, 'assets/img/anim.gif': GIF, 'assets/img/ya.webp': WEBP, 'assets/img/nueva.avif': AVIF,
        'assets/img/notas.txt': 'no es imagen', 'assets/img/rota.jpg': Buffer.from('basura'),
        'src/img-originales/assets/img/viejo.jpg': jpg(100, 100),
    });

    test('escanear: clasifica por formato real e ignora svg, gif, webp, avif y el respaldo', () => {
        const raiz = proyectoMixto();
        const respaldoAbs = carpetaRespaldo(raiz);
        assert.equal(respaldoAbs, join(raiz, 'src', 'img-originales'), 'con src/ el respaldo va en src/img-originales');
        assert.deepEqual(alcancePorDefecto(raiz), ['assets/img']);
        const r = escanear(raiz, ['assets/img'], { respaldoAbs });
        assert.deepEqual(r.convertibles.map((i) => i.ruta), ['assets/img/Foto.JPEG', 'assets/img/disfrazada.png', 'assets/img/hero.jpg', 'assets/img/logo.png', 'assets/img/sub/otra.jpg']);
        assert.deepEqual(r.ignoradas.map((i) => i.formato).sort(), ['avif', 'gif', 'svg', 'webp']);
        assert.deepEqual(r.desconocidas.map((i) => i.ruta), ['assets/img/rota.jpg']);
        assert.ok(r.avisos.some((a) => /disfrazada\.png dice ser PNG pero es un JPG/.test(a)), r.avisos.join('\n'));
        assert.ok(!r.convertibles.some((i) => i.ruta.includes('img-originales')), 'no mira dentro del respaldo');
    });

    test('escanear: una imagen suelta y rutas fuera del proyecto', () => {
        const raiz = proyectoMixto();
        const una = escanear(raiz, ['assets/img/hero.jpg'], { respaldoAbs: carpetaRespaldo(raiz) });
        assert.equal(una.convertibles.length, 1);
        assert.throws(() => escanear(raiz, ['../fuera'], { respaldoAbs: carpetaRespaldo(raiz) }), /fuera del proyecto/);
        assert.throws(() => escanear(raiz, ['assets/img/notas.txt'], { respaldoAbs: carpetaRespaldo(raiz) }), /no es una imagen/);
        assert.equal(carpetaRespaldo(nuevoProyecto('sinsrc', { 'a.png': png(1, 1) })).endsWith('img-originales'), true);
    });

    test('planificar: reduce lo grande, omite lo que ya existe y los nombres repetidos', () => {
        const raiz = nuevoProyecto('plan', {
            'img/a.jpg': jpg(4096, 2731), 'img/b.png': png(300, 200), 'img/c.jpg': jpg(500, 500), 'img/c.png': png(500, 500), 'img/d.jpg': jpg(500, 500), 'img/d.webp': WEBP,
        });
        const encontrado = escanear(raiz, ['img'], { respaldoAbs: carpetaRespaldo(raiz) });
        const plan = Object.fromEntries(planificar(raiz, encontrado.convertibles).map((p) => [p.original, p]));
        assert.deepEqual([plan['img/a.jpg'].accion, plan['img/a.jpg'].reducir, plan['img/a.jpg'].anchoSalida, plan['img/a.jpg'].altoSalida], ['convertir', true, 2000, 1333]);
        assert.deepEqual([plan['img/b.png'].accion, plan['img/b.png'].reducir], ['convertir', false]);
        assert.equal(plan['img/c.jpg'].accion, 'convertir');
        assert.equal(plan['img/c.png'].accion, 'omitir');
        assert.match(plan['img/c.png'].motivo, /ya produce img\/c\.webp/);
        assert.match(plan['img/d.jpg'].motivo, /ya existe img\/d\.webp/);
        const forzado = planificar(raiz, encontrado.convertibles, { force: true }).find((p) => p.original === 'img/d.jpg');
        assert.equal(forzado.accion, 'convertir', 'con --force se rehace');
    });

    // ---------- convertir (con el codificador falso) ----------
    test('convertir: escribe el .webp, mueve el original al respaldo y no toca nada en modo simulación', async () => {
        const raiz = nuevoProyecto('conv', { 'src/x': '', 'img/a.jpg': jpg(4096, 2731, { peso: 10000 }), 'img/b.png': png(300, 200, { alfa: true, peso: 3000 }) });
        const respaldoAbs = carpetaRespaldo(raiz);
        const plan = planificar(raiz, escanear(raiz, ['img'], { respaldoAbs }).convertibles);
        const simulado = await convertir(raiz, plan, { codificar: falso(), respaldoAbs, escribir: false });
        assert.equal(simulado.convertidas.length, 2);
        assert.ok(existsSync(join(raiz, 'img/a.jpg')) && !existsSync(join(raiz, 'img/a.webp')), 'la simulación no escribe');

        const real = await convertir(raiz, plan, { codificar: falso(), respaldoAbs, escribir: true });
        assert.ok(formatoReal(readFileSync(join(raiz, 'img/a.webp'))) === 'webp');
        assert.ok(!existsSync(join(raiz, 'img/a.jpg')), 'el original se movió');
        assert.ok(existsSync(join(respaldoAbs, 'img', 'a.jpg')), 'y está en el respaldo con su estructura');
        const a = real.convertidas.find((c) => c.original === 'img/a.jpg');
        assert.deepEqual([a.reducida, a.anchoDespues, a.altoDespues, a.respaldo], [true, 2000, 1333, 'src/img-originales/img/a.jpg']);
        assert.ok(a.pesoDespues < a.pesoAntes);
        assert.equal(real.convertidas.find((c) => c.original === 'img/b.png').alfa, true);
    });

    test('convertir: si el WebP no queda más liviano se deja el original', async () => {
        const raiz = nuevoProyecto('pesado', { 'img/a.png': png(10, 10, { peso: 1000 }) });
        const respaldoAbs = carpetaRespaldo(raiz);
        const plan = planificar(raiz, escanear(raiz, ['img'], { respaldoAbs }).convertibles);
        const r = await convertir(raiz, plan, { codificar: falso(5), respaldoAbs, escribir: true });
        assert.equal(r.convertidas.length, 0);
        assert.match(r.omitidas[0].motivo, /no queda más liviano/);
        assert.ok(existsSync(join(raiz, 'img/a.png')) && !existsSync(join(raiz, 'img/a.webp')));
    });

    // ---------- referencias ----------
    const convertidos = [{ original: 'assets/img/hero.jpg', webp: 'assets/img/hero.webp' }, { original: 'assets/img/logo.png', webp: 'assets/img/logo.webp' }];

    test('referencias: reemplaza nombres sueltos y rutas, respeta los límites del nombre y las líneas CRLF', () => {
        const texto = [
            "<?php $img = fn($a) => get_theme_file_uri('assets/img/' . $a); ?>",
            "<img src=\"<?= $img('hero.jpg') ?>\"> <img src=\"<?= $img('my-hero.jpg') ?>\">",
            '.a { background: url("../assets/img/logo.png"); } /* otro-logo.png.bak y logo.pngx no */',
            'x logo.pngx',
            '<img src="https://sitio.com/wp-content/themes/x/assets/img/hero.jpg">',
        ].join('\r\n');
        const r = procesarTexto(texto, 'p.php', convertidos);
        assert.deepEqual(r.cambios.map((c) => [c.linea, c.de, c.a]), [[2, 'hero.jpg', 'hero.webp'], [3, 'logo.png', 'logo.webp'], [5, 'hero.jpg', 'hero.webp']], 'también una URL completa y una ruta con ../');
        assert.match(r.texto, /\$img\('hero\.webp'\)/);
        assert.match(r.texto, /my-hero\.jpg/, 'my-hero.jpg es otro archivo');
        assert.match(r.texto, /logo\.pngx/);
        assert.ok(r.texto.includes('\r\n') && !/[^\r]\n/.test(r.texto), 'conserva CRLF');
    });

    test('referencias: dos archivos con el mismo nombre solo se reemplazan si la ruta los distingue', () => {
        const dos = [{ original: 'img/a/foto.jpg', webp: 'img/a/foto.webp' }, { original: 'img/b/foto.jpg', webp: 'img/b/foto.webp' }];
        const r = procesarTexto("'img/a/foto.jpg' y 'foto.jpg' y 'otra/foto.jpg'", 'x.php', dos);
        assert.equal(r.cambios.length, 1);
        assert.equal(r.cambios[0].a, 'foto.webp');
        assert.deepEqual(r.ambiguas.map((a) => a.motivo.split(' ')[0]), ['hay', 'la']);
        const unico = procesarTexto("'otra/dir/hero.jpg'", 'x.php', convertidos);
        assert.equal(unico.cambios.length, 0, 'una ruta distinta no es la imagen convertida');
        assert.match(unico.ambiguas[0].motivo, /no coincide/);
    });

    test('referencias: ignora node_modules, dist, el respaldo y specs/figma/lectura; revertir devuelve el texto', () => {
        const linea = "<img src=\"assets/img/hero.jpg\">\n";
        const raiz = nuevoProyecto('refs', {
            'front.php': linea, 'node_modules/p/a.js': linea, 'dist/a.js': linea, 'src/img-originales/notas.md': linea,
            'specs/figma/lectura/home.json': '{"archivo":"home/assets/hero.jpg","tipo":"jpg"}\n', 'specs/_shared.md': 'usa assets/img/logo.png\n', 'estilo.css': 'a{background:url(assets/img/hero.jpg)}\n',
        });
        const vista = trabajarReferencias(raiz, convertidos, { ignorar: ['src/img-originales', 'specs/figma/lectura'], escribir: false });
        assert.deepEqual(vista.cambios.map((c) => c.archivo).sort(), ['estilo.css', 'front.php', 'specs/_shared.md']);
        assert.equal(readFileSync(join(raiz, 'front.php'), 'utf8'), linea, 'la vista previa no escribe');
        const hecho = trabajarReferencias(raiz, convertidos, { ignorar: ['src/img-originales', 'specs/figma/lectura'], escribir: true });
        assert.equal(readFileSync(join(raiz, 'front.php'), 'utf8'), "<img src=\"assets/img/hero.webp\">\n");
        assert.equal(readFileSync(join(raiz, 'node_modules/p/a.js'), 'utf8'), linea);
        assert.equal(readFileSync(join(raiz, 'specs/figma/lectura/home.json'), 'utf8'), '{"archivo":"home/assets/hero.jpg","tipo":"jpg"}\n', 'lo de Figma no se toca');
        const volver = revertirReferencias(raiz, hecho.cambios.map(({ texto, ...resto }) => resto));
        assert.equal(volver.revertidos, 3);
        assert.equal(readFileSync(join(raiz, 'front.php'), 'utf8'), linea);
        assert.equal(readFileSync(join(raiz, 'specs/_shared.md'), 'utf8'), 'usa assets/img/logo.png\n');
    });

    // ---------- gestor de paquetes y codificador ----------
    test('gestorDePaquetes: lockfile o packageManager; sin pistas, pnpm', () => {
        assert.equal(gestorDePaquetes(nuevoProyecto('g1', { 'pnpm-lock.yaml': '' })), 'pnpm');
        assert.equal(gestorDePaquetes(nuevoProyecto('g2', { 'yarn.lock': '' })), 'yarn');
        assert.equal(gestorDePaquetes(nuevoProyecto('g3', { 'package-lock.json': '{}' })), 'npm');
        assert.equal(gestorDePaquetes(nuevoProyecto('g4', { 'package.json': '{"packageManager":"yarn@4.0.0"}', 'pnpm-lock.yaml': '' })), 'yarn', 'packageManager manda');
        assert.equal(gestorDePaquetes(nuevoProyecto('g5', { 'x.txt': '' })), 'pnpm');
    });

    test('resolverSharp: encuentra el del proyecto o el de --sharp-from; si falta, da el comando y no instala', async () => {
        const proyecto = nuevoProyecto('rs', { 'yarn.lock': '' });
        const sin = await resolverSharp({ proyecto });
        assert.equal(sin.ok, false);
        assert.equal(sin.instalar.comando, 'yarn add -D sharp');
        assert.match(sin.motivo, /no tiene "sharp" instalado/);
        sharpFalso(proyecto);
        const con = await resolverSharp({ proyecto });
        assert.equal(con.ok, true);
        assert.equal(con.version, '0.0.0-falso');
        const otra = join(tmp, 'otra-carpeta');
        sharpFalso(otra);
        const via = await resolverSharp({ proyecto: join(tmp, 'rs-vacio'), sharpFrom: otra });
        assert.equal(via.ok, true);
        assert.equal(via.desde, otra);
    });

    // ---------- la CLI de punta a punta ----------
    test('CLI: errores de uso salen con 1', () => {
        const raiz = proyectoMixto();
        assert.equal(correr(['--scan', '--apply', '--target', raiz]).code, 1, 'dos modos');
        assert.equal(correr(['--max-width', 'abc', '--target', raiz]).code, 1);
        assert.equal(correr(['--quality', '150', '--target', raiz]).code, 1);
        assert.equal(correr(['--target', nuevoProyecto('vacio', { 'a.txt': '' })]).code, 1, 'sin carpetas de imágenes');
        assert.equal(correr(['--scan', '../afuera', '--target', raiz]).code, 1);
        assert.equal(correr(['--restore', '--target', raiz]).code, 1, 'sin manifiesto no hay qué restaurar');
    });

    test('CLI --scan: solo lee y no necesita codificador', () => {
        const raiz = proyectoMixto();
        const r = correr(['--scan', '--target', raiz]);
        assert.equal(r.code, 0, r.stdout + r.stderr);
        assert.equal(r.json.resumen.convertibles, 5);
        assert.equal(r.json.resumen.seReducirian, 1);
        assert.deepEqual(r.json.resumen.ignoradas, { svg: 1, gif: 1, webp: 1, avif: 1 });
        assert.equal(r.json.respaldo, 'src/img-originales');
        assert.ok(existsSync(join(raiz, 'assets/img/hero.jpg')));
        assert.equal(correr(['--target', raiz]).json.modo, 'scan', 'sin modo se escanea');
    });

    test('CLI --dry-run y --apply sin sharp: salen con 5 y dan el comando exacto', () => {
        const raiz = nuevoProyecto('sinsharp', { 'pnpm-lock.yaml': '', 'img/a.jpg': jpg(100, 100) });
        for (const modo of ['--dry-run', '--apply', '--check-encoder']) {
            const r = correr([modo, '--target', raiz]);
            assert.equal(r.code, 5, `${modo}: ${r.stdout}`);
            assert.equal(r.json.instalar.comando, 'pnpm add -D sharp');
            assert.match(r.json.ayuda, /--sharp-from/);
        }
        assert.ok(existsSync(join(raiz, 'img/a.jpg')), 'no cambió nada');
        assert.ok(!existsSync(join(raiz, 'node_modules')), 'y no instaló nada');
    });

    test('CLI: dry-run, apply, segunda corrida y restore con un sharp falso', () => {
        const raiz = proyectoMixto();
        sharpFalso(raiz);
        writeFileSync(join(raiz, 'front-page.php'), "<?php $i = fn($a) => get_theme_file_uri('assets/img/' . $a); ?>\r\n<img src=\"<?= $i('hero.jpg') ?>\"><img src=\"<?= $i('logo.png') ?>\">\r\n");
        mkdirSync(join(raiz, 'specs/figma/lectura'), { recursive: true });
        writeFileSync(join(raiz, 'specs/figma/lectura/home.json'), '{"archivo":"home/assets/hero.jpg"}\n');
        writeFileSync(join(raiz, 'specs/_shared.md'), 'El logo es logo.png\n');
        const antes = readFileSync(join(raiz, 'front-page.php'), 'utf8');

        const seco = correr(['--dry-run', '--target', raiz]);
        assert.equal(seco.code, 0, seco.stdout + seco.stderr);
        assert.equal(seco.json.resumen.convertidas, 5);
        assert.equal(seco.json.resumen.referenciasCambiadas, 3);
        assert.equal(seco.json.manifiesto, null);
        assert.equal(readFileSync(join(raiz, 'front-page.php'), 'utf8'), antes, 'el dry-run no escribe');
        assert.ok(existsSync(join(raiz, 'assets/img/hero.jpg')) && !existsSync(join(raiz, 'assets/img/hero.webp')));

        const hecho = correr(['--apply', '--target', raiz]);
        assert.equal(hecho.code, 0, hecho.stdout + hecho.stderr);
        assert.equal(hecho.json.manifiesto, 'src/img-originales/img-webp.manifest.json');
        assert.ok(hecho.json.resumen.ahorroPorcentaje > 50);
        assert.ok(formatoReal(readFileSync(join(raiz, 'assets/img/hero.webp'))) === 'webp');
        assert.ok(existsSync(join(raiz, 'src/img-originales/assets/img/hero.jpg')), 'el original está en el respaldo');
        assert.ok(existsSync(join(raiz, 'assets/img/icono.svg')) && existsSync(join(raiz, 'assets/img/anim.gif')) && existsSync(join(raiz, 'assets/img/ya.webp')), 'svg, gif y webp siguen donde estaban');
        assert.match(readFileSync(join(raiz, 'front-page.php'), 'utf8'), /\$i\('hero\.webp'\).*\$i\('logo\.webp'\)/s);
        assert.equal(readFileSync(join(raiz, 'specs/figma/lectura/home.json'), 'utf8'), '{"archivo":"home/assets/hero.jpg"}\n', 'lo de Figma no se toca');
        assert.equal(readFileSync(join(raiz, 'specs/_shared.md'), 'utf8'), 'El logo es logo.webp\n');
        assert.ok(hecho.json.avisos.some((a) => /sube assets\/ al servidor junto con dist\//.test(a)), 'aviso de tema WordPress');
        assert.ok(hecho.json.imagenes.find((i) => i.original === 'assets/img/hero.jpg').reducida);
        const manifiesto = JSON.parse(readFileSync(join(raiz, 'src/img-originales/img-webp.manifest.json'), 'utf8'));
        assert.equal(manifiesto.imagenes.length, 5);
        assert.equal(manifiesto.referencias.length, 3);

        const otraVez = correr(['--apply', '--target', raiz]);
        assert.equal(otraVez.code, 0, otraVez.stdout);
        assert.equal(otraVez.json.resumen.convertidas, 0, 'idempotente: una segunda corrida no cambia nada');

        const vuelta = correr(['--restore', '--target', raiz]);
        assert.equal(vuelta.code, 0, vuelta.stdout + vuelta.stderr);
        assert.equal(vuelta.json.restauradas.length, 5);
        assert.equal(readFileSync(join(raiz, 'front-page.php'), 'utf8'), antes, 'las referencias vuelven');
        assert.ok(existsSync(join(raiz, 'assets/img/hero.jpg')) && !existsSync(join(raiz, 'assets/img/hero.webp')));
        assert.ok(!existsSync(join(raiz, 'src/img-originales/img-webp.manifest.json')), 'sin nada pendiente, el manifiesto se retira');
    });

    test('CLI: --no-refs, --backup y --max-width', () => {
        const raiz = nuevoProyecto('opciones', { 'img/a.jpg': jpg(3000, 2000, { peso: 8000 }), 'p.php': "<img src=\"img/a.jpg\">\n" });
        sharpFalso(raiz);
        const r = correr(['--apply', '--no-refs', '--backup', 'respaldo-x', '--max-width', '1000', 'img', '--target', raiz]);
        assert.equal(r.code, 0, r.stdout + r.stderr);
        assert.equal(r.json.respaldo, 'respaldo-x');
        assert.ok(existsSync(join(raiz, 'respaldo-x/img/a.jpg')));
        assert.equal(r.json.imagenes[0].anchoDespues, 1000);
        assert.equal(r.json.imagenes[0].altoDespues, 667);
        assert.equal(readFileSync(join(raiz, 'p.php'), 'utf8'), "<img src=\"img/a.jpg\">\n", 'con --no-refs no se editan referencias');
    });

    // ---------- conversión real (solo si hay sharp) ----------
    const sharpReal = await resolverSharp({ proyecto: skillDir, sharpFrom: process.env.IMG_WEBP_SHARP_FROM });
    if (!sharpReal.ok) {
        omitidas++;
        console.log('omit CLI con sharp real: no hay sharp (instálalo o define IMG_WEBP_SHARP_FROM=<carpeta con node_modules/sharp>)');
    } else {
        test('CLI con sharp real: WebP válido, proporción, transparencia y orientación', async () => {
            const sharp = sharpReal.sharp;
            const raiz = join(tmp, 'real');
            mkdirSync(join(raiz, 'img'), { recursive: true });
            await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#d7d0b5' } }).jpeg().toFile(join(raiz, 'img/grande.jpg'));
            await sharp({ create: { width: 400, height: 300, channels: 4, background: { r: 168, g: 86, b: 106, alpha: 0.5 } } }).png().toFile(join(raiz, 'img/logo.png'));
            await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#234549' } }).withMetadata({ orientation: 6 }).jpeg().toFile(join(raiz, 'img/girada.jpg'));
            const r = correr(['--apply', '--sharp-from', sharpReal.desde, 'img', '--target', raiz]);
            assert.equal(r.code, 0, r.stdout + r.stderr);
            const meta = async (rel) => sharp(readFileSync(join(raiz, rel))).metadata();
            const grande = await meta('img/grande.webp');
            assert.deepEqual([grande.format, grande.width, grande.height], ['webp', 2000, 1333]);
            const logo = await meta('img/logo.webp');
            assert.deepEqual([logo.width, logo.height, logo.hasAlpha], [400, 300, true], 'conserva medidas y transparencia');
            const girada = await meta('img/girada.webp');
            assert.deepEqual([girada.width, girada.height], [800, 1200], 'aplica la orientación Exif');
            assert.ok(existsSync(join(raiz, 'img-originales/img/grande.jpg')));
            assert.equal(correr(['--apply', '--sharp-from', sharpReal.desde, 'img', '--target', raiz]).json.resumen.convertidas, 0);
        });
    }
    await Promise.all(pendientes);
} finally {
    rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} pruebas pasaron${omitidas ? `, ${omitidas} omitida(s)` : ''}${process.exitCode ? ', hubo fallos' : ''}.`);
