// El codificador WebP. Node no trae uno: se usa `sharp`, que NO va incluido en la skill. Se toma del proyecto
// (o de la carpeta de --sharp-from). Si falta, se devuelve el comando exacto para instalarlo y no se instala nada.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// pnpm, yarn o npm, según el lockfile o el campo packageManager del proyecto. Sin pistas: pnpm.
export function gestorDePaquetes(proyecto) {
    try {
        const campo = JSON.parse(readFileSync(join(proyecto, 'package.json'), 'utf8')).packageManager ?? '';
        const nombre = /^(pnpm|yarn|npm)@/.exec(campo)?.[1];
        if (nombre) return nombre;
    } catch {
        // sin package.json o ilegible: se sigue con los lockfiles
    }
    if (existsSync(join(proyecto, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(proyecto, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(proyecto, 'package-lock.json'))) return 'npm';
    return 'pnpm';
}

export function comandoInstalar(proyecto) {
    const gestor = gestorDePaquetes(proyecto);
    return { gestor, comando: { pnpm: 'pnpm add -D sharp', yarn: 'yarn add -D sharp', npm: 'npm install --save-dev sharp' }[gestor] };
}

// Busca `sharp` desde --sharp-from y luego desde el proyecto. Devuelve { ok: true, sharp, version, desde }
// o { ok: false, motivo, instalar: { gestor, comando } }.
export async function resolverSharp({ proyecto, sharpFrom }) {
    const intentos = [sharpFrom, proyecto].filter(Boolean).map((carpeta) => resolve(carpeta));
    const motivos = [];
    for (const base of intentos) {
        try {
            const pedir = createRequire(join(base, 'resolver.cjs'));
            const modulo = await import(pathToFileURL(pedir.resolve('sharp')).href);
            const sharp = modulo.default ?? modulo;
            if (typeof sharp !== 'function') throw new Error('el módulo "sharp" no exporta una función');
            return { ok: true, sharp, version: sharp.versions?.sharp ?? null, desde: base };
        } catch (e) {
            motivos.push(`${base}: ${e.code === 'MODULE_NOT_FOUND' ? 'no tiene "sharp" instalado' : e.message.split('\n')[0]}`);
        }
    }
    return { ok: false, motivo: motivos.join('; '), instalar: comandoInstalar(proyecto) };
}

// Convierte una imagen con sharp: aplica la orientación Exif, reduce solo si el plan lo pide (nunca amplía),
// conserva la transparencia y no copia metadatos. Devuelve { bytes, ancho, alto }.
export function crearCodificador(sharp) {
    return async function codificar(bytes, { reducir, ancho, calidad }) {
        let imagen = sharp(bytes, { failOn: 'none' }).rotate();
        if (reducir) imagen = imagen.resize({ width: ancho, withoutEnlargement: true });
        const salida = await imagen
            .webp({ quality: calidad, alphaQuality: 100, effort: 5, smartSubsample: true })
            .toBuffer({ resolveWithObject: true });
        return { bytes: salida.data, ancho: salida.info.width, alto: salida.info.height };
    };
}
