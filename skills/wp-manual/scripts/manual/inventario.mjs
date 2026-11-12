// Inventario de lo administrable de un tema: qué capítulos tendrá el manual (opciones, páginas,
// contenidos) y qué queda sin cubrir. Sale del acf-json, de inc/acf/paginas.php (wp-acf) o de
// specs/_index.md (design-import), y de las plantillas PHP. Solo lee.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { detectTheme } from '../lib/tema.mjs';
import { hasSpecs, loadSpecs } from '../lib/specs.mjs';
import { flatten, locationsOf, readAcfJson, sectionsOf } from './acf.mjs';

const slug = (text) => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Páginas de WordPress que conoce el tema: de inc/acf/paginas.php (wp-acf) y, si no está, de specs/_index.md.
export function readPages(target) {
    const php = join(target, 'inc/acf/paginas.php');
    if (existsSync(php)) {
        const pages = [];
        const re = /'([\w-]+)'\s*=>\s*\[([^\]]*)\]/g;
        for (const [, key, body] of readFileSync(php, 'utf8').matchAll(re)) {
            const get = (name) => new RegExp(`'${name}'\\s*=>\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(body)?.[1]?.replace(/\\'/g, "'") ?? '';
            pages.push({
                key,
                title: get('titulo') || key,
                slug: get('slug') || key,
                template: get('plantilla'),
                front: /'frente'\s*=>\s*true/.test(body),
                posts: /'entradas'\s*=>\s*true/.test(body),
                parent: get('padre'),
            });
        }
        if (pages.length) return { source: 'inc/acf/paginas.php', pages };
    }
    const specsDir = join(target, 'specs');
    if (hasSpecs(specsDir)) {
        const { index } = loadSpecs(specsDir);
        const pages = index.map((row) => {
            const key = row.file.replace(/\.md$/, '');
            return {
                key,
                title: row.title,
                slug: key,
                template: row.template.startsWith('pages/') ? row.template : '',
                front: row.template === 'front-page.php',
                posts: row.template === 'home.php',
                parent: '',
                state: row.state,
            };
        });
        return { source: 'specs/_index.md', pages };
    }
    return { source: null, pages: [] };
}

// Archivos PHP del tema (sin node_modules, vendor ni dist).
function phpFiles(target) {
    const out = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            if (['node_modules', 'vendor', 'dist', '.git', 'specs'].includes(name)) continue;
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (name.endsWith('.php')) out.push(path);
        }
    };
    if (existsSync(target)) walk(target);
    return out;
}

// Campos que la plantilla imprime con el helper de resaltado (<prefijo>_highlight): por sección
// (`home_hero` → Set('descripcion')). Solo esos campos aceptan *asteriscos* y |barras|.
export function highlightMap(target, prefix) {
    const map = new Map();
    if (!prefix) return map;
    const call = new RegExp(`${prefix}_highlight\\s*\\(([\\s\\S]*?)(?:\\?>|;)`, 'g');
    for (const path of phpFiles(target)) {
        const code = readFileSync(path, 'utf8');
        const groups = [...code.matchAll(/get_field\(\s*['"](\w+)['"]/g)].map((m) => m[1]);
        if (!groups.length) continue;
        const keys = new Set();
        const keysIn = (text) => [...text.matchAll(/\[\s*['"](\w+)['"]\s*\]/g)].map((m) => m[1]);
        for (const [, args] of code.matchAll(call)) {
            for (const key of keysIn(args)) keys.add(key);
            // copam_theme_highlight($descripcion) con $descripcion = $hero['descripcion'] más arriba.
            for (const [, variable] of args.matchAll(/\$(\w+)/g)) {
                for (const [, value] of code.matchAll(new RegExp(`\\$${variable}\\s*=\\s*([^;]*);`, 'g'))) for (const key of keysIn(value)) keys.add(key);
            }
        }
        if (!keys.size) continue;
        for (const group of groups) {
            if (!map.has(group)) map.set(group, new Set());
            for (const key of keys) map.get(group).add(key);
        }
    }
    return map;
}

// Selector CSS del elemento raíz de una sección en la web, leído de su plantilla (el PHP que llama
// get_field('<sección>')): `#id`, luego un atributo data-, luego `etiqueta.clase`. null si no se puede.
// Así la referencia web no depende de la posición de la sección dentro de <main>.
export function selectorDePlantilla(files, sectionName) {
    const llamada = new RegExp(`get_field\\(\\s*['"]${sectionName}['"]`);
    for (const { code } of files) {
        if (!llamada.test(code)) continue;
        const html = code.replace(/<\?(?:php|=)[\s\S]*?(?:\?>|$)/g, ' ');
        const tag = /<([a-z][\w-]*)\b([^>]*)>/i.exec(html);
        if (!tag) continue;
        const [, name, attrs] = tag;
        const attr = (re) => re.exec(attrs)?.[1];
        const id = attr(/\bid\s*=\s*["']([\w-]+)["']/);
        if (id) return `#${id}`;
        const data = /\b(data-[\w-]+)(?:\s*=\s*["']([^"'<>]*)["'])?/.exec(attrs);
        if (data) return data[2] !== undefined ? `${name}[${data[1]}="${data[2]}"]` : `${name}[${data[1]}]`;
        const clase = attr(/\bclass\s*=\s*["']([^"']+)["']/)?.split(/\s+/).find((c) => /^[a-z][\w-]*$/i.test(c) && !/^(relative|flex|grid|block|container|mx-auto|w-full|py-|px-)/.test(c));
        if (clase) return `${name}.${clase}`;
    }
    return null;
}

// Envíos guardados de wp-form (inc/forms-entries.php): el tipo de contenido donde se guardan, o null.
export function detectarEnvios(files) {
    for (const { code } of files) {
        if (!/register_post_type\(\s*\w+_ENTRY_TYPE/.test(code)) continue;
        const type = /const\s+\w+_ENTRY_TYPE\s*=\s*['"]([\w-]+)['"]/.exec(code)?.[1] ?? /define\(\s*['"]\w+_ENTRY_TYPE['"]\s*,\s*['"]([\w-]+)['"]/.exec(code)?.[1];
        if (type) return { postType: type };
    }
    return null;
}

// Capítulos del manual y lo que queda sin cubrir.
export function buildInventory(target) {
    const theme = detectTheme(target);
    const acf = readAcfJson(join(target, 'acf-json'));
    const { pages, source } = readPages(target);
    const highlights = highlightMap(target, theme.prefix);
    const files = phpFiles(target).map((path) => ({ path, code: readFileSync(path, 'utf8') }));
    const chapters = [];
    const uncovered = [];

    const withHighlights = (sections) => sections.map((section) => {
        const keys = highlights.get(section.name) ?? new Set();
        const mark = (items) => items.map((f) => ({ ...f, highlight: keys.has(f.name), sub: f.sub ? mark(f.sub) : undefined }));
        return { ...section, fields: mark(section.fields), webSelector: selectorDePlantilla(files, section.name) };
    });
    const chapterOf = (props, group) => {
        const sections = withHighlights(sectionsOf(group)).filter((s) => s.fields.length);
        const fields = sections.reduce((n, s) => n + flatten(s.fields).length, 0);
        return { ...props, group: group.key, groupTitle: group.title, sections, fields };
    };

    // Páginas de opciones (con su ruta en el menú del admin).
    const optionsBySlug = new Map(acf.optionsPages.map((p) => [p.menu_slug, p]));
    const menuPath = (page) => {
        const parent = page.parent_slug && optionsBySlug.get(page.parent_slug);
        return parent ? `${parent.menu_title || parent.page_title} › ${page.menu_title || page.page_title}` : (page.menu_title || page.page_title);
    };

    const pagesUsed = new Set();
    for (const group of acf.groups) {
        const rules = locationsOf(group);
        const empty = !sectionsOf(group).some((s) => s.fields.length);
        const rule = rules[0];
        if (!rule) { uncovered.push({ kind: 'grupo', name: group.title, reason: 'El grupo no tiene una ubicación que el manual entienda.' }); continue; }

        if (rule.param === 'options_page') {
            const page = optionsBySlug.get(rule.value) ?? { menu_slug: rule.value, page_title: group.title, menu_title: group.title };
            if (empty) continue;
            chapters.push(chapterOf({
                id: `opciones-${rule.value}`, kind: 'opciones', title: page.page_title || group.title,
                where: menuPath(page), admin: { options: rule.value }, pages: [],
            }, group));
        } else if (['page_type', 'page_template', 'page'].includes(rule.param)) {
            let using = [];
            if (rule.param === 'page_type' && rule.value === 'front_page') using = pages.filter((p) => p.front);
            else if (rule.param === 'page_type' && rule.value === 'posts_page') using = pages.filter((p) => p.posts);
            else if (rule.param === 'page_template') using = pages.filter((p) => p.template === rule.value);
            for (const p of using) pagesUsed.add(p.key);
            if (empty) {
                for (const p of using) uncovered.push({ kind: 'página', name: p.title, reason: 'No tiene campos propios: no hay nada que documentar (o se edita con el editor de WordPress).' });
                continue;
            }
            if (!using.length) uncovered.push({ kind: 'grupo', name: group.title, reason: `Ninguna página conocida usa ${rule.param} = ${rule.value} (${source ?? 'no hay lista de páginas'}).` });
            const title = using.length === 1 ? using[0].title : group.title;
            chapters.push(chapterOf({
                id: `pagina-${using.length === 1 ? using[0].key : slug(group.title)}`, kind: 'pagina', title,
                where: `Páginas › ${using.map((p) => p.title).join(', ') || group.title}`,
                admin: { pages: using.map((p) => ({ key: p.key, slug: p.slug, title: p.title, front: p.front })) },
                pages: using.map((p) => p.title), shared: using.length > 1,
            }, group));
        } else if (rule.param === 'post_type') {
            const type = acf.postTypes.find((t) => t.post_type === rule.value);
            const name = rule.value === 'post' ? 'Entradas' : (type?.labels?.name || type?.title || rule.value);
            chapters.push(chapterOf({
                id: `contenido-${rule.value}`, kind: 'contenido', title: name, where: name,
                admin: { postType: rule.value }, pages: [], native: true,
            }, group));
        } else if (rule.param === 'taxonomy') {
            uncovered.push({ kind: 'grupo', name: group.title, reason: 'Campos de una taxonomía (categorías): todavía no los cubre el manual.' });
        } else {
            uncovered.push({ kind: 'grupo', name: group.title, reason: `Ubicación ${rule.param} todavía no la cubre el manual.` });
        }
    }

    // Tipos de contenido sin grupo propio: igual tienen su capítulo (campos nativos).
    for (const type of acf.postTypes) {
        if (chapters.some((c) => c.admin.postType === type.post_type)) continue;
        chapters.push({
            id: `contenido-${type.post_type}`, kind: 'contenido', title: type.labels?.name || type.title || type.post_type,
            where: type.labels?.name || type.title, admin: { postType: type.post_type }, pages: [], native: true, sections: [], fields: 0,
        });
    }
    for (const page of pages) {
        if (!pagesUsed.has(page.key)) uncovered.push({ kind: 'página', name: page.title, reason: 'Ningún grupo de campos de ACF apunta a esta página.' });
    }

    // Menús y logo: solo si el tema registra menús o el logo personalizado.
    const code = files.filter((f) => !f.path.includes(`${join('template-parts')}`)).map((f) => f.code).join('\n');
    const sitio = [];
    if (/register_nav_menus?\s*\(/.test(code)) sitio.push({ name: 'menus', label: 'Menús', fields: [], admin: 'nav-menus.php' });
    if (/add_theme_support\(\s*['"]custom-logo['"]/.test(code)) sitio.push({ name: 'identidad', label: 'Logo e ícono del sitio', fields: [], admin: 'customize.php?autofocus[section]=title_tagline' });
    if (sitio.length) {
        chapters.push({ id: 'sitio', kind: 'sitio', title: 'Menús y logo', where: 'Apariencia', admin: {}, pages: [], sections: sitio, fields: 0 });
    }

    // Orden: opciones, páginas (portada primero y luego el orden de specs/_index.md, que sigue el sitio),
    // contenidos, menús y logo.
    const order = { opciones: 0, pagina: 1, contenido: 2, sitio: 3 };
    const specsOrder = hasSpecs(join(target, 'specs')) ? loadSpecs(join(target, 'specs')).index.map((r) => r.file.replace(/\.md$/, '')) : [];
    const rank = (c) => {
        if (c.kind !== 'pagina') return 0;
        if (c.admin.pages?.some((p) => p.front)) return -1;
        const i = Math.min(...(c.admin.pages ?? []).map((p) => specsOrder.indexOf(p.key)).filter((n) => n >= 0));
        return Number.isFinite(i) ? i : 9999;
    };
    chapters.sort((a, b) => order[a.kind] - order[b.kind] || rank(a) - rank(b));
    return { target, prefix: theme.prefix, pagesSource: source, chapters, uncovered, envios: detectarEnvios(files) };
}

export const relativeTo = (target, path) => relative(target, path).replace(/\\/g, '/');
