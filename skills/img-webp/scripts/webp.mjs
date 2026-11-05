#!/usr/bin/env node
// Convierte las imágenes PNG, JPG y JPEG de un proyecto a WebP. Los SVG, GIF, AVIF y WebP no se tocan.
// Independiente de las demás skills y de WordPress: sirve en cualquier carpeta con imágenes.
//
// Uso (desde la raíz del proyecto, o con --target <dir>):
//   node webp.mjs --check-encoder [--sharp-from <dir>]
//       Comprueba que hay un codificador (sharp). Si falta, sale con 5 y trae el comando para instalarlo.
//   node webp.mjs --scan [<ruta>…]
//       Solo lectura: lista lo que se convertiría (formato real, medidas, peso) y lo que se ignora.
//   node webp.mjs --dry-run [<ruta>…]
//       Codifica en memoria y muestra el ahorro real y las referencias que cambiarían. No escribe nada.
//   node webp.mjs --apply [<ruta>…]
//       Convierte, mueve los originales al respaldo, actualiza las referencias y guarda el manifiesto.
//   node webp.mjs --restore
//       Deshace la última conversión con el manifiesto (originales, .webp y referencias).
//
// <ruta>: una imagen o una carpeta dentro del proyecto. Sin rutas se usan las carpetas habituales que existan
// (assets/img, src/img, public/images, images, img).
//
// Opciones: --max-width 2000 (ancho máximo; lo que mida menos conserva sus medidas y nunca se amplía),
// --quality 80, --backup <dir> (por defecto src/img-originales si existe src/, si no img-originales),
// --no-refs (no tocar referencias), --force (rehacer un .webp que ya existe), --sharp-from <dir>.
//
// Sale con JSON en stdout. Códigos: 0 ok, 1 error de uso, 5 no hay codificador (sharp).

import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { crearCodificador, resolverSharp } from './webp/codificador.mjs';
import { alcancePorDefecto, ANCHO_MAX, CALIDAD, carpetaRespaldo, convertir, escanear, planificar, restaurar } from './webp/ejecutar.mjs';
import { cargarManifiesto, FORMATO_MANIFIESTO, fusionarManifiesto, guardarManifiesto, rutaManifiesto } from './webp/manifiesto.mjs';
import { legible, posix } from './webp/plan.mjs';
import { trabajarReferencias } from './webp/referencias.mjs';
import { fail, skillVersion } from './lib/common.mjs';

let args;
let rutas;
try {
    ({ values: args, positionals: rutas } = parseArgs({
        allowPositionals: true,
        options: {
            target: { type: 'string', default: process.cwd() },
            scan: { type: 'boolean', default: false },
            'dry-run': { type: 'boolean', default: false },
            apply: { type: 'boolean', default: false },
            restore: { type: 'boolean', default: false },
            'check-encoder': { type: 'boolean', default: false },
            'max-width': { type: 'string', default: String(ANCHO_MAX) },
            quality: { type: 'string', default: String(CALIDAD) },
            backup: { type: 'string' },
            'no-refs': { type: 'boolean', default: false },
            force: { type: 'boolean', default: false },
            'sharp-from': { type: 'string' },
        },
    }));
} catch (e) {
    fail(1, e.message);
}

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = resolve(args.target);
if (!existsSync(raiz)) fail(1, `No existe la carpeta ${raiz}.`);

const modos = ['scan', 'dry-run', 'apply', 'restore', 'check-encoder'].filter((m) => args[m]);
if (modos.length > 1) fail(1, `Elige un solo modo: ${modos.map((m) => `--${m}`).join(', ')}.`);
const modo = modos[0] ?? 'scan';

const anchoMax = Number(args['max-width']);
const calidad = Number(args.quality);
if (!Number.isInteger(anchoMax) || anchoMax < 100) fail(1, '--max-width debe ser un número entero de al menos 100 (píxeles).');
if (!Number.isInteger(calidad) || calidad < 1 || calidad > 100) fail(1, '--quality debe ser un número entero entre 1 y 100.');

const respaldoAbs = carpetaRespaldo(raiz, args.backup);
const respaldoRel = posix(relative(raiz, respaldoAbs));
const encoder = async () => {
    const encontrado = await resolverSharp({ proyecto: raiz, sharpFrom: args['sharp-from'] });
    if (!encontrado.ok) {
        fail(5, 'No hay codificador WebP: falta "sharp". La skill no instala nada por su cuenta.', {
            instalar: encontrado.instalar, motivo: encontrado.motivo,
            ayuda: `Ejecuta "${encontrado.instalar.comando}" en ${raiz} (con ${encontrado.instalar.gestor}) y vuelve a correr esto, o usa --sharp-from <carpeta> si sharp está instalado en otra parte.`,
        });
    }
    return encontrado;
};

// ---------- --check-encoder ----------
if (modo === 'check-encoder') {
    const { version, desde } = await encoder();
    console.log(JSON.stringify({ ok: true, modo, encoder: { nombre: 'sharp', version, desde } }, null, 2));
    process.exit(0);
}

// ---------- --restore ----------
if (modo === 'restore') {
    const resultado = restaurar(raiz, { respaldoAbs });
    if (!resultado.ok) fail(1, resultado.error);
    console.log(JSON.stringify({ ok: true, modo, respaldo: respaldoRel, ...resultado }, null, 2));
    process.exit(0);
}

// ---------- --scan / --dry-run / --apply ----------
const alcance = rutas.length ? rutas : alcancePorDefecto(raiz);
if (!alcance.length) fail(1, 'No encontré carpetas de imágenes (assets/img, src/img, public/images, images, img): indica la ruta de una imagen o de una carpeta.');

let hallado;
try {
    hallado = escanear(raiz, alcance, { respaldoAbs });
} catch (e) {
    fail(1, e.message);
}
const plan = planificar(raiz, hallado.convertibles, { anchoMax, force: args.force });
const ignoradasPorFormato = {};
for (const i of hallado.ignoradas) ignoradasPorFormato[i.formato] = (ignoradasPorFormato[i.formato] ?? 0) + 1;

if (modo === 'scan') {
    console.log(JSON.stringify({
        ok: true, modo, raiz, alcance, respaldo: respaldoRel, anchoMax,
        resumen: {
            convertibles: plan.filter((p) => p.accion === 'convertir').length,
            omitidas: plan.filter((p) => p.accion === 'omitir').length,
            pesoActual: legible(plan.reduce((s, p) => s + p.peso, 0)),
            seReducirian: plan.filter((p) => p.reducir).length,
            ignoradas: ignoradasPorFormato,
        },
        imagenes: plan,
        ignoradas: hallado.ignoradas,
        desconocidas: hallado.desconocidas,
        avisos: hallado.avisos,
    }, null, 2));
    process.exit(0);
}

const escribir = modo === 'apply';
const { sharp } = await encoder();
const { convertidas, omitidas } = await convertir(raiz, plan, { codificar: crearCodificador(sharp), calidad, respaldoAbs, escribir });

// Referencias: solo si el proyecto ya usa esas imágenes. Se ignoran el respaldo y lo que entregó Figma
// (specs/figma/lectura: su validador exige que el tipo coincida con la extensión).
let referencias = { revisados: 0, cambios: [], ambiguas: [] };
if (!args['no-refs'] && convertidas.length) {
    referencias = trabajarReferencias(raiz, convertidas, { ignorar: [respaldoRel, 'specs/figma/lectura'], escribir });
}

const avisos = [...hallado.avisos];
if (existsSync(join(raiz, 'functions.php')) && existsSync(join(raiz, 'style.css')) && convertidas.length) {
    avisos.push('Tema WordPress: sube assets/ al servidor junto con dist/. Los originales quedaron en el respaldo, que no se sube.');
}
if (convertidas.length && (existsSync(join(raiz, 'inc/acf/runner.php')) || existsSync(join(raiz, 'inc/acf/seed')))) {
    avisos.push('wp-acf identifica cada imagen de la mediateca por su ruta: con la ruta nueva (.webp) la carga crea un adjunto nuevo y el viejo (.jpg/.png) queda sin usar.');
}
if (referencias.ambiguas.length) avisos.push(`${referencias.ambiguas.length} referencia(s) no se tocaron por ser ambiguas: revísalas a mano (ver "referencias.ambiguas").`);

let manifiesto = null;
if (escribir && (convertidas.length || omitidas.length)) {
    const nuevo = {
        formato: FORMATO_MANIFIESTO, version: skillVersion(skillDir), fecha: new Date().toISOString(),
        opciones: { anchoMax, calidad }, imagenes: convertidas, omitidas, referencias: referencias.cambios.map(({ texto, ...resto }) => resto),
    };
    guardarManifiesto(respaldoAbs, fusionarManifiesto(cargarManifiesto(respaldoAbs), nuevo));
    manifiesto = posix(relative(raiz, rutaManifiesto(respaldoAbs)));
}

const pesoAntes = convertidas.reduce((s, c) => s + c.pesoAntes, 0);
const pesoDespues = convertidas.reduce((s, c) => s + c.pesoDespues, 0);
console.log(JSON.stringify({
    ok: true, modo, raiz, alcance, respaldo: respaldoRel, manifiesto, anchoMax, calidad,
    resumen: {
        convertidas: convertidas.length, omitidas: omitidas.length, reducidas: convertidas.filter((c) => c.reducida).length,
        pesoAntes: legible(pesoAntes), pesoDespues: legible(pesoDespues), ahorro: legible(pesoAntes - pesoDespues),
        ahorroPorcentaje: pesoAntes ? Math.round((1 - pesoDespues / pesoAntes) * 100) : 0,
        referenciasCambiadas: referencias.cambios.length, referenciasAmbiguas: referencias.ambiguas.length,
        ignoradas: ignoradasPorFormato,
    },
    imagenes: convertidas, omitidas,
    referencias: { revisados: referencias.revisados, cambios: referencias.cambios.slice(0, 300), ambiguas: referencias.ambiguas },
    avisos,
}, null, 2));
