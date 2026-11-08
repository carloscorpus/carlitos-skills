#!/usr/bin/env node
// Valida los specs de design-import y su coherencia con el tema. Sin dependencias.
//
// Uso:
//   node check.mjs [--target <dir>] [--specs specs]
//
// Revisa: _index.md (filas, estados, archivos), _shared.md (estado), cada página (resumen y partes
// por sección, con su grupo ACF), la tabla de contenido dinámico de _shared.md, nombres de campo (<página>_<sección>_<campo>, snake_case, únicos), tipos y
// descripciones. Con estado `aplicado` además comprueba que el destino exista, que cada "valor actual"
// de texto esté en el PHP y avisa de textos fijos del PHP que no están en el spec.
//
// Sale con JSON en stdout. Códigos: 0 ok (puede haber avisos), 1 error de uso, 4 hay errores en los specs.

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEnlaces } from './figma/enlaces.mjs';
import { fail } from './lib/common.mjs';
import {
    FILTER_TYPES, ORDER_KEYWORDS, WOO_MODES, WOO_PIECES, labels, lineSplits, noAccent, normalizeText, parseDynamicContent, parseFilters, parseTable, parseWoo, phpLiterals, phpTexts, read, unwrap,
} from './lib/specs.mjs';

let args;
try {
    ({ values: args } = parseArgs({
        options: { target: { type: 'string', default: process.cwd() }, specs: { type: 'string', default: 'specs' } },
    }));
} catch (e) {
    fail(1, e.message);
}

const target = resolve(args.target);
const specsDir = join(target, args.specs);
if (!existsSync(specsDir)) fail(1, `No existe ${args.specs}/: corre primero init.mjs.`);

const STATES = ['pendiente', 'aprobado', 'descartado', 'aplicado'];
const ACF_STATES = ['pendiente', 'conectado'];
const PAGE_LABELS = ['Resumen', 'Fuente', 'Plantilla', 'Secciones (en orden)', 'Skills usadas', 'Notas de página', 'Estado'];
const PAGE_TYPES = ['estática', 'listado', 'detalle', 'global'];
const ORIGINS = ['post', 'cpt', 'woo'];
const SCOPES = ['estática', 'blog', 'catálogo', 'woocommerce', 'otro'];
const SECTION_LABELS = ['Origen', 'Destino', 'Skill', 'Comportamiento', 'Estado'];
const FIELD_TYPES = new Set([
    'text', 'textarea', 'wysiwyg', 'number', 'range', 'email', 'url', 'password', 'image', 'file', 'gallery', 'oembed',
    'select', 'checkbox', 'radio', 'button_group', 'true_false', 'link', 'post_object', 'page_link', 'relationship',
    'taxonomy', 'user', 'google_map', 'date_picker', 'date_time_picker', 'time_picker', 'color_picker',
    'message', 'accordion', 'tab', 'group', 'repeater', 'flexible_content', 'clone',
]);
const TEXT_TYPES = new Set(['text', 'textarea', 'wysiwyg']);
const FIELD_NAME = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*)*$/;
// Filtros de un listado: tipos de campo ACF que acepta cada tipo de filtro y variables públicas de WordPress
// que un filtro no puede usar como nombre (la búsqueda va en `q`, no en `s`).
const FILTER_FIELD_TYPES = {
    rango: ['number', 'range'],
    opciones: ['select', 'checkbox', 'radio', 'button_group', 'true_false'],
    fecha: ['date_picker', 'date_time_picker'],
    orden: ['number', 'range', 'text', 'date_picker', 'date_time_picker'],
};
const WP_QUERY_VARS = new Set([
    'm', 'p', 'posts', 'w', 'cat', 'withcomments', 'withoutcomments', 's', 'search', 'exact', 'sentence', 'calendar',
    'page', 'paged', 'more', 'tb', 'pb', 'author', 'order', 'orderby', 'year', 'monthnum', 'day', 'hour', 'minute',
    'second', 'name', 'category_name', 'tag', 'feed', 'author_name', 'pagename', 'page_id', 'error', 'attachment',
    'attachment_id', 'subpost', 'subpost_id', 'preview', 'robots', 'favicon', 'taxonomy', 'term', 'cpage', 'post_type',
    'embed', 'post_format', 'rest_route', 'sitemap', 'static', 'category', 'post_tag', 'type',
]);
const LIST_LABELS = {
    'Al filtrar': ['sin recargar', 'botón aplicar'],
    Paginación: ['números', 'cargar más', 'infinito', 'ninguna'],
    'Filtros en móvil': ['igual', 'panel'],
};

// Campos que duplican algo que WordPress o WooCommerce ya guarda y edita (ver "Native first" en
// references/campos-acf.md). Se compara el nombre corto del campo (sin <página>_<sección>_). Solo avisa.
const NATIVE_ENTRY = {
    titulo: 'el título', nombre: 'el título', contenido: 'el contenido', imagen_destacada: 'la imagen destacada',
    imagen_principal: 'la imagen destacada', miniatura: 'la imagen destacada',
};
const NATIVE_POST = { extracto: 'el extracto', resumen: 'el extracto', fecha: 'la fecha', autor: 'el autor' };
const NATIVE_WOO = {
    precio: 'el precio', precio_oferta: 'el precio', stock: 'el stock', sku: 'el SKU', agregar_carrito: 'el botón de compra',
    boton_comprar: 'el botón de compra', descripcion_corta: 'la descripción corta',
};
const NATIVE_SITE = {
    logo: 'el logo principal', logo_principal: 'el logo principal', favicon: 'el ícono del sitio', icono_sitio: 'el ícono del sitio',
    nombre_sitio: 'el nombre del sitio', titulo_sitio: 'el nombre del sitio',
};
// Devuelve el aviso de un campo que parece duplicar algo nativo, o null. `short` es el nombre sin prefijo.
function nativeDuplicate(short, { pageType, origin, page }) {
    if (pageType === 'detalle') {
        if (origin === 'woo' && NATIVE_WOO[short]) return `${NATIVE_WOO[short]} lo entrega WooCommerce: no es un campo ("Native first" en campos-acf.md).`;
        const text = NATIVE_ENTRY[short] ?? (origin === 'post' ? NATIVE_POST[short] : undefined);
        if (text) return `${text} del contenido es nativo de WordPress: no es un campo. Si es otra cosa, dale un nombre que lo diga ("Native first" en campos-acf.md).`;
    }
    if (page === 'opciones') {
        if (NATIVE_SITE[short]) return `${NATIVE_SITE[short]} sale de Identidad del sitio (Personalizador): no es un campo. Si es el logo alternativo, llámalo logo_alternativo ("Native first" en campos-acf.md).`;
        if (/^menus?(_|$)/.test(short)) return 'los menús son nativos de WordPress (Apariencia > Menús): van en la tabla "Menús" de _shared.md, no en un campo.';
    }
    return null;
}

const errors = [];
const warnings = [];
const error = (file, message) => errors.push({ file, message });
const warn = (file, message) => warnings.push({ file, message });


// ---------- _shared.md ----------

let sharedState = null;
const dynamicRows = new Map(); // contenido -> fila completa (taxonomías, filtros)
let wooInfo = null; // sección "WooCommerce" de _shared.md (parseWoo), o null
const dynamicContent = new Map(); // contenido -> origen
const commonCriteria = new Set(); // criterios de "Criterios comunes" de _shared.md
let anyApplied = false; // alguna página ya está aplicada en el tema
const sharedComponents = []; // { name, destino, args } de "Componentes compartidos" de _shared.md
// Nombres de "Argumentos": los que van entre comillas invertidas, o el primer nombre de cada parte separada por coma.
const argNames = (text) => {
    const quoted = [...text.matchAll(/`\$?(?:args\[['"])?([a-z_][a-z0-9_]*)(?:['"]\])?`/gi)].map((m) => m[1]);
    if (quoted.length) return [...new Set(quoted)];
    return [...new Set(text.replace(/\([^)]*\)/g, '').split(/[,;]/).map((part) => part.trim().match(/^\$?([a-z_][a-z0-9_]*)/i)?.[1]).filter(Boolean))].filter((n) => !['ninguno', 'ninguna'].includes(n.toLowerCase()));
};
const sharedPath = join(specsDir, '_shared.md');
if (!existsSync(sharedPath)) error('_shared.md', 'Falta _shared.md.');
else {
    const sharedText = read(sharedPath);
    for (const row of parseDynamicContent(sharedText)) dynamicRows.set(row.name, row);
    sharedState = labels(sharedText).Estado ?? null;
    if (!['pendiente', 'aprobado', 'aplicado'].includes(sharedState)) {
        error('_shared.md', `Estado inválido "${sharedState}" (pendiente, aprobado o aplicado).`);
    }
    const chunk = (heading) => sharedText.split(/^## /m).find((part) => part.startsWith(heading))?.split('\n').slice(1).join('\n');

    for (const cells of parseTable(chunk('Contenido dinámico') ?? '')) {
        const [rawName, origin, , , filters, templates, action] = cells.map((cell) => unwrap(cell ?? ''));
        const where = `Contenido dinámico › ${rawName || '(sin nombre)'}`;
        if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(rawName)) error('_shared.md', `${where}: el nombre va en snake_case, sin tildes.`);
        else if (dynamicContent.has(rawName)) error('_shared.md', `${where}: contenido repetido.`);
        else dynamicContent.set(rawName, origin);
        if (!ORIGINS.includes(origin)) error('_shared.md', `${where}: Origen "${origin}" debe ser post, cpt o woo.`);
        for (const [label, value] of [['Filtros', filters], ['Plantillas', templates], ['Acción', action]]) {
            if (!value) error('_shared.md', `${where}: falta "${label}" (usa "ninguno" si no aplica).`);
        }
    }
    const locations = new Set();
    for (const cells of parseTable(chunk('Sitio') ?? '')) {
        const [location, where, links] = cells.map((cell) => unwrap(cell ?? ''));
        if (!/^[a-z][a-z0-9_-]*$/.test(location)) error('_shared.md', `Menús › "${location}": la ubicación va en minúsculas, sin tildes ni espacios (principal, pie).`);
        else if (locations.has(location)) error('_shared.md', `Menús › "${location}": ubicación repetida.`);
        else locations.add(location);
        if (!where || !links) error('_shared.md', `Menús › "${location}": falta dónde se muestra o los enlaces del diseño.`);
    }
    for (const cells of parseTable(chunk('Alcance') ?? '')) {
        const [design, scope, content] = cells.map((cell) => unwrap(cell ?? ''));
        const where = `Alcance › ${design || '(sin nombre)'}`;
        if (!SCOPES.includes(noAccent(scope))) error('_shared.md', `${where}: "Qué es" debe ser estática, blog, catálogo, woocommerce u otro.`);
        else if (noAccent(scope) !== 'estática' && (!content || content === 'ninguno')) error('_shared.md', `${where}: una página ${scope} necesita un Contenido de la tabla "Contenido dinámico".`);
        if (content && content !== 'ninguno' && !dynamicContent.has(content)) error('_shared.md', `${where}: el contenido "${content}" no está en "Contenido dinámico".`);
    }
    // WooCommerce: cómo se dibuja cada pieza (plantilla PHP o bloque). Se pregunta, no se adivina.
    const hasWoo = [...dynamicContent.values()].includes('woo');
    const woo = parseWoo(sharedText);
    wooInfo = woo;
    if (hasWoo && !woo) warn('_shared.md', 'Falta la sección "WooCommerce": cómo se dibujan carrito, checkout, mini-carrito y cuenta (clásico o bloques), variaciones y filtros de tienda.');
    if (woo) {
        if (!hasWoo) warn('_shared.md', 'La sección "WooCommerce" no hace falta: ningún contenido tiene Origen woo.');
        const seen = new Set();
        for (const { piece, mode } of woo.pieces) {
            const where = `WooCommerce › ${piece || '(sin pieza)'}`;
            if (!WOO_PIECES.includes(piece)) error('_shared.md', `${where}: la pieza debe ser ${WOO_PIECES.join(', ')}.`);
            else if (seen.has(piece)) error('_shared.md', `${where}: pieza repetida.`);
            else seen.add(piece);
            if (!WOO_MODES.includes(mode)) error('_shared.md', `${where}: "Modo" debe ser clásico, bloques o no aplica.`);
        }
        for (const piece of WOO_PIECES) if (!seen.has(piece)) error('_shared.md', `WooCommerce › ${piece}: falta la pieza (usa "no aplica" si el diseño no la tiene).`);
        if (!['sí', 'no'].includes(woo.variations)) error('_shared.md', 'WooCommerce: "Variaciones" debe ser sí o no.');
        if (!['sí', 'no'].includes(woo.shopFilters)) error('_shared.md', 'WooCommerce: "Filtros de tienda" debe ser sí o no.');
    }
    for (const [, text] of (chunk('Criterios comunes') ?? '').matchAll(/^- \[[ xX]\] (.+)$/gm)) commonCriteria.add(text.trim());
    for (const block of (chunk('Componentes compartidos') ?? '').split(/^### /m).slice(1)) {
        const name = block.split('\n')[0].trim();
        if (!name || name.startsWith('<')) continue;
        const info = labels(block);
        sharedComponents.push({ name, destino: unwrap(info.Destino ?? ''), args: argNames(info.Argumentos ?? '') });
    }
}

// ---------- _index.md ----------

const indexRows = [];
const indexPath = join(specsDir, '_index.md');
if (!existsSync(indexPath)) error('_index.md', 'Falta _index.md.');
else {
    for (const line of read(indexPath).split('\n')) {
        const m = /^\|\s*(.+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|\s*(\S+)\s*\|$/.exec(line);
        if (m) indexRows.push({ title: m[1], file: m[3], state: m[5] });
    }
    for (const row of indexRows) {
        if (!STATES.includes(row.state)) error('_index.md', `${row.file}: estado inválido "${row.state}".`);
        if (!existsSync(join(specsDir, row.file))) error('_index.md', `${row.file}: el archivo no existe.`);
    }
}

// ---------- Páginas ----------

const pageFiles = readdirSync(specsDir).filter((name) => name.endsWith('.md') && !name.startsWith('_'));
const allFields = new Map();
const allGroups = new Map();
const pageTree = new Map(); // slug -> { name, type, front, parent }
const listings = []; // { name, content, filters } de cada listado
const detailFields = new Map(); // contenido -> Map(campo -> tipo ACF) de su spec de detalle
let sectionCount = 0;
let fieldCount = 0;

for (const name of pageFiles) {
    const text = read(join(specsDir, name));
    const page = name.replace(/\.md$/, '');
    const pagePrefix = `${page.replaceAll('-', '_')}_`;
    const [header, ...blocks] = text.split(/^## Sección: /m);

    if (!indexRows.some((row) => row.file === name)) warn(name, 'No está en _index.md.');

    const pageLabels = labels(header);
    // Las notas de página van mejor como lista (una nota por línea, con sangría bajo la etiqueta).
    const notesList = /^- \*\*Notas de página:\*\*[ \t]*(.*)\n((?:[ \t]+- .*(?:\n|$))*)/m.exec(header);
    const noteItems = (notesList?.[2] ?? '').split('\n').filter((line) => line.trim());
    if (notesList && !notesList[1].trim() && noteItems.length) pageLabels['Notas de página'] = noteItems.map((line) => line.replace(/^\s*- /, '')).join(' ');
    else if (notesList && notesList[1].trim().length > 280) warn(name, 'Las notas de página son un párrafo largo: pasa cada nota a una línea de lista bajo "Notas de página:".');
    if (commonCriteria.size && /Criterios de página/.test(pageLabels['Notas de página'] ?? '')) warn(name, 'Los criterios de página ya están en _shared.md ("Criterios comunes"): quítalos de las notas.');
    for (const label of PAGE_LABELS) if (!pageLabels[label]) error(name, `Falta "${label}" en el resumen de la página.`);
    // Los specs de la 1.0 no traen Tipo, Contenido, Grupo ACF ni Ubicación: avisan, no fallan.
    const grouped = pageLabels['Grupo ACF'] !== undefined;
    if (!grouped) warn(name, 'Spec con formato 1.0: agrega Tipo, Contenido, Grupo ACF y Ubicación en el resumen, y Grupo en cada sección.');
    else {
        for (const label of ['Tipo', 'Contenido', 'Ubicación']) if (!pageLabels[label]) error(name, `Falta "${label}" en el resumen de la página.`);
        const type = noAccent(pageLabels.Tipo ?? '');
        const content = unwrap(pageLabels.Contenido ?? '');
        if (pageLabels.Tipo && !PAGE_TYPES.includes(type)) error(name, `Tipo inválido "${pageLabels.Tipo}": estática, listado, detalle o global.`);
        else if (['estática', 'global'].includes(type) && content && content !== 'ninguno') error(name, `Una página ${type} lleva "Contenido: ninguno".`);
        if (type === 'global' && page !== 'opciones') error(name, 'El spec global se llama "opciones" (opciones.md): sus campos empiezan con opciones_.');
        if (page === 'opciones' && type !== 'global') error(name, 'El spec "opciones" es del tipo global.');
        else if (['listado', 'detalle'].includes(type) && !dynamicContent.has(content)) {
            error(name, `El contenido "${content}" no está en la tabla "Contenido dinámico" de _shared.md.`);
        }
    }
    // Padre (opcional): se revisa al final, cuando ya se leyeron todas las páginas.
    pageTree.set(page, {
        name,
        type: noAccent(pageLabels.Tipo ?? 'estática'),
        front: unwrap(pageLabels.Plantilla ?? '') === 'front-page.php',
        parent: unwrap(pageLabels.Padre ?? '') || 'ninguno',
    });
    const pageType = noAccent(pageLabels.Tipo ?? '');
    const pageContent = unwrap(pageLabels.Contenido ?? '');
    // Filtros (solo listados): se revisan al final, cuando ya se leyeron los campos del detalle.
    if (pageType === 'listado') {
        listings.push({ name, content: pageContent, filters: parseFilters(header) });
        for (const [label, allowed] of Object.entries(LIST_LABELS)) {
            if (pageLabels[label] && !allowed.includes(pageLabels[label])) error(name, `"${label}" inválido "${pageLabels[label]}": ${allowed.join(', ')}.`);
        }
        if (pageLabels['Por página'] && !/^[1-9]\d*$/.test(pageLabels['Por página'])) error(name, `"Por página" inválido "${pageLabels['Por página']}": un número mayor que 0.`);
    } else if (parseFilters(header)) error(name, 'La tabla "Filtros" solo va en un listado.');
    const pageState = pageLabels.Estado;
    if (pageState === 'aplicado') anyApplied = true;
    if (pageState && !STATES.includes(pageState)) error(name, `Estado de página inválido "${pageState}".`);
    const row = indexRows.find((r) => r.file === name);
    if (row && pageState && row.state !== pageState) warn(name, `El estado del spec (${pageState}) no coincide con _index.md (${row.state}).`);

    if (['aprobado', 'aplicado'].includes(pageState)) {
        if (!blocks.length) error(name, `Una página ${pageState} necesita al menos una sección.`);
        if (sharedState === 'pendiente') error(name, 'Aprueba _shared.md antes de aprobar páginas.');
    }

    for (const block of blocks) {
        sectionCount++;
        const sectionName = block.split('\n')[0].trim();
        const where = `${name} › ${sectionName}`;
        const data = labels(block);
        for (const label of SECTION_LABELS) if (!data[label]) error(where, `Falta "${label}".`);
        const group = unwrap(data.Grupo ?? '');
        if (grouped) {
            if (!group) error(where, 'Falta "Grupo" (el campo group de ACF de la sección, o "ninguno" si no tiene campos).');
            else if (group !== 'ninguno') {
                if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(group)) error(where, `Grupo inválido "${group}": snake_case, <página>_<sección>.`);
                else if (!group.startsWith(pagePrefix)) error(where, `El grupo "${group}" debe empezar con "${pagePrefix}".`);
                else if (allGroups.has(group)) error(where, `El grupo "${group}" ya existe en ${allGroups.get(group)}.`);
                else allGroups.set(group, where);
            }
        }
        const state = data.Estado;
        if (state && !STATES.includes(state)) error(where, `Estado inválido "${state}".`);
        // ACF (opcional, lo escribe wp-acf): conectado = la plantilla lee el campo y el texto vive en la carga inicial.
        const acfState = unwrap(data.ACF ?? '');
        if (acfState && !ACF_STATES.includes(acfState)) error(where, `ACF inválido "${acfState}" (pendiente o conectado).`);
        // Query (opcional, lo escribe wp-query): conectado = la sección muestra la consulta real de su listado o detalle.
        const queryState = unwrap(data.Query ?? '');
        if (queryState && !ACF_STATES.includes(queryState)) error(where, `Query inválido "${queryState}" (pendiente o conectado).`);
        if (queryState && !['listado', 'detalle'].includes(pageType)) error(where, 'Query solo va en las secciones de un listado o un detalle.');

        const fieldsBlock = /\*\*Campos ACF\*\*([\s\S]*?)(?=\n\*\*Criterios de aceptación\*\*|$)/.exec(block)?.[1];
        const criteriaBlock = /\*\*Criterios de aceptación\*\*([\s\S]*)$/.exec(block)?.[1];
        if (fieldsBlock === undefined) error(where, 'Falta la tabla "Campos ACF".');
        if (criteriaBlock === undefined) error(where, 'Falta "Criterios de aceptación".');

        const sectionTexts = [];
        const rowNames = new Set(parseTable(fieldsBlock ?? '').map((cells) => unwrap(cells[0] ?? '')));
        for (const cells of fieldsBlock === undefined ? [] : parseTable(fieldsBlock)) {
            fieldCount++;
            const [rawName, type, description, current, required] = cells;
            const field = unwrap(rawName ?? '');
            if (!FIELD_NAME.test(field)) error(where, `Nombre de campo inválido "${field}": usa <página>_<sección>_<campo> en snake_case.`);
            else if (!field.startsWith(pagePrefix)) error(where, `El campo "${field}" debe empezar con "${pagePrefix}".`);
            if (field.includes('.') && !rowNames.has(field.slice(0, field.lastIndexOf('.')))) {
                error(where, `${field}: falta la fila del repetidor "${field.slice(0, field.lastIndexOf('.'))}" (tipo repeater) antes de sus subcampos.`);
            }
            if (allFields.has(field)) error(where, `El campo "${field}" ya existe en ${allFields.get(field)}.`);
            else allFields.set(field, where);
            if (grouped && group && FIELD_NAME.test(field) && !field.startsWith(`${group}_`)) {
                error(where, group === 'ninguno' ? `${field}: la sección dice "Grupo: ninguno" pero tiene campos.` : `El campo "${field}" debe empezar con el grupo "${group}_".`);
            }
            const fieldType = unwrap(type ?? '');
            if (pageType === 'detalle') {
                if (!detailFields.has(pageContent)) detailFields.set(pageContent, new Map());
                detailFields.get(pageContent).set(field, fieldType);
            }
            if (!FIELD_TYPES.has(fieldType)) error(where, `${field}: tipo "${fieldType}" no es un tipo de ACF conocido.`);
            if (FIELD_NAME.test(field) && !field.includes('.')) {
                const prefix = group && group !== 'ninguno' && field.startsWith(`${group}_`) ? `${group}_` : pagePrefix;
                const duplicate = nativeDuplicate(field.slice(prefix.length), { pageType, origin: dynamicContent.get(pageContent), page });
                if (duplicate) warn(where, `${field}: ${duplicate}`);
            }
            if (!description) error(where, `${field}: falta la descripción.`);
            if (!['sí', 'si', 'no'].includes((required ?? '').toLowerCase())) error(where, `${field}: "Requerido" debe ser sí o no.`);
            const value = normalizeText(unwrap(current ?? ''));
            if (TEXT_TYPES.has(fieldType) && value && value !== '—') sectionTexts.push({ field, value });
        }
        for (const { base, fields } of lineSplits(rowNames)) {
            warn(where, `${fields.join(', ')}: es un solo texto en varias líneas. Usa un campo textarea "${base}" y escribe los saltos como <br> en "valor actual".`);
        }

        const criteria = [...(criteriaBlock ?? '').matchAll(/^- \[( |x|X)\] .+$/gm)];
        if (criteriaBlock !== undefined && !criteria.length) error(where, 'Los criterios de aceptación necesitan al menos un ítem "- [ ] …".');
        if (commonCriteria.size) {
            const repeated = criteria.filter((c) => commonCriteria.has(c[0].replace(/^- \[[ xX]\] /, '').trim()));
            if (repeated.length >= 3) warn(where, `Repite ${repeated.length} criterios que ya están en "Criterios comunes" de _shared.md: deja una línea "Cumple los criterios comunes" y solo los propios de la sección.`);
        } else if (/criterios comunes/i.test(criteriaBlock ?? '')) {
            warn(where, 'La sección remite a "Criterios comunes" pero _shared.md no tiene esa sección.');
        }

        if (state === 'aplicado') {
            if (criteria.some((c) => c[1] === ' ')) error(where, 'Hay criterios de aceptación sin marcar.');
            const paths = unwrap(data.Destino ?? '').split(/\s*,\s*/).map(unwrap).filter(Boolean);
            const found = paths.filter((p) => existsSync(join(target, p)));
            for (const p of paths) if (!found.includes(p)) error(where, `El destino "${p}" no existe en el tema.`);

            const texts = found.flatMap((p) => phpTexts(join(target, p)));
            const flat = [...texts, ...found.flatMap((p) => phpLiterals(join(target, p)))].join(' ');
            for (const { field, value } of acfState === 'conectado' ? [] : sectionTexts) {
                if (!flat.includes(value)) error(where, `${field}: el valor actual "${value.slice(0, 40)}" no aparece en el destino.`);
            }
            const extra = texts.filter((t) => !sectionTexts.some(({ value }) => value.includes(t) || t.includes(value)));
            if (found.length && extra.length) {
                const sample = extra.slice(0, 5).map((t) => `"${t.slice(0, 40)}"`).join(', ');
                warn(where, `Texto fijo en el destino que no está en el spec: ${sample}${extra.length > 5 ? ` (+${extra.length - 5})` : ''}.`);
            }
        }
    }

    if (pageState === 'aplicado' && blocks.some((b) => !['aplicado', 'descartado'].includes(labels(b).Estado))) {
        error(name, 'La página está aplicada pero tiene secciones que no están aplicadas ni descartadas.');
    }

    // Fuente Figma: las notas del usuario en enlaces/ pasan tal cual al spec. Falta una: aviso; en una página
    // aprobada o aplicada, error (no se aprueba algo que ignora lo que el usuario pidió).
    const figmaPage = /^figma:([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/.exec(unwrap(pageLabels.Fuente ?? ''))?.[1];
    const enlacesFile = figmaPage && join(specsDir, 'figma', 'enlaces', `${figmaPage}.md`);
    if (enlacesFile && existsSync(enlacesFile)) {
        const enlaces = parseEnlaces(read(enlacesFile), figmaPage);
        const report = ['aprobado', 'aplicado'].includes(pageState) ? error : warn;
        const has = (text, note) => normalizeText(text).toLowerCase().includes(normalizeText(note).toLowerCase());
        for (const note of enlaces.notes) {
            if (!has(header, note)) report(name, `La nota de la página en enlaces/${figmaPage}.md no está en "Notas de página": "${note}".`);
        }
        const byName = new Map(blocks.map((b) => [b.split('\n')[0].trim(), b]));
        for (const s of enlaces.sections) {
            const block = byName.get(s.name);
            if (!block) continue;
            for (const note of s.notes) {
                if (!has(block, note)) report(`${name} › ${s.name}`, `La nota de enlaces/${figmaPage}.md no está en "Indicaciones del diseño": "${note}".`);
            }
        }
    }
}

// Padre: otra página estática (wp-acf la crea como hija, /padre/hija/), sin ciclos.
for (const [page, { name, type, front, parent }] of pageTree) {
    if (parent === 'ninguno') continue;
    const up = pageTree.get(parent);
    if (type !== 'estática' || front) error(name, 'Solo una página estática que no es la de inicio puede tener "Padre".');
    else if (parent === page) error(name, 'Una página no puede ser su propio padre.');
    else if (!up) error(name, `Padre "${parent}": no hay un spec ${parent}.md (usa el slug de otra página o "ninguno").`);
    else if (up.type !== 'estática') error(name, `Padre "${parent}": la página padre tiene que ser estática.`);
    else {
        const seen = new Set([page]);
        for (let at = parent; at !== 'ninguno' && pageTree.has(at); at = pageTree.get(at).parent) {
            if (seen.has(at)) { error(name, `Padre "${parent}": las páginas forman un ciclo (${[...seen, at].join(' → ')}).`); break; }
            seen.add(at);
        }
    }
}

// Filtros de cada listado: nombres en la URL, tipo y fuente (taxonomía de su contenido o campo de su detalle).
for (const { name, content, filters } of listings) {
    const row = dynamicRows.get(content);
    if (!row) continue; // ya se informó que el contenido no existe
    if (!filters?.length) {
        // Una tienda de WooCommerce pide la tabla solo si "Filtros de tienda" es sí (wp-query conecta esos filtros).
        const needsTable = row.origin === 'woo' ? wooInfo?.shopFilters === 'sí' : row.filters && row.filters !== 'ninguno';
        if (needsTable) warn(name, `${filters ? 'La tabla "Filtros" está vacía' : 'Falta la tabla "Filtros"'} (el diseño muestra: ${row.filters}): wp-query la necesita para conectar los filtros.`);
        continue;
    }
    const isWoo = row.origin === 'woo';
    if (isWoo && wooInfo?.shopFilters === 'no') warn(name, 'La tabla "Filtros" no se usa: "Filtros de tienda" está en no en la sección WooCommerce de _shared.md.');
    const fields = detailFields.get(content) ?? new Map();
    const taxonomies = new Set([...row.taxonomies.map((t) => t.key), ...(row.origin === 'post' ? ['category', 'post_tag'] : [])]);
    // En una tienda de WooCommerce: las taxonomías propias de WooCommerce (categoría, etiqueta y atributos pa_*) y el precio.
    const wooTaxonomy = (key) => isWoo && (['product_cat', 'product_tag'].includes(key) || /^pa_[a-z0-9_-]+$/.test(key ?? ''));
    const reserved = new Set([...WP_QUERY_VARS, ...row.taxonomies.map((t) => t.key), ...dynamicRows.keys(), ...(isWoo ? ['min_price', 'max_price', 'rating_filter', 'orderby'] : [])]);
    const seen = new Set();
    const fieldOf = (where, field, types, kind) => {
        if (!field) error(where, `Fuente: el campo ACF va entre comillas invertidas (\`${content}_<sección>_<campo>\`).`);
        else if (!fields.has(field)) error(where, `Fuente: el campo "${field}" no está en el spec de detalle de "${content}".`);
        else if (!types.includes(fields.get(field))) error(where, `Fuente: "${field}" es ${fields.get(field)}; un filtro de ${kind} necesita ${types.join(', ')}.`);
    };
    for (const type of ['búsqueda', 'orden']) {
        if (filters.filter((f) => f.type === type).length > 1) error(name, `La tabla "Filtros" tiene más de un filtro de ${type}.`);
    }
    for (const f of filters) {
        const where = `${name} › Filtros › ${f.name || '(sin nombre)'}`;
        if (!/^[a-z][a-z0-9_]*$/.test(f.name)) error(where, 'El nombre del filtro va en minúsculas, sin tildes ni espacios: es el que se ve en la URL.');
        else if (seen.has(f.name)) error(where, 'Filtro repetido.');
        else if (reserved.has(f.name)) error(where, `"${f.name}" choca con una variable de WordPress o con una taxonomía o contenido: usa otro nombre (la búsqueda va en "q").`);
        seen.add(f.name);
        if (!FILTER_TYPES.includes(f.type)) { error(where, `Tipo "${f.type}" inválido: ${FILTER_TYPES.join(', ')}.`); continue; }
        const choosable = ['taxonomía', 'opciones'].includes(f.type);
        if (f.multiple === null) error(where, '"Varios" debe ser no, sí (o) o sí (y).');
        else if (f.multiple !== 'no' && !choosable) error(where, `Un filtro de ${f.type} no admite varios valores: "Varios" va en no o —.`);
        if (!['ninguno', 'fijo', 'dinámico'].includes(f.count)) error(where, `"Conteo" debe ser ninguno, fijo o dinámico.`);
        else if (f.count !== 'ninguno' && !choosable) error(where, `Un filtro de ${f.type} no lleva conteo: "Conteo" va en ninguno o —.`);
        if (!f.view) error(where, 'Falta "Vista" (cómo se ve en el diseño: checkbox, select, chips, deslizador…).');

        if (f.type === 'taxonomía') {
            const key = f.fields[0] ?? f.source;
            if (!taxonomies.has(key) && !wooTaxonomy(key)) error(where, `Fuente: la taxonomía "${key}" no está en la fila "${content}" de "Contenido dinámico".`);
        } else if (isWoo && (f.type === 'opciones' || f.type === 'fecha')) {
            error(where, `Un filtro de ${f.type} no está disponible en una tienda de WooCommerce: usa una taxonomía (categoría, etiqueta o atributo).`);
        } else if (isWoo && f.type === 'rango') {
            if (f.fields[0] !== 'precio') error(where, 'Fuente: en una tienda de WooCommerce el rango es el precio: `precio`.');
        } else if (f.type === 'rango' || f.type === 'opciones') {
            fieldOf(where, f.fields[0], FILTER_FIELD_TYPES[f.type], f.type);
            if (f.type === 'opciones' && fields.get(f.fields[0]) === 'true_false' && f.multiple !== 'no') error(where, 'Un campo sí/no (true_false) no admite varios valores.');
        } else if (f.type === 'fecha') {
            if ((f.fields[0] ?? f.source.split(/\s/)[0]) !== 'post_date') fieldOf(where, f.fields[0], FILTER_FIELD_TYPES.fecha, 'fecha');
        } else if (f.type === 'orden') {
            if (!f.orders.length) error(where, `Fuente: las opciones de orden separadas por comas (${ORDER_KEYWORDS.join(', ')} o \`campo\` asc/desc).`);
            for (const order of f.orders) {
                if (order.field && isWoo) {
                    if (order.field !== 'precio') error(where, `Orden "${order.field}": en una tienda de WooCommerce solo se ordena por \`precio\` asc/desc, además de ${ORDER_KEYWORDS.join(', ')}.`);
                } else if (order.field) fieldOf(where, order.field, FILTER_FIELD_TYPES.orden, 'orden');
                else if (['popularidad', 'valoracion'].includes(order.key) && !isWoo) error(where, `Orden "${order.key}": solo existe en una tienda de WooCommerce.`);
                else if (!ORDER_KEYWORDS.includes(order.key)) error(where, `Orden "${order.key}" desconocido: ${ORDER_KEYWORDS.join(', ')} o \`campo\` asc/desc.`);
            }
        }
    }
}

// ---------- Componentes de _shared.md frente al tema ----------
// Una corrección en el código que cambia un componente (nuevo, movido, con otros argumentos) también va al spec.

if (anyApplied) {
    const documented = new Set();
    for (const component of sharedComponents) {
        const where = `_shared.md › Componentes › ${component.name}`;
        if (!component.destino) { warn(where, 'Falta "Destino" (template-parts/components/<nombre>.php).'); continue; }
        documented.add(component.destino);
        const path = join(target, component.destino);
        if (!existsSync(path)) { warn(where, `El destino "${component.destino}" no existe en el tema: si se movió o se renombró, actualiza el spec.`); continue; }
        const used = [...new Set([...read(path).matchAll(/\$args\[\s*['"]([a-z_][a-z0-9_]*)['"]\s*\]/gi)].map((m) => m[1]))];
        const extra = used.filter((name) => !component.args.includes(name));
        const missing = component.args.filter((name) => !used.includes(name));
        if (extra.length) warn(where, `El componente usa ${extra.map((n) => `$args['${n}']`).join(', ')}, que no está en "Argumentos": actualiza el spec.`);
        if (missing.length && used.length) warn(where, `"Argumentos" lista ${missing.join(', ')}, que el componente ya no usa: actualiza el spec.`);
    }
    const dir = join(target, 'template-parts/components');
    if (existsSync(dir)) {
        for (const file of readdirSync(dir).filter((n) => n.endsWith('.php'))) {
            const rel = `template-parts/components/${file}`;
            if (!documented.has(rel)) warn(rel, 'Componente sin documentar en "Componentes compartidos" de _shared.md (origen, destino, argumentos y dónde se usa).');
        }
    }
}

console.log(JSON.stringify({
    ok: errors.length === 0,
    pages: pageFiles.length,
    sections: sectionCount,
    groups: allGroups.size,
    dynamicContent: [...dynamicContent.keys()],
    fields: fieldCount,
    errors,
    warnings,
}, null, 2));
process.exit(errors.length ? 4 : 0);
