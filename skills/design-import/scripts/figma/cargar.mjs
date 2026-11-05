// Carga y valida las lecturas de specs/figma/lectura/*.json junto con sus enlaces. Lo usan figma-lectura.mjs
// y figma-inventario.mjs para que las dos lean y validen igual.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnlaces } from './enlaces.mjs';
import { validateLectura } from './lectura.mjs';

export const lecturaDir = (target) => join(target, 'specs', 'figma', 'lectura');

// Devuelve [{ page, file, data, enlaces, errors, warnings, counts }] o { error } si no se puede empezar.
export function cargarLecturas(target, page) {
    const dir = lecturaDir(target);
    if (!existsSync(dir)) return { error: 'No hay specs/figma/lectura/: todavía no se leyó ninguna página (references/fuente-figma.md).' };
    let files = readdirSync(dir).filter((name) => name.endsWith('.json') && !name.startsWith('_')).sort();
    if (page !== undefined) {
        const wanted = `${page.trim()}.json`;
        if (!files.includes(wanted)) return { error: `No existe specs/figma/lectura/${wanted}.`, available: files.map((n) => n.replace(/\.json$/, '')) };
        files = [wanted];
    }
    if (!files.length) return { error: 'specs/figma/lectura/ no tiene ninguna página leída.' };

    return files.map((name) => {
        const slug = name.replace(/\.json$/, '');
        const file = `specs/figma/lectura/${name}`;
        let data;
        try {
            data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
        } catch (e) {
            return { page: slug, file, data: null, errors: [{ path: '', message: `No es un JSON válido: ${e.message}` }], warnings: [], counts: { read: 0, pending: 0 } };
        }
        const enlacesFile = join(target, 'specs', 'figma', 'enlaces', `${slug}.md`);
        const enlaces = existsSync(enlacesFile) ? parseEnlaces(readFileSync(enlacesFile, 'utf8'), slug) : null;
        return { page: slug, file, data, enlaces, ...validateLectura(data, slug, { dir, enlaces }) };
    });
}
