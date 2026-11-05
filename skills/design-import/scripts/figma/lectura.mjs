// Formato de specs/figma/lectura/<página>.json y su validación. Sin dependencias y sin llamar a Figma.
// La lectura la hace el agente con el MCP de Figma (references/fuente-figma.md); este módulo solo comprueba
// que lo guardado tenga la forma acordada, para que los pasos siguientes no dependan de cómo se leyó.

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { SLUG } from './enlaces.mjs';

export const FORMATO = 1;
export const ROLES_TEXTO = ['eyebrow', 'titulo', 'subtitulo', 'parrafo', 'etiqueta', 'boton', 'lista', 'pie', 'otro'];
export const TIPOS_IMAGEN = ['png', 'jpg', 'svg', 'gif', 'webp'];
export const ROLES_IMAGEN = ['contenido', 'decorativa'];
export const TIPOS_SENAL = ['repetidor', 'slider', 'formulario', 'modal', 'acordeon', 'menu', 'pestanas', 'listado', 'decorativo', 'otro'];
export const ESTADOS_SENAL = ['propuesto', 'confirmado'];
export const UNIDADES = ['%', 'px'];

const FILE_KEY = /^[0-9a-zA-Z]{22,128}$/;
const NODE_ID = /^\d+:\d+$/;
// Un nodo dentro de una instancia de componente se ve como "I3704:18079;3704:22279".
const NODE_ID_ANY = /^I?\d+:\d+(;\d+:\d+)*$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
// Los links de descarga que entrega Figma vencen a los 7 días: nunca se guardan, se baja el archivo.
const URL_TEMPORAL = /figma\.com\/api\/mcp\/asset/i;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Formato real de una imagen por sus primeros bytes (png, jpg, gif, webp, svg) o null si no se reconoce.
// Figma puede servir un JPEG bajo un link que termina en ".png": la extensión no basta para saber qué es.
export function formatoReal(path) {
    const fd = openSync(path, 'r');
    const buf = Buffer.alloc(512);
    const head = buf.subarray(0, readSync(fd, buf, 0, 512, 0));
    closeSync(fd);
    const text = (from, to) => head.subarray(from, to).toString('latin1');
    if (head.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
    if (text(0, 4) === 'GIF8') return 'gif';
    if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
    if (/^\s*(<\?xml|<svg|<!--|<!DOCTYPE svg)/i.test(head.toString('utf8').replace(/^﻿/, ''))) return 'svg';
    return null;
}

// Valida una lectura. `slug` es el nombre del archivo sin .json; `dir` es specs/figma/lectura (los archivos
// guardados se buscan relativos a él); `enlaces` es el resultado de parseEnlaces() de esa página, si existe.
export function validateLectura(data, slug, { dir, enlaces = null } = {}) {
    const errors = [];
    const warnings = [];
    const err = (path, message) => errors.push({ path, message });
    const warn = (path, message) => warnings.push({ path, message });
    const counts = { read: 0, pending: 0 };

    if (!isObj(data)) {
        err('', 'El archivo debe ser un objeto JSON.');
        return { errors, warnings, counts };
    }
    if (data.formato !== FORMATO) err('formato', `"formato" debe ser ${FORMATO} (viene ${JSON.stringify(data.formato)}).`);
    if (data.pagina !== slug) err('pagina', `"pagina" dice ${JSON.stringify(data.pagina)} pero el archivo es "${slug}.json".`);
    if (URL_TEMPORAL.test(JSON.stringify(data))) {
        err('', 'Hay links temporales de descarga de Figma (vencen a los 7 días): guarda el archivo descargado y pon su ruta.');
    }

    const fuente = data.fuente;
    if (!isObj(fuente)) err('fuente', 'Falta "fuente" ({ fileKey, nodeId, ancho, alto }).');
    else {
        if (!FILE_KEY.test(fuente.fileKey ?? '')) err('fuente.fileKey', 'La clave del archivo de Figma no es válida.');
        if (!NODE_ID.test(fuente.nodeId ?? '')) err('fuente.nodeId', 'El nodeId debe verse como "3638:2095" (con ":").');
        for (const key of ['ancho', 'alto']) if (!isNum(fuente[key]) || fuente[key] <= 0) err(`fuente.${key}`, `"${key}" debe ser un número mayor que 0.`);
    }

    const tokens = data.tokens;
    const tokenNames = { colores: new Set(), texto: new Set() };
    if (!isObj(tokens)) err('tokens', 'Falta "tokens" ({ colores, texto, sombras }; pueden ir vacíos).');
    else {
        for (const key of ['colores', 'texto', 'sombras']) if (!isObj(tokens[key])) err(`tokens.${key}`, `Falta "tokens.${key}" (un objeto; puede ir vacío).`);
        for (const [name, value] of Object.entries(isObj(tokens.colores) ? tokens.colores : {})) {
            tokenNames.colores.add(name);
            if (!HEX.test(value ?? '')) err(`tokens.colores.${name}`, `El color debe ser hexadecimal (#rrggbb o #rrggbbaa), no ${JSON.stringify(value)}.`);
        }
        for (const [name, style] of Object.entries(isObj(tokens.texto) ? tokens.texto : {})) {
            tokenNames.texto.add(name);
            const at = `tokens.texto.${name}`;
            if (!isObj(style)) { err(at, 'El estilo de texto debe ser un objeto.'); continue; }
            if (!isStr(style.familia)) err(`${at}.familia`, 'Falta la familia de la fuente.');
            for (const key of ['peso', 'tamano', 'interlineado']) if (!isNum(style[key]) || style[key] <= 0) err(`${at}.${key}`, `"${key}" debe ser un número mayor que 0.`);
            const gap = style.espaciado;
            if (!isObj(gap) || !isNum(gap.valor) || !UNIDADES.includes(gap.unidad)) {
                err(`${at}.espaciado`, 'El espaciado entre letras lleva su unidad: { "valor": 4, "unidad": "%" } o "px" (4 no es lo mismo que 0.72px).');
            }
        }
        for (const [name, value] of Object.entries(isObj(tokens.sombras) ? tokens.sombras : {})) {
            if (!isStr(value)) err(`tokens.sombras.${name}`, 'La sombra debe ser un texto.');
        }
    }

    const checkFile = (at, value) => {
        if (!isStr(value)) return err(at, 'Falta la ruta del archivo.');
        if (/^[a-z]+:\/\//i.test(value) || isAbsolute(value) || normalize(value).split(/[\\/]/).includes('..')) {
            return err(at, `La ruta "${value}" debe ser relativa a specs/figma/lectura/ y no salir de esa carpeta.`);
        }
        const full = join(dir ?? '.', value);
        if (!existsSync(full) || !statSync(full).isFile()) return err(at, `No existe el archivo "${value}" en specs/figma/lectura/.`);
        if (statSync(full).size === 0) err(at, `El archivo "${value}" está vacío.`);
    };

    const sections = Array.isArray(data.secciones) ? data.secciones : null;
    if (!sections) err('secciones', 'Falta "secciones" (una lista).');
    const names = new Set();
    const nodes = new Set();
    (sections ?? []).forEach((s, i) => {
        const at = `secciones[${i}]`;
        if (!isObj(s)) return err(at, 'La sección debe ser un objeto.');
        if (!SLUG.test(s.nombre ?? '')) err(`${at}.nombre`, `Nombre de sección inválido ${JSON.stringify(s.nombre)}: minúsculas, números y guiones.`);
        else if (names.has(s.nombre)) err(`${at}.nombre`, `La sección "${s.nombre}" está repetida.`);
        names.add(s.nombre);
        const label = `secciones[${s.nombre ?? i}]`;
        if (!NODE_ID.test(s.nodeId ?? '')) err(`${label}.nodeId`, 'El nodeId debe verse como "3638:2098" (con ":").');
        else if (nodes.has(s.nodeId)) err(`${label}.nodeId`, `El nodeId ${s.nodeId} está repetido.`);
        nodes.add(s.nodeId);
        if (s.estado === 'pendiente') {
            counts.pending++;
            return;
        }
        if (s.estado !== 'leida') return err(`${label}.estado`, '"estado" debe ser "leida" o "pendiente".');
        counts.read++;

        if (!isStr(s.nombreCapa)) err(`${label}.nombreCapa`, 'Falta "nombreCapa" (el nombre de la capa en Figma; solo es una pista).');
        if (!FECHA.test(s.leidoEn ?? '')) err(`${label}.leidoEn`, '"leidoEn" debe ser una fecha AAAA-MM-DD.');
        if (!isObj(s.tamano) || !isNum(s.tamano.ancho) || !isNum(s.tamano.alto)) err(`${label}.tamano`, 'Falta "tamano" ({ ancho, alto }).');
        checkFile(`${label}.referencia`, s.referencia);
        checkFile(`${label}.captura`, s.captura);

        const list = (key) => {
            if (!Array.isArray(s[key])) {
                err(`${label}.${key}`, `Falta "${key}" (una lista; puede ir vacía).`);
                return [];
            }
            return s[key];
        };

        list('textos').forEach((t, n) => {
            const where = `${label}.textos[${n}]`;
            if (!isObj(t)) return err(where, 'El texto debe ser un objeto.');
            if (!NODE_ID_ANY.test(t.nodeId ?? '')) err(`${where}.nodeId`, 'nodeId inválido (se espera "3638:2107" o, dentro de una instancia, "I3704:18079;3704:22279").');
            if (typeof t.texto !== 'string' || t.texto === '') err(`${where}.texto`, 'Falta el texto.');
            if (!ROLES_TEXTO.includes(t.rol)) err(`${where}.rol`, `"rol" debe ser uno de: ${ROLES_TEXTO.join(', ')}.`);
            for (const [key, set] of [['estilo', tokenNames.texto], ['color', tokenNames.colores]]) {
                if (t[key] === null) continue;
                if (!isStr(t[key])) err(`${where}.${key}`, `"${key}" es el nombre de un token o null (valor suelto).`);
                else if (isObj(tokens) && !set.has(t[key])) warn(`${where}.${key}`, `"${t[key]}" no está en los tokens de la página.`);
            }
        });

        const sueltos = s.sueltos;
        if (!isObj(sueltos)) err(`${label}.sueltos`, 'Falta "sueltos" ({ espacios, colores, radios }).');
        else {
            for (const key of ['espacios', 'colores', 'radios']) {
                if (!Array.isArray(sueltos[key])) { err(`${label}.sueltos.${key}`, `Falta "sueltos.${key}" (una lista; puede ir vacía).`); continue; }
                sueltos[key].forEach((item, n) => {
                    const where = `${label}.sueltos.${key}[${n}]`;
                    if (!isObj(item) || !Number.isInteger(item.usos) || item.usos < 1) return err(where, 'Cada valor suelto lleva "valor" y "usos" (entero ≥ 1).');
                    if (key === 'colores' ? !HEX.test(item.valor ?? '') : !isNum(item.valor)) err(`${where}.valor`, key === 'colores' ? 'El color suelto debe ser hexadecimal.' : 'El valor debe ser un número.');
                });
            }
        }

        const ids = new Set();
        list('imagenes').forEach((img, n) => {
            const where = `${label}.imagenes[${n}]`;
            if (!isObj(img)) return err(where, 'La imagen debe ser un objeto.');
            if (!SLUG.test(img.id ?? '')) err(`${where}.id`, 'El id de la imagen es un slug (minúsculas y guiones).');
            else if (ids.has(img.id)) err(`${where}.id`, `El id "${img.id}" está repetido en la sección.`);
            ids.add(img.id);
            if (!NODE_ID_ANY.test(img.nodeId ?? '')) err(`${where}.nodeId`, 'nodeId inválido (se espera "3638:2121" o, dentro de una instancia, "I3704:18079;3704:22279").');
            if (!TIPOS_IMAGEN.includes(img.tipo)) err(`${where}.tipo`, `"tipo" debe ser uno de: ${TIPOS_IMAGEN.join(', ')} (el formato real descargado; aquí no se convierte: pasarlas a webp lo hace la skill img-webp, si el usuario la quiere).`);
            for (const key of ['ancho', 'alto']) if (!isNum(img[key]) || img[key] <= 0) err(`${where}.${key}`, `"${key}" debe ser un número mayor que 0.`);
            if (!ROLES_IMAGEN.includes(img.rol)) err(`${where}.rol`, '"rol" debe ser "contenido" o "decorativa".');
            checkFile(`${where}.archivo`, img.archivo);
            if (isStr(img.archivo) && TIPOS_IMAGEN.includes(img.tipo)) {
                const ext = img.archivo.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
                if (ext !== img.tipo) err(`${where}.archivo`, `La extensión ".${ext}" no coincide con el tipo "${img.tipo}".`);
                const full = join(dir ?? '.', img.archivo);
                if (existsSync(full) && statSync(full).isFile() && statSync(full).size > 0) {
                    const real = formatoReal(full);
                    if (real === null) err(`${where}.archivo`, `"${img.archivo}" no parece una imagen (png, jpg, gif, webp o svg).`);
                    else if (real !== img.tipo) err(`${where}.tipo`, `"${img.archivo}" es realmente un ${real.toUpperCase()}, no un ${img.tipo.toUpperCase()}: pon tipo "${real}" y la extensión ".${real}" (Figma puede servir otro formato bajo un link que termina distinto).`);
                }
            }
        });

        list('componentes').forEach((c, n) => {
            const where = `${label}.componentes[${n}]`;
            if (!isObj(c) || !isStr(c.nombre)) return err(where, 'Cada componente lleva "nombre".');
            if (c.variante !== null && c.variante !== undefined && !isStr(c.variante)) err(`${where}.variante`, '"variante" es un texto o null.');
            if (!isObj(c.props)) err(`${where}.props`, 'Falta "props" (un objeto; puede ir vacío).');
        });

        list('senales').forEach((sig, n) => {
            const where = `${label}.senales[${n}]`;
            if (!isObj(sig)) return err(where, 'La señal debe ser un objeto.');
            if (!TIPOS_SENAL.includes(sig.tipo)) err(`${where}.tipo`, `"tipo" debe ser uno de: ${TIPOS_SENAL.join(', ')}.`);
            if (!isStr(sig.evidencia)) err(`${where}.evidencia`, 'Falta la evidencia (qué se vio en el diseño).');
            if (!ESTADOS_SENAL.includes(sig.estado)) err(`${where}.estado`, '"estado" debe ser "propuesto" (deducido) o "confirmado" (el usuario lo aprobó).');
        });
    });

    // Contra los links de enlaces/: si el link cambió, la lectura quedó vieja.
    if (enlaces) {
        if (enlaces.frame && isObj(fuente) && (enlaces.frame.fileKey !== fuente.fileKey || enlaces.frame.nodeId !== fuente.nodeId)) {
            err('fuente', 'El frame de la página en enlaces/ ya no es el que se leyó: vuelve a leer la página.');
        }
        const byName = new Map((sections ?? []).filter(isObj).map((s) => [s.nombre, s]));
        for (const wanted of enlaces.sections.filter((s) => !s.pending)) {
            const found = byName.get(wanted.name);
            if (!found) warn(`secciones[${wanted.name}]`, `La sección "${wanted.name}" está en enlaces/ pero todavía no se lee.`);
            else if (found.nodeId !== wanted.nodeId) err(`secciones[${wanted.name}].nodeId`, `El link de "${wanted.name}" cambió en enlaces/ (${wanted.nodeId}) y la lectura es de ${found.nodeId}: vuelve a leerla.`);
        }
        if (enlaces.sections.length) {
            const listed = new Set(enlaces.sections.map((s) => s.name));
            for (const name of byName.keys()) if (!listed.has(name)) warn(`secciones[${name}]`, `La sección "${name}" ya no está en enlaces/.`);
        }
    }

    return { errors, warnings, counts };
}
