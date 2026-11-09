// Lectura del acf-json del tema y numeración de los campos en el mismo orden en que se ven en el admin.
// Sin dependencias; solo lee.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Campos que no se escriben (no llevan número): pestañas, acordeones y mensajes.
export const NO_NUMERADOS = new Set(['tab', 'accordion', 'message']);
// Campos que contienen otros campos: sus hijos se numeran con el número del padre (7.1, 2.5.1).
export const CONTENEDORES = new Set(['repeater', 'group', 'flexible_content']);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// Todo lo que ACF describe en acf-json/: grupos de campos, páginas de opciones, tipos de contenido y
// taxonomías. Los grupos inactivos se ignoran.
export function readAcfJson(dir) {
    const out = { groups: [], optionsPages: [], postTypes: [], taxonomies: [] };
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
        let data;
        try { data = readJson(join(dir, name)); } catch { continue; }
        if (data.active === false) continue;
        const key = data.key ?? '';
        if (key.startsWith('group_')) out.groups.push({ ...data, file: name });
        else if (key.startsWith('ui_options_page_')) out.optionsPages.push({ ...data, file: name });
        else if (key.startsWith('post_type_')) out.postTypes.push({ ...data, file: name });
        else if (key.startsWith('taxonomy_')) out.taxonomies.push({ ...data, file: name });
    }
    return out;
}

// Numera una lista de campos: 1, 2, 3… y los hijos de un contenedor con el número del padre.
// En flexible_content se numeran los campos de cada bloque (layout) en orden.
export function numberFields(fields, prefix = '') {
    const out = [];
    let i = 0;
    for (const field of fields ?? []) {
        if (NO_NUMERADOS.has(field.type)) continue;
        i += 1;
        const n = prefix ? `${prefix}.${i}` : String(i);
        const item = {
            n,
            name: field.name ?? '',
            label: (field.label ?? '').trim(),
            type: field.type ?? '',
            required: Boolean(Number(field.required)),
            instructions: field.instructions ?? '',
        };
        if (field.type === 'flexible_content') {
            item.sub = numberFields(Object.values(field.layouts ?? {}).flatMap((layout) => layout.sub_fields ?? []), n);
        } else if (CONTENEDORES.has(field.type)) {
            item.sub = numberFields(field.sub_fields, n);
        }
        out.push(item);
    }
    return out;
}

// Lista plana (en orden) de un árbol numerado.
export const flatten = (items) => items.flatMap((item) => [item, ...flatten(item.sub ?? [])]);

// Secciones de un grupo. Si todos los campos visibles de primer nivel son `group` (la convención de
// design-import: un group por sección, `home_hero`), cada uno es una sección y sus campos se numeran desde 1.
// Si no, el grupo completo es una sola sección.
export function sectionsOf(group) {
    const visible = (group.fields ?? []).filter((f) => !NO_NUMERADOS.has(f.type));
    if (visible.length && visible.every((f) => f.type === 'group')) {
        return visible.map((f) => ({ name: f.name, label: (f.label ?? '').trim(), key: f.key, fields: numberFields(f.sub_fields) }));
    }
    return [{ name: group.key, label: (group.title ?? '').trim(), key: group.key, fields: numberFields(group.fields) }];
}

// Dónde se muestra un grupo según su "location" de ACF. Devuelve una lista de reglas simples
// { param, value } (las reglas con "!=" no cuentan) o [] si no hay ninguna utilizable.
export function locationsOf(group) {
    const rules = [];
    for (const and of group.location ?? []) {
        for (const rule of and ?? []) {
            if (rule.operator === '==') rules.push({ param: rule.param, value: rule.value });
        }
    }
    return rules;
}
