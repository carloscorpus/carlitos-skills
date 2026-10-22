// Construye la definición de cada listado (inc/query/<contenido>.php) a partir de los specs de design-import.
// Funciones puras, sin dependencias: las usan generate.mjs (escribe) y status.mjs (compara). Nada aquí lee ni
// escribe archivos.

import { fieldChoices, noAccent, unwrap } from './specs.mjs';

const TYPE_KEY = { taxonomía: 'taxonomia', rango: 'rango', opciones: 'opciones', fecha: 'fecha', búsqueda: 'busqueda', orden: 'orden' };
const RANGE_TYPES = ['number', 'range'];
const OPTION_TYPES = ['select', 'checkbox', 'radio', 'button_group', 'true_false'];
const DATE_TYPES = ['date_picker', 'date_time_picker'];
const ORDER_PRESETS = {
    reciente: { orderby: 'date', order: 'DESC' },
    antiguo: { orderby: 'date', order: 'ASC' },
    az: { orderby: 'title', order: 'ASC' },
    za: { orderby: 'title', order: 'DESC' },
    relevancia: { orderby: 'relevance', order: 'DESC' },
};
const PAGINATION = { números: 'numeros', numeros: 'numeros', 'cargar más': 'cargar_mas', 'cargar mas': 'cargar_mas', infinito: 'infinito', ninguna: 'ninguna' };
const ON_FILTER = { 'sin recargar': 'auto', 'botón aplicar': 'boton', 'boton aplicar': 'boton' };

const pageType = (page) => noAccent(unwrap(page.labels.Tipo ?? ''));
const contentOf = (page) => unwrap(page.labels.Contenido ?? '');
const firstSentence = (text) => text.split(/\.\s|\.$/)[0].trim();

// Campos del spec de detalle de un contenido: nombre -> { type, description, short }. `short` es el nombre sin el
// grupo de su sección (producto_ficha_precio -> precio): lo que se ve en la URL de un orden por campo.
function detailFields(all, content) {
    const fields = new Map();
    const detail = all.find((page) => pageType(page) === 'detalle' && contentOf(page) === content);
    for (const section of detail?.sections ?? []) {
        for (const field of section.fields) {
            const short = section.group && field.name.startsWith(`${section.group}_`) ? field.name.slice(section.group.length + 1) : field.name;
            fields.set(field.name, { ...field, short });
        }
    }
    return { detail, fields };
}

// Un listado -> { contenido, listado, rel, def } o errores. `all` son todas las páginas (para hallar el detalle).
function buildListing(page, { all, dynamic }) {
    const errors = [];
    const err = (message) => errors.push({ file: page.file, message });
    const content = contentOf(page);
    const row = dynamic.find((r) => r.name === content);
    if (!row) return { errors: [{ file: page.file, message: `Contenido "${content}": no está en la tabla "Contenido dinámico" de _shared.md.` }] };
    if (row.origin === 'woo') return { errors: [{ file: page.file, message: `Contenido "${content}" es de WooCommerce: wp-query no lo conecta (es otra skill).` }] };
    if (!page.filters) err('Falta la tabla "Filtros" (design-import 1.6.0): complétala antes de generar.');

    const { fields } = detailFields(all, content);
    const fieldOf = (name, allowed, kind) => {
        const field = fields.get(name);
        if (!field) {
            err(`Filtro ${kind}: el campo "${name}" no está en el spec de detalle de ${content}.`);
            return null;
        }
        if (!allowed.includes(field.type)) {
            err(`Filtro ${kind}: el campo "${name}" es ${field.type} y este filtro necesita ${allowed.join(', ')}.`);
            return null;
        }
        return field;
    };

    const filters = {};
    for (const filter of page.filters ?? []) {
        const tipo = TYPE_KEY[filter.type];
        const where = `"${filter.name}"`;
        if (!tipo) {
            err(`Filtro ${where}: tipo "${filter.type}" desconocido.`);
            continue;
        }
        const base = { tipo, vista: filter.view };
        if (tipo === 'taxonomia') {
            const taxonomy = filter.fields[0] ?? filter.source;
            const known = row.taxonomies.some((t) => t.key === taxonomy) || (row.origin === 'post' && ['category', 'post_tag'].includes(taxonomy));
            if (!known) err(`Filtro ${where}: la taxonomía "${taxonomy}" no es de ${content}.`);
            filters[filter.name] = { ...base, fuente: taxonomy, etiqueta: '', varios: filter.multiple ?? 'no', conteo: countKey(filter.count) };
        } else if (tipo === 'rango') {
            const field = fieldOf(filter.fields[0] ?? filter.source, RANGE_TYPES, where);
            if (field) filters[filter.name] = { ...base, fuente: field.name, etiqueta: firstSentence(field.description) };
        } else if (tipo === 'opciones') {
            const field = fieldOf(filter.fields[0] ?? filter.source, OPTION_TYPES, where);
            if (!field) continue;
            const choices = field.type === 'true_false' ? { 1: firstSentence(field.description) } : fieldChoices(field.description);
            if (!choices) {
                err(`Filtro ${where}: el campo "${field.name}" no trae "Opciones: a, b, c" en su descripción.`);
                continue;
            }
            filters[filter.name] = {
                ...base,
                fuente: field.name,
                acf: field.type,
                etiqueta: firstSentence(field.description),
                varios: field.type === 'true_false' ? 'no' : filter.multiple ?? 'no',
                conteo: countKey(filter.count),
                opciones: choices,
            };
        } else if (tipo === 'fecha') {
            const source = filter.fields[0] ?? filter.source;
            if (source === 'post_date') {
                filters[filter.name] = { ...base, fuente: 'post_date', etiqueta: '' };
            } else {
                const field = fieldOf(source, DATE_TYPES, where);
                if (field) filters[filter.name] = { ...base, fuente: field.name, acf: field.type, etiqueta: firstSentence(field.description) };
            }
        } else if (tipo === 'busqueda') {
            filters[filter.name] = { ...base, etiqueta: '' };
        } else {
            const options = {};
            for (const order of filter.orders) {
                if (order.field) {
                    const field = fields.get(order.field);
                    if (!field) {
                        err(`Filtro ${where}: el campo de orden "${order.field}" no está en el spec de detalle de ${content}.`);
                        continue;
                    }
                    const numeric = RANGE_TYPES.includes(field.type);
                    options[`${field.short.replaceAll('_', '-')}-${order.dir}`] = {
                        orderby: numeric ? 'meta_value_num' : 'meta_value',
                        order: order.dir.toUpperCase(),
                        campo: field.name,
                    };
                } else if (ORDER_PRESETS[order.key]) {
                    options[order.key] = { ...ORDER_PRESETS[order.key] };
                } else {
                    err(`Filtro ${where}: orden "${order.key}" desconocido (${Object.keys(ORDER_PRESETS).join(', ')} o \`campo\` asc/desc).`);
                }
            }
            filters[filter.name] = { ...base, etiqueta: '', opciones: options };
        }
    }

    const perPage = Number.parseInt(unwrap(page.labels['Por página'] ?? '12'), 10);
    const pagination = PAGINATION[noAccent(unwrap(page.labels.Paginación ?? 'números')).toLowerCase()];
    const onFilter = ON_FILTER[unwrap(page.labels['Al filtrar'] ?? 'sin recargar').toLowerCase()];
    if (!(perPage > 0)) err('"Por página" debe ser un número mayor que 0.');
    if (!pagination) err(`Paginación "${page.labels.Paginación}" desconocida.`);
    if (!onFilter) err(`Al filtrar "${page.labels['Al filtrar']}" desconocido.`);
    if (errors.length) return { errors };

    const taxonomies = row.taxonomies.map((t) => t.key);
    return {
        errors,
        listing: {
            contenido: content,
            listado: page.slug,
            rel: `inc/query/${content}.php`,
            def: {
                contenido: content,
                listado: page.slug,
                post_type: row.origin === 'post' ? 'post' : content,
                taxonomias: taxonomies,
                por_pagina: perPage,
                paginacion: pagination,
                al_filtrar: onFilter,
                movil: unwrap(page.labels['Filtros en móvil'] ?? 'igual') === 'panel' ? 'panel' : 'igual',
                relacionadas: taxonomies[0] ?? '',
                filtros: filters,
            },
        },
    };
}

const countKey = (count) => (count === 'dinámico' ? 'dinamico' : count === 'fijo' ? 'fijo' : 'ninguno');

// Todas las definiciones de los listados de `pages`. Devuelve { listings, errors }.
export function buildDefinitions({ pages, all, dynamic }) {
    const listings = [];
    const errors = [];
    for (const page of pages.filter((p) => pageType(p) === 'listado')) {
        const result = buildListing(page, { all, dynamic });
        errors.push(...result.errors);
        if (!result.listing) continue;
        const twin = listings.find((l) => l.contenido === result.listing.contenido);
        if (twin) errors.push({ file: page.file, message: `Dos listados para el contenido "${twin.contenido}" (${twin.listado} y ${page.slug}): deja uno.` });
        else listings.push(result.listing);
    }
    return { listings, errors };
}

// ---------- PHP ----------

const phpString = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const phpKey = (key) => (/^(0|[1-9]\d*)$/.test(key) ? key : phpString(key));

function phpValue(value, indent) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return phpString(value);
    const pad = '    '.repeat(indent + 1);
    const close = '    '.repeat(indent);
    if (Array.isArray(value)) {
        if (!value.length) return '[]';
        return `[\n${value.map((item) => `${pad}${phpValue(item, indent + 1)},`).join('\n')}\n${close}]`;
    }
    const entries = Object.entries(value);
    if (!entries.length) return '[]';
    return `[\n${entries.map(([key, item]) => `${pad}${phpKey(key)} => ${phpValue(item, indent + 1)},`).join('\n')}\n${close}]`;
}

// Contenido del archivo inc/query/<contenido>.php de un listado.
export function definitionPhp(listing) {
    return [
        '<?php',
        "defined('ABSPATH') || exit;",
        '',
        '/*',
        ` * Listado "${listing.listado}" (contenido ${listing.contenido}). Lo genera wp-query (generate.mjs) desde`,
        ` * specs/${listing.listado}.md, su spec de detalle y _shared.md: no se edita a mano. Cambia el spec y vuelve a generar.`,
        ' */',
        `return ${phpValue(listing.def, 0)};`,
        '',
    ].join('\n');
}
