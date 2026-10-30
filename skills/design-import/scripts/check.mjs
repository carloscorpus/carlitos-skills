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
import { fail } from './lib/common.mjs';
import {
    FILTER_TYPES, ORDER_KEYWORDS, labels, lineSplits, noAccent, normalizeText, parseDynamicContent, parseFilters, parseTable, phpLiterals, phpTexts, read, unwrap,
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

const errors = [];
const warnings = [];
const error = (file, message) => errors.push({ file, message });
const warn = (file, message) => warnings.push({ file, message });


// ---------- _shared.md ----------

let sharedState = null;
const dynamicRows = new Map(); // contenido -> fila completa (taxonomías, filtros)
const dynamicContent = new Map(); // contenido -> origen
const commonCriteria = new Set(); // criterios de "Criterios comunes" de _shared.md
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
    for (const [, text] of (chunk('Criterios comunes') ?? '').matchAll(/^- \[[ xX]\] (.+)$/gm)) commonCriteria.add(text.trim());
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
        if (row.filters && row.filters !== 'ninguno') warn(name, `${filters ? 'La tabla "Filtros" está vacía' : 'Falta la tabla "Filtros"'} (el diseño muestra: ${row.filters}): wp-query la necesita para conectar los filtros.`);
        continue;
    }
    const fields = detailFields.get(content) ?? new Map();
    const taxonomies = new Set([...row.taxonomies.map((t) => t.key), ...(row.origin === 'post' ? ['category', 'post_tag'] : [])]);
    const reserved = new Set([...WP_QUERY_VARS, ...row.taxonomies.map((t) => t.key), ...dynamicRows.keys()]);
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
            if (!taxonomies.has(key)) error(where, `Fuente: la taxonomía "${key}" no está en la fila "${content}" de "Contenido dinámico".`);
        } else if (f.type === 'rango' || f.type === 'opciones') {
            fieldOf(where, f.fields[0], FILTER_FIELD_TYPES[f.type], f.type);
            if (f.type === 'opciones' && fields.get(f.fields[0]) === 'true_false' && f.multiple !== 'no') error(where, 'Un campo sí/no (true_false) no admite varios valores.');
        } else if (f.type === 'fecha') {
            if ((f.fields[0] ?? f.source.split(/\s/)[0]) !== 'post_date') fieldOf(where, f.fields[0], FILTER_FIELD_TYPES.fecha, 'fecha');
        } else if (f.type === 'orden') {
            if (!f.orders.length) error(where, `Fuente: las opciones de orden separadas por comas (${ORDER_KEYWORDS.join(', ')} o \`campo\` asc/desc).`);
            for (const order of f.orders) {
                if (order.field) fieldOf(where, order.field, FILTER_FIELD_TYPES.orden, 'orden');
                else if (!ORDER_KEYWORDS.includes(order.key)) error(where, `Orden "${order.key}" desconocido: ${ORDER_KEYWORDS.join(', ')} o \`campo\` asc/desc.`);
            }
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
