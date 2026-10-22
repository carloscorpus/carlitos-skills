// GENERADO desde shared/specs.mjs por scripts/sync-shared.mjs. No editar aquí:
// edita el original y corre `node scripts/sync-shared.mjs`.

// Lector de los specs de design-import (specs/_index.md, _shared.md y una página por archivo).
// Sin dependencias. Lo usan design-import (check.mjs), wp-acf (generate.mjs, check.mjs) y wp-query.
//
// ORIGINAL: shared/specs.mjs. Cada skill lleva su copia en skills/<skill>/scripts/lib/specs.mjs.
// Edita solo este archivo y corre `node scripts/sync-shared.mjs`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
export const labels = (text) => Object.fromEntries([...text.matchAll(/^- \*\*(.+?):\*\*[ \t]*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
export const unwrap = (value) => value.replace(/^`+|`+$/g, '').trim();
export const normalizeText = (value) => value.replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
export const noAccent = (value) => value.toLowerCase().replace('estatica', 'estática').replace('catalogo', 'catálogo');

// Filas de una tabla Markdown, sin la cabecera ni la línea de guiones.
export function parseTable(block) {
    const rows = [];
    for (const line of block.split('\n')) {
        if (!line.trim().startsWith('|')) continue;
        const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim());
        if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
        rows.push(cells);
    }
    return rows.slice(1);
}

// Cuerpo de un "## Título" de _shared.md (sin la línea del título).
export const chunk = (text, heading) => text.split(/^## /m).find((part) => part.startsWith(heading))?.split('\n').slice(1).join('\n');

// Filas de _index.md: { title, file, template, state }.
export function parseIndex(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        const m = /^\|\s*(.+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|\s*(\S+)\s*\|$/.exec(line);
        if (m) rows.push({ title: m[1], file: m[3], template: unwrap(m[4]), state: m[5] });
    }
    return rows;
}

// Tabla "Contenido dinámico" de _shared.md. Las taxonomías salen del texto de la celda:
// "`categoria_producto` (jerárquica: Sillas, Mesas); `marca`" -> [{ key, hierarchical, terms, native }].
export function parseDynamicContent(sharedText) {
    const NATIVE = new Set(['category', 'post_tag']);
    return parseTable(chunk(sharedText, 'Contenido dinámico') ?? '').map((cells) => {
        const [name, origin, taxonomies, fields, filters, templates, action] = cells.map((cell) => unwrap(cell ?? ''));
        const found = [];
        for (const m of (cells[2] ?? '').matchAll(/`([a-z][a-z0-9_-]*)`([^`;]*)/g)) {
            const detail = m[2];
            const terms = /:\s*([^)]*)\)?/.exec(detail)?.[1]?.split(',').map((t) => t.trim().replace(/\.$/, '')).filter(Boolean) ?? [];
            found.push({
                key: m[1],
                hierarchical: /jer[aá]rquica/i.test(detail) && !/no jer[aá]rquica/i.test(detail),
                terms,
                native: NATIVE.has(m[1]),
            });
        }
        return { name, origin, taxonomies: found, taxonomiesText: taxonomies, fields, filters, templates, action };
    });
}

// Tabla "Menús" dentro de "## Sitio": { location, where, links }.
export function parseMenus(sharedText) {
    return parseTable(chunk(sharedText, 'Sitio') ?? '').map((cells) => {
        const [location, where, links] = cells.map((cell) => unwrap(cell ?? ''));
        return { location, where, links };
    });
}

// ---------- Filtros de un listado ----------

export const FILTER_TYPES = ['taxonomía', 'rango', 'opciones', 'búsqueda', 'orden', 'fecha'];
export const ORDER_KEYWORDS = ['reciente', 'antiguo', 'az', 'za', 'relevancia'];
const fold = (value) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Tabla "**Filtros**" del resumen de un listado (antes de la primera sección). null si no hay tabla.
// Cada fila: { name, type, source, fields, orders, multiple, count, view }, con los valores normalizados:
// type uno de FILTER_TYPES, multiple 'no' | 'o' | 'y', count 'ninguno' | 'fijo' | 'dinámico'. Un valor que no
// se reconoce queda como vino (y null en multiple) para que check.mjs lo informe.
export function parseFilters(header) {
    const lines = header.split('\n');
    const start = lines.findIndex((line) => line.trim() === '**Filtros**');
    if (start === -1) return null;
    const table = [];
    for (const line of lines.slice(start + 1)) {
        if (line.trim().startsWith('|')) table.push(line);
        else if (table.length || line.trim()) break;
    }
    return parseTable(table.join('\n')).map((cells) => {
        const [rawName, rawType, rawSource, rawMultiple, rawCount, rawView] = cells.map((cell) => cell ?? '');
        const type = FILTER_TYPES.find((t) => fold(t) === fold(unwrap(rawType))) ?? unwrap(rawType);
        const multiple = fold(rawMultiple);
        const count = fold(rawCount);
        const orders = type !== 'orden' ? [] : rawSource.split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
            const field = /^`([^`]+)`\s*(asc|desc)?$/i.exec(part);
            return field ? { key: `${field[1]}:${(field[2] ?? 'asc').toLowerCase()}`, field: field[1], dir: (field[2] ?? 'asc').toLowerCase() } : { key: fold(unwrap(part)) };
        });
        return {
            name: unwrap(rawName),
            type,
            source: unwrap(rawSource),
            fields: [...rawSource.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
            orders,
            multiple: ['', '—', '-', 'no'].includes(multiple) ? 'no' : /^si\s*\(\s*o\s*\)$/.test(multiple) ? 'o' : /^si\s*\(\s*y\s*\)$/.test(multiple) ? 'y' : null,
            count: ['', '—', '-', 'ninguno'].includes(count) ? 'ninguno' : count === 'fijo' ? 'fijo' : count === 'dinamico' ? 'dinámico' : unwrap(rawCount),
            view: unwrap(rawView),
        };
    });
}

// Una página: { file, slug, prefix, labels, filters, sections }. Cada sección: { name, labels, group, state, fields }.
// Cada campo: { name, type, description, current, required }. `filters`: parseFilters del resumen (null sin tabla).
export function parsePage(text, file) {
    const slug = file.replace(/\.md$/, '');
    const [header, ...blocks] = text.split(/^## Sección: /m);
    const sections = blocks.map((block) => {
        const data = labels(block);
        const fieldsBlock = /\*\*Campos ACF\*\*([\s\S]*?)(?=\n\*\*Criterios de aceptación\*\*|$)/.exec(block)?.[1] ?? '';
        const fields = parseTable(fieldsBlock).map((cells) => ({
            name: unwrap(cells[0] ?? ''),
            type: unwrap(cells[1] ?? ''),
            description: normalizeText(cells[2] ?? ''),
            current: normalizeText(unwrap(cells[3] ?? '')),
            required: ['sí', 'si'].includes((cells[4] ?? '').toLowerCase()),
        }));
        return {
            name: block.split('\n')[0].trim(),
            labels: data,
            group: unwrap(data.Grupo ?? ''),
            state: data.Estado ?? '',
            fields,
        };
    });
    return { file, slug, prefix: `${slug.replaceAll('-', '_')}_`, labels: labels(header), filters: parseFilters(header), sections };
}

// ---------- Plantillas PHP ----------

// Textos fijos de una plantilla PHP: lo que queda entre etiquetas sin los bloques PHP.
export function phpTexts(path) {
    return read(path)
        .replace(/<\?(?:php|=)[\s\S]*?\?>/g, ' ')
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]*>/g, '\n')
        .split('\n')
        .map((line) => line.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 1);
}

// Textos entre comillas dentro de los bloques PHP: la plantilla puede guardar el texto fijo en una
// variable o arreglo al inicio ($titulo = '...'). Se quitan los marcadores de resaltado (| y *).
export function phpLiterals(path) {
    const literals = [];
    // Atributos con texto del diseño: el alt de una imagen, un title, un aria-label.
    for (const [, , value] of read(path).matchAll(/\b(alt|title|aria-label|placeholder)="([^"<>]*)"/g)) {
        const text = value.replace(/\s+/g, ' ').trim();
        if (text.length > 1) literals.push(text);
    }
    for (const [block] of read(path).matchAll(/<\?(?:php|=)[\s\S]*?(?:\?>|$)/g)) {
        for (const [, single, double] of block.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
            const text = (single ?? double).replace(/\\(['"\\])/g, '$1').replace(/[|*]/g, '').replace(/\s+/g, ' ').trim();
            if (text.length > 1) literals.push(text);
        }
    }
    return literals;
}

// ---------- Todo el directorio de specs ----------

// Lee _index.md, _shared.md y las páginas. `states` y `wanted` (listas) filtran `pages`; `all` trae todas
// las páginas registradas en _index.md.
export function loadSpecs(specsDir, { states = null, wanted = null } = {}) {
    const index = parseIndex(read(join(specsDir, '_index.md')));
    const dynamic = parseDynamicContent(read(join(specsDir, '_shared.md')));
    const files = readdirSync(specsDir).filter((name) => name.endsWith('.md') && !name.startsWith('_'));
    const all = files
        .map((name) => parsePage(read(join(specsDir, name)), name))
        .filter((page) => index.some((row) => row.file === page.file));
    const pages = all
        .filter((page) => (wanted ? wanted.includes(page.slug) : true))
        .filter((page) => (states ? states.includes(page.labels.Estado) : true));
    return { index, dynamic, files, all, pages };
}

export const hasSpecs = (specsDir) => existsSync(join(specsDir, '_index.md')) && existsSync(join(specsDir, '_shared.md'));
