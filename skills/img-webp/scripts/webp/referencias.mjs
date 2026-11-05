// Busca y reemplaza, en los archivos de texto del proyecto, los nombres de las imágenes convertidas
// (hero.jpg -> hero.webp). La misma función sirve para mostrar la vista previa y para aplicar: lo que se
// muestra es exactamente lo que se cambia.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { posix } from './plan.mjs';

export const EXT_TEXTO = new Set([
    '.php', '.css', '.scss', '.sass', '.less', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte',
    '.html', '.htm', '.twig', '.md', '.mdx', '.json', '.yml', '.yaml', '.xml',
]);
export const DIRS_IGNORADOS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.next', '.nuxt', 'coverage']);
const MAX_BYTES = 2 * 1024 * 1024;
const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'composer.lock']);

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Archivos de texto del proyecto (rutas relativas con barras normales). `ignorar` son prefijos de ruta que no se leen
// (el respaldo, specs/figma/lectura…).
export function archivosDeTexto(raiz, { ignorar = [] } = {}) {
    const prefijos = ignorar.map((p) => posix(p).replace(/\/+$/, ''));
    const salida = [];
    const recorrer = (carpetaRel) => {
        for (const entrada of readdirSync(join(raiz, carpetaRel), { withFileTypes: true })) {
            const rel = carpetaRel ? `${carpetaRel}/${entrada.name}` : entrada.name;
            if (prefijos.some((p) => rel === p || rel.startsWith(`${p}/`))) continue;
            if (entrada.isDirectory()) {
                if (!DIRS_IGNORADOS.has(entrada.name)) recorrer(rel);
            } else if (entrada.isFile()) {
                if (!EXT_TEXTO.has(extname(entrada.name).toLowerCase()) || LOCKFILES.has(entrada.name) || /\.min\./.test(entrada.name)) continue;
                if (statSync(join(raiz, rel)).size <= MAX_BYTES) salida.push(rel);
            }
        }
    };
    recorrer('');
    return salida.sort();
}

// Arma el índice por nombre de archivo. `convertidos`: [{ original: 'assets/img/a.jpg', webp: 'assets/img/a.webp' }].
function indice(convertidos) {
    const porNombre = new Map();
    for (const c of convertidos) {
        const nombre = c.original.split('/').pop();
        porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), c]);
    }
    const nombres = [...porNombre.keys()].sort((a, b) => b.length - a.length).map(escapar);
    const regex = nombres.length ? new RegExp(`(?<![A-Za-z0-9_.-])(?:${nombres.join('|')})(?![A-Za-z0-9_])`, 'g') : null;
    return { porNombre, regex };
}

// Decide a qué archivo convertido apunta una aparición. Un nombre único se reemplaza siempre (en PHP suele ir
// suelto: 'hero.jpg'). Si hay varios archivos con ese nombre, o la ruta escrita no coincide, se deja y se avisa.
function resolver(nombre, antes, candidatos) {
    // La ruta tal como está escrita ("../assets/img/", "https://sitio/themes/x/assets/img/", "img/"), sin los "./" y "../" del inicio.
    const ruta = (/([A-Za-z0-9_./-]*)$/.exec(antes)?.[1] ?? '').replace(/^(\.{1,2}\/)+/, '');
    // Coincide si una ruta termina en la otra: la referencia puede ser más larga (una URL con la carpeta del tema)
    // o más corta ("img/logo.png") que la ruta del archivo convertido.
    const encaja = (c) => c.original.endsWith(ruta + nombre) || (ruta + nombre).endsWith(c.original);
    if (candidatos.length === 1) {
        if (ruta === '' || encaja(candidatos[0])) return { destino: candidatos[0] };
        return { motivo: `la ruta "${ruta}${nombre}" no coincide con ${candidatos[0].original}` };
    }
    if (ruta === '') return { motivo: `hay ${candidatos.length} archivos llamados ${nombre} y la referencia no dice en qué carpeta` };
    const coinciden = candidatos.filter(encaja);
    return coinciden.length === 1 ? { destino: coinciden[0] } : { motivo: `la ruta "${ruta}${nombre}" no identifica un solo archivo` };
}

// Procesa el texto de un archivo. Devuelve { texto, cambios, ambiguas }. `cambios` y `ambiguas` llevan la línea.
export function procesarTexto(contenido, archivo, convertidos) {
    const { porNombre, regex } = indice(convertidos);
    if (!regex) return { texto: contenido, cambios: [], ambiguas: [] };
    const eol = contenido.includes('\r\n') ? '\r\n' : '\n';
    const cambios = [];
    const ambiguas = [];
    const lineas = contenido.split(/\r?\n/).map((linea, i) => {
        if (!linea.includes('.')) return linea;
        return linea.replace(regex, (nombre, desplazamiento) => {
            const veredicto = resolver(nombre, linea.slice(0, desplazamiento), porNombre.get(nombre));
            if (!veredicto.destino) {
                ambiguas.push({ archivo, linea: i + 1, nombre, motivo: veredicto.motivo });
                return nombre;
            }
            const nuevo = veredicto.destino.webp.split('/').pop();
            cambios.push({ archivo, linea: i + 1, de: nombre, a: nuevo, texto: linea.trim().slice(0, 160) });
            return nuevo;
        });
    });
    return { texto: lineas.join(eol), cambios, ambiguas };
}

// Recorre el proyecto. Con `escribir: true` guarda los archivos cambiados; sin él solo informa.
export function trabajarReferencias(raiz, convertidos, { ignorar = [], escribir = false } = {}) {
    const archivos = archivosDeTexto(raiz, { ignorar });
    const cambios = [];
    const ambiguas = [];
    for (const archivo of archivos) {
        const original = readFileSync(join(raiz, archivo), 'utf8');
        const resultado = procesarTexto(original, archivo, convertidos);
        cambios.push(...resultado.cambios);
        ambiguas.push(...resultado.ambiguas);
        if (escribir && resultado.texto !== original) writeFileSync(join(raiz, archivo), resultado.texto);
    }
    return { revisados: archivos.length, cambios, ambiguas };
}

// Deshace cambios guardados en el manifiesto: en cada línea vuelve `a` -> `de`. Devuelve { revertidos, fallidos }.
export function revertirReferencias(raiz, cambios) {
    let revertidos = 0;
    const fallidos = [];
    const porArchivo = new Map();
    for (const c of cambios) porArchivo.set(c.archivo, [...(porArchivo.get(c.archivo) ?? []), c]);
    for (const [archivo, lista] of porArchivo) {
        let contenido;
        try {
            contenido = readFileSync(join(raiz, archivo), 'utf8');
        } catch {
            fallidos.push(...lista.map((c) => ({ ...c, motivo: 'el archivo ya no existe' })));
            continue;
        }
        const eol = contenido.includes('\r\n') ? '\r\n' : '\n';
        const lineas = contenido.split(/\r?\n/);
        for (const c of lista) {
            const patron = new RegExp(`(?<![A-Za-z0-9_.-])${escapar(c.a)}(?![A-Za-z0-9_])`, 'g');
            const actual = lineas[c.linea - 1];
            if (actual !== undefined && patron.test(actual)) {
                lineas[c.linea - 1] = actual.replace(patron, c.de);
                revertidos++;
            } else {
                fallidos.push({ ...c, motivo: `la línea ${c.linea} ya no contiene ${c.a}` });
            }
        }
        writeFileSync(join(raiz, archivo), lineas.join(eol));
    }
    return { revertidos, fallidos };
}
