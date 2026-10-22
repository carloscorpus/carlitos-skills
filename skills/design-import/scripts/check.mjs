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
import { labels, noAccent, normalizeText, parseTable, phpLiterals, phpTexts, read, unwrap } from './lib/specs.mjs';

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

const errors = [];
const warnings = [];
const error = (file, message) => errors.push({ file, message });
const warn = (file, message) => warnings.push({ file, message });


// ---------- _shared.md ----------

let sharedState = null;
const dynamicContent = new Map(); // contenido -> origen
const commonCriteria = new Set(); // criterios de "Criterios comunes" de _shared.md
const sharedPath = join(specsDir, '_shared.md');
if (!existsSync(sharedPath)) error('_shared.md', 'Falta _shared.md.');
else {
    const sharedText = read(sharedPath);
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
            if (!FIELD_TYPES.has(fieldType)) error(where, `${field}: tipo "${fieldType}" no es un tipo de ACF conocido.`);
            if (!description) error(where, `${field}: falta la descripción.`);
            if (!['sí', 'si', 'no'].includes((required ?? '').toLowerCase())) error(where, `${field}: "Requerido" debe ser sí o no.`);
            const value = normalizeText(unwrap(current ?? ''));
            if (TEXT_TYPES.has(fieldType) && value && value !== '—') sectionTexts.push({ field, value });
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
