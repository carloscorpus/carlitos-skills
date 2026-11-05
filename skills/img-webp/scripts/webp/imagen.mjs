// Reconoce una imagen por sus bytes (no por la extensión) y lee sus medidas sin librerías.
// Figma, por ejemplo, entregó un JPEG bajo un link ".png": la extensión no prueba el formato.

import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

// Extensiones que se miran. Lo que no está aquí (css, php, zip…) ni se abre.
export const EXTENSIONES_IMAGEN = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg']);
// Formatos que se convierten a WebP. El resto (svg, gif, avif, webp) se deja como está.
export const CONVERTIBLES = new Set(['png', 'jpg']);

const PNG_FIRMA = Buffer.from('89504e470d0a1a0a', 'hex');

// Formato real: 'png' | 'jpg' | 'gif' | 'webp' | 'avif' | 'svg' | null (no se reconoce).
export function formatoReal(buf) {
    const texto = (desde, hasta) => buf.subarray(desde, hasta).toString('latin1');
    if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_FIRMA)) return 'png';
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (texto(0, 4) === 'GIF8') return 'gif';
    if (texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP') return 'webp';
    if (texto(4, 8) === 'ftyp' && ['avif', 'avis'].includes(texto(8, 12))) return 'avif';
    if (/^\s*(<\?xml|<svg|<!--|<!DOCTYPE svg)/i.test(buf.subarray(0, 512).toString('utf8').replace(/^﻿/, ''))) return 'svg';
    return null;
}

// PNG: ancho y alto del IHDR, y si declara transparencia (tipo de color con alfa o un bloque tRNS).
function datosPng(buf) {
    if (buf.length < 33) return {};
    const tipoColor = buf[25];
    let alfa = tipoColor === 4 || tipoColor === 6;
    for (let i = 8; !alfa && i + 8 <= buf.length;) {
        const largo = buf.readUInt32BE(i);
        const tipo = buf.toString('latin1', i + 4, i + 8);
        if (tipo === 'tRNS') alfa = true;
        if (tipo === 'IDAT' || tipo === 'IEND') break;
        i += 12 + largo;
    }
    return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), alfa };
}

// JPEG: recorre los marcadores hasta el SOF (medidas) y lee la orientación Exif si la trae.
function datosJpeg(buf) {
    let ancho; let alto; let orientacion = 1;
    for (let i = 2; i + 4 <= buf.length;) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marcador = buf[i + 1];
        if (marcador === 0xff) { i++; continue; }
        if (marcador === 0xd8 || (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) { i += 2; continue; }
        const largo = buf.readUInt16BE(i + 2);
        if (marcador === 0xe1 && buf.toString('latin1', i + 4, i + 8) === 'Exif') {
            orientacion = orientacionExif(buf.subarray(i + 10, i + 2 + largo)) ?? 1;
        }
        const esSof = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
        if (esSof && i + 9 <= buf.length) {
            alto = buf.readUInt16BE(i + 5);
            ancho = buf.readUInt16BE(i + 7);
            break;
        }
        i += 2 + largo;
    }
    return { ancho, alto, orientacion };
}

// Orientación Exif (1 a 8) desde el bloque TIFF, o null.
function orientacionExif(tiff) {
    if (tiff.length < 8) return null;
    const little = tiff.toString('latin1', 0, 2) === 'II';
    const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
    const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
    const ifd = u32(4);
    if (ifd + 2 > tiff.length) return null;
    const entradas = u16(ifd);
    for (let n = 0; n < entradas; n++) {
        const o = ifd + 2 + n * 12;
        if (o + 12 > tiff.length) break;
        if (u16(o) === 0x0112) return u16(o + 8);
    }
    return null;
}

// Medidas "como se ven": con orientación Exif de 5 a 8 la foto se muestra girada y ancho y alto se intercambian.
export function medidasVisibles({ ancho, alto, orientacion = 1 }) {
    return orientacion >= 5 && orientacion <= 8 ? { ancho: alto, alto: ancho } : { ancho, alto };
}

// Lee un archivo y devuelve { ruta, ext, peso, formato, ancho, alto, orientacion, alfa, bytes }.
// `ancho` y `alto` son los del archivo; con `medidasVisibles` se obtienen los de pantalla.
export function leerImagen(ruta) {
    const bytes = readFileSync(ruta);
    const formato = formatoReal(bytes);
    const base = { ruta, ext: extname(ruta).toLowerCase(), peso: statSync(ruta).size, formato, bytes };
    if (formato === 'png') return { ...base, ...datosPng(bytes), orientacion: 1 };
    if (formato === 'jpg') return { ...base, ...datosJpeg(bytes), alfa: false };
    if (formato === 'gif' && bytes.length >= 10) return { ...base, ancho: bytes.readUInt16LE(6), alto: bytes.readUInt16LE(8), orientacion: 1, alfa: false };
    return { ...base, orientacion: 1, alfa: false };
}
