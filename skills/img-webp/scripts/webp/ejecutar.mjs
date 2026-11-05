// El núcleo de la skill: escanear, planificar, convertir (con respaldo) y restaurar.
// Recibe el codificador como parámetro: en la CLI es `sharp`; en las pruebas, uno falso.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { CONVERTIBLES, EXTENSIONES_IMAGEN, leerImagen, medidasVisibles } from './imagen.mjs';
import { cargarManifiesto, rutaManifiesto } from './manifiesto.mjs';
import { ANCHO_MAX, CALIDAD, nombreWebp, planificarTamano, posix } from './plan.mjs';
import { revertirReferencias } from './referencias.mjs';

export { ANCHO_MAX, CALIDAD };
const DIRS_IGNORADOS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.next', '.nuxt']);
export const CARPETAS_POR_DEFECTO = ['assets/img', 'src/img', 'public/images', 'images', 'img'];

// Carpeta de respaldo (absoluta). Por defecto src/img-originales si existe src/ (no se sube al servidor); si no, img-originales/.
export function carpetaRespaldo(raiz, explicito) {
    if (explicito) return resolve(raiz, explicito);
    return existsSync(join(raiz, 'src')) ? join(raiz, 'src', 'img-originales') : join(raiz, 'img-originales');
}

export const alcancePorDefecto = (raiz) => CARPETAS_POR_DEFECTO.filter((c) => existsSync(join(raiz, c)) && statSync(join(raiz, c)).isDirectory());

const relativa = (raiz, ruta) => posix(relative(raiz, ruta));
const dentro = (raiz, ruta) => { const r = relative(raiz, ruta); return r !== '' && !r.startsWith('..') && !isAbsolute(r); };

// Archivos de imagen (rutas absolutas) de las rutas dadas: una imagen suelta o una carpeta entera.
function listarArchivos(raiz, rutas, respaldoAbs) {
    const salida = [];
    const recorrer = (carpeta) => {
        for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
            const ruta = join(carpeta, entrada.name);
            if (entrada.isDirectory()) {
                if (!DIRS_IGNORADOS.has(entrada.name) && resolve(ruta) !== resolve(respaldoAbs)) recorrer(ruta);
            } else if (entrada.isFile() && EXTENSIONES_IMAGEN.has(extname(entrada.name).toLowerCase())) {
                salida.push(ruta);
            }
        }
    };
    for (const dada of rutas) {
        const ruta = resolve(raiz, dada);
        if (!dentro(raiz, ruta)) throw new Error(`"${dada}" está fuera del proyecto: indica una ruta dentro de ${raiz}.`);
        if (!existsSync(ruta)) throw new Error(`No existe "${dada}".`);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (EXTENSIONES_IMAGEN.has(extname(ruta).toLowerCase())) salida.push(ruta);
        else throw new Error(`"${dada}" no es una imagen (png, jpg, jpeg, gif, webp, avif o svg) ni una carpeta.`);
    }
    return [...new Set(salida)].sort();
}

// Lee las imágenes y las clasifica por su formato REAL: convertibles (png y jpg), ignoradas (svg, gif, avif, webp)
// y desconocidas. No lleva los bytes: solo medidas y pesos.
export function escanear(raiz, rutas, { respaldoAbs }) {
    const convertibles = [];
    const ignoradas = [];
    const desconocidas = [];
    const avisos = [];
    for (const ruta of listarArchivos(raiz, rutas, respaldoAbs)) {
        const rel = relativa(raiz, ruta);
        if (extname(ruta).toLowerCase() === '.svg') { ignoradas.push({ ruta: rel, formato: 'svg', peso: statSync(ruta).size }); continue; }
        const { bytes, ...info } = leerImagen(ruta);
        if (CONVERTIBLES.has(info.formato)) {
            const esperado = info.ext === '.png' ? 'png' : info.ext === '.jpg' || info.ext === '.jpeg' ? 'jpg' : null;
            if (esperado && esperado !== info.formato) avisos.push(`${rel} dice ser ${esperado.toUpperCase()} pero es un ${info.formato.toUpperCase()}: se convierte igual.`);
            convertibles.push({ ...info, ruta: rel });
        } else if (info.formato) {
            ignoradas.push({ ruta: rel, formato: info.formato, peso: info.peso });
        } else {
            desconocidas.push({ ruta: rel, peso: info.peso, motivo: 'formato no reconocido' });
        }
    }
    return { convertibles, ignoradas, desconocidas, avisos };
}

// Decide qué se hace con cada imagen: convertir (y a qué medidas) u omitir (y por qué).
export function planificar(raiz, convertibles, { anchoMax = ANCHO_MAX, force = false } = {}) {
    const destinos = new Map();
    return convertibles.map((img) => {
        const webp = nombreWebp(img.ruta);
        const visibles = medidasVisibles(img);
        const tamano = planificarTamano(visibles, anchoMax);
        const base = {
            original: img.ruta, webp, formato: img.formato, peso: img.peso, alfa: Boolean(img.alfa),
            anchoAntes: visibles.ancho ?? null, altoAntes: visibles.alto ?? null,
            reducir: tamano.reducir, anchoSalida: tamano.ancho ?? null, altoSalida: tamano.alto ?? null,
        };
        if (destinos.has(webp)) return { ...base, accion: 'omitir', motivo: `${destinos.get(webp)} ya produce ${webp}: dos imágenes con el mismo nombre y distinta extensión` };
        destinos.set(webp, img.ruta);
        if (existsSync(join(raiz, webp)) && !force) return { ...base, accion: 'omitir', motivo: `ya existe ${webp} (usa --force para rehacerlo)` };
        return { ...base, accion: 'convertir' };
    });
}

function moverArchivo(origen, destino) {
    mkdirSync(dirname(destino), { recursive: true });
    try {
        renameSync(origen, destino);
    } catch (e) {
        if (e.code !== 'EXDEV') throw e;
        copyFileSync(origen, destino);
        unlinkSync(origen);
    }
}

// Convierte lo planificado. Con `escribir: false` codifica en memoria y mide el ahorro real, sin tocar nada.
// Si el WebP no resulta más liviano que el original, el original se queda y se informa.
export async function convertir(raiz, plan, { codificar, calidad = CALIDAD, respaldoAbs, escribir }) {
    const convertidas = [];
    const omitidas = plan.filter((p) => p.accion === 'omitir').map((p) => ({ ruta: p.original, motivo: p.motivo }));
    for (const item of plan.filter((p) => p.accion === 'convertir')) {
        const origenAbs = join(raiz, item.original);
        const bytes = readFileSync(origenAbs);
        const salida = await codificar(bytes, { reducir: item.reducir, ancho: item.anchoSalida, calidad });
        if (salida.bytes.length >= item.peso) {
            omitidas.push({ ruta: item.original, motivo: `el WebP no queda más liviano (${item.peso} → ${salida.bytes.length} bytes): se deja el original` });
            continue;
        }
        const respaldoRel = posix(relative(raiz, join(respaldoAbs, item.original)));
        if (escribir) {
            const destinoAbs = join(raiz, item.webp);
            const temporal = `${destinoAbs}.tmp`;
            writeFileSync(temporal, salida.bytes);
            renameSync(temporal, destinoAbs);
            moverArchivo(origenAbs, join(respaldoAbs, item.original));
        }
        convertidas.push({
            original: item.original, webp: item.webp, respaldo: respaldoRel, formato: item.formato, alfa: item.alfa,
            pesoAntes: item.peso, pesoDespues: salida.bytes.length,
            anchoAntes: item.anchoAntes, altoAntes: item.altoAntes, anchoDespues: salida.ancho ?? item.anchoSalida, altoDespues: salida.alto ?? item.altoSalida,
            reducida: item.reducir,
        });
    }
    return { convertidas, omitidas };
}

// Deshace una conversión guardada en el manifiesto: devuelve los originales, borra los .webp y revierte las referencias.
export function restaurar(raiz, { respaldoAbs }) {
    const manifiesto = cargarManifiesto(respaldoAbs);
    if (!manifiesto) return { ok: false, error: `No hay manifiesto en ${relativa(raiz, rutaManifiesto(respaldoAbs))}: no hay nada que restaurar.` };
    const restauradas = [];
    const fallidas = [];
    for (const imagen of manifiesto.imagenes) {
        const respaldo = join(raiz, imagen.respaldo);
        if (!existsSync(respaldo)) { fallidas.push({ ruta: imagen.original, motivo: `falta el respaldo ${imagen.respaldo}` }); continue; }
        if (existsSync(join(raiz, imagen.webp))) unlinkSync(join(raiz, imagen.webp));
        moverArchivo(respaldo, join(raiz, imagen.original));
        restauradas.push(imagen.original);
    }
    const referencias = revertirReferencias(raiz, manifiesto.referencias);
    if (!fallidas.length) rmSync(rutaManifiesto(respaldoAbs), { force: true });
    return { ok: true, restauradas, fallidas, referencias };
}
