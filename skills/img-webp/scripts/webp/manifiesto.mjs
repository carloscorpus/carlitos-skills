// El manifiesto guarda qué se convirtió, dónde quedó cada original y qué referencias se cambiaron.
// Sirve para el informe, para no repetir trabajo y para deshacer con --restore. Vive dentro de la carpeta de respaldo.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const NOMBRE_MANIFIESTO = 'img-webp.manifest.json';
export const FORMATO_MANIFIESTO = 1;

export const rutaManifiesto = (respaldoAbs) => join(respaldoAbs, NOMBRE_MANIFIESTO);

export function cargarManifiesto(respaldoAbs) {
    const ruta = rutaManifiesto(respaldoAbs);
    if (!existsSync(ruta)) return null;
    try {
        const datos = JSON.parse(readFileSync(ruta, 'utf8'));
        return datos?.formato === FORMATO_MANIFIESTO ? datos : null;
    } catch {
        return null;
    }
}

export function guardarManifiesto(respaldoAbs, datos) {
    const ruta = rutaManifiesto(respaldoAbs);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, `${JSON.stringify(datos, null, 2)}\n`);
    return ruta;
}

// Une lo nuevo con lo que ya había (una segunda corrida no pierde el historial): las imágenes se identifican
// por su ruta original y las referencias por archivo, línea y texto.
export function fusionarManifiesto(previo, nuevo) {
    if (!previo) return nuevo;
    const porOriginal = new Map(previo.imagenes.map((i) => [i.original, i]));
    for (const imagen of nuevo.imagenes) porOriginal.set(imagen.original, imagen);
    const claves = new Set(previo.referencias.map((r) => `${r.archivo}:${r.linea}:${r.de}:${r.a}`));
    const referencias = [...previo.referencias];
    for (const r of nuevo.referencias) if (!claves.has(`${r.archivo}:${r.linea}:${r.de}:${r.a}`)) referencias.push(r);
    return { ...nuevo, imagenes: [...porOriginal.values()], referencias };
}
