#!/usr/bin/env node
// Inventario de SOLO LECTURA de la carpeta que exporta Claude Design (HTML + CSS + JS estático).
// Sin dependencias. No ejecuta, importa ni evalúa nada de la carpeta: solo lee texto.
//
// Uso:
//   node analyze.mjs --source <dir> [--out <archivo.json>]
//
// Imprime un JSON con: summary, pages (secciones y su contenido), assets, tokens (colores,
// tipografías, espaciados, radios, sombras), repeated (bloques repetidos = candidatos a componente),
// interactions (formularios, filtros, modales, acordeones, sliders, tabs), dynamicCandidates (páginas que
// parecen listados o tienda) y findings (malas prácticas con
// archivo:línea). Códigos: 0 ok, 1 error de uso. No escribe nada salvo --out (fuera de la fuente).

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fail } from './lib/common.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache']);
const MAX_BYTES = 1_500_000;
const MAX_FILES = 3000;
const SAMPLE = 12; // ubicaciones por hallazgo
const TOP = 30; // elementos por lista de tokens
const TEXT_CAP = 80; // textos por sección

const EXT = {
    html: ['.html', '.htm'],
    css: ['.css'],
    js: ['.js', '.mjs'],
    image: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif', '.ico'],
    font: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
};
const kindOf = (file) => Object.keys(EXT).find((kind) => EXT[kind].includes(extname(file).toLowerCase())) ?? null;

let args;
try {
    ({ values: args } = parseArgs({
        options: { source: { type: 'string' }, out: { type: 'string' } },
    }));
} catch (e) {
    fail(1, e.message);
}

if (!args.source) fail(1, 'Falta --source <carpeta con el diseño>.');
const source = resolve(args.source);
if (!existsSync(source) || !statSync(source).isDirectory()) fail(1, `La fuente no es una carpeta: ${source}`);
if (args.out) {
    const out = resolve(args.out);
    if (out === source || out.startsWith(source + sep)) fail(1, '--out no puede estar dentro de la carpeta fuente.');
}

const rel = (full) => relative(source, full).split(sep).join('/');

// ---------- Recorrido ----------

const skipped = [];
const files = { html: [], css: [], js: [], image: [], font: [] };

function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isSymbolicLink()) {
            skipped.push({ file: rel(full), reason: 'enlace simbólico' });
        } else if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) visit(full);
        } else if (entry.isFile()) {
            const kind = kindOf(entry.name);
            if (!kind) continue;
            const size = statSync(full).size;
            if (files.html.length + files.css.length + files.js.length + files.image.length + files.font.length >= MAX_FILES) {
                skipped.push({ file: rel(full), reason: `más de ${MAX_FILES} archivos` });
            } else if ((kind === 'html' || kind === 'css' || kind === 'js') && size > MAX_BYTES) {
                skipped.push({ file: rel(full), reason: `pesa más de ${MAX_BYTES} bytes` });
            } else {
                files[kind].push({ full, file: rel(full), size });
            }
        }
    }
}
visit(source);

// ---------- Utilidades ----------

function lineIndex(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    return (pos) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= pos) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

const decode = (text) => text
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

// ---------- Hallazgos ----------

const findings = new Map();
function add(id, severity, note, file, line) {
    const found = findings.get(id) ?? { id, severity, note, count: 0, locations: [] };
    found.count++;
    if (found.locations.length < SAMPLE) found.locations.push({ file, line });
    findings.set(id, found);
}

// ---------- HTML ----------

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const OPEN = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/y;
const CLOSE = /<\/([a-zA-Z][\w:-]*)[^>]*>/y;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const isEl = (node) => typeof node.tag === 'string';

function parseHtml(src) {
    const lineOf = lineIndex(src);
    const lower = src.toLowerCase();
    const root = { tag: '#root', attrs: {}, children: [], line: 1, parent: null };
    let current = root;
    let i = 0;

    const pushText = (raw, at) => {
        const text = decode(raw).replace(/\s+/g, ' ').trim();
        if (text) current.children.push({ text, line: lineOf(at), parent: current });
    };

    while (i < src.length) {
        const lt = src.indexOf('<', i);
        if (lt === -1) {
            pushText(src.slice(i), i);
            break;
        }
        if (lt > i) pushText(src.slice(i, lt), i);

        if (src.startsWith('<!--', lt)) {
            const end = src.indexOf('-->', lt + 4);
            i = end === -1 ? src.length : end + 3;
            continue;
        }
        if (src.startsWith('<!', lt) || src.startsWith('<?', lt)) {
            const end = src.indexOf('>', lt);
            i = end === -1 ? src.length : end + 1;
            continue;
        }

        CLOSE.lastIndex = lt;
        const closing = CLOSE.exec(src);
        if (closing) {
            const tag = closing[1].toLowerCase();
            let up = current;
            while (up && up.tag !== tag) up = up.parent;
            if (up) current = up.parent;
            i = lt + closing[0].length;
            continue;
        }

        OPEN.lastIndex = lt;
        const opening = OPEN.exec(src);
        if (!opening) {
            pushText('<', lt);
            i = lt + 1;
            continue;
        }

        const tag = opening[1].toLowerCase();
        const attrSource = opening[2];
        const attrs = {};
        for (const m of attrSource.matchAll(ATTR)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
        const node = { tag, attrs, children: [], line: lineOf(lt), parent: current };
        current.children.push(node);
        i = lt + opening[0].length;

        if (RAW.has(tag)) {
            const end = lower.indexOf(`</${tag}`, i);
            const stop = end === -1 ? src.length : end;
            node.raw = src.slice(i, stop);
            node.rawLine = lineOf(i);
            const gt = src.indexOf('>', stop);
            i = gt === -1 ? src.length : gt + 1;
        } else if (!VOID.has(tag) && !/\/\s*$/.test(attrSource)) {
            current = node;
        }
    }
    return root;
}

function* descend(node) {
    for (const child of node.children ?? []) {
        yield child;
        if (isEl(child)) yield* descend(child);
    }
}
const elementsOf = (node) => [...descend(node)].filter(isEl);
const classesOf = (node) => (node.attrs.class ?? '').split(/\s+/).filter(Boolean);
const textOf = (node) => [...descend(node)].filter((n) => !isEl(n)).map((n) => n.text).join(' ').replace(/\s+/g, ' ').trim();
const hasAncestor = (node, tag) => {
    for (let up = node.parent; up; up = up.parent) if (up.tag === tag) return true;
    return false;
};

// ---------- CSS ----------

const tokenMaps = {
    colors: new Map(), fonts: new Map(), fontSizes: new Map(), spacing: new Map(), radii: new Map(), shadows: new Map(),
};
const variables = [];
const duplicateBodies = new Map();

function count(map, value, file) {
    const found = map.get(value) ?? { value, count: 0, files: new Set() };
    found.count++;
    found.files.add(file);
    map.set(value, found);
}

const normalizeColor = (color) => {
    const value = color.toLowerCase().replace(/\s+/g, '');
    const hex = /^#([0-9a-f]{3})$/.exec(value);
    return hex ? `#${[...hex[1]].map((c) => c + c).join('')}` : value;
};

// Divide por ';' respetando paréntesis y comillas (url(data:...;base64,...)).
function splitDeclarations(body) {
    const out = [];
    let depth = 0;
    let quote = '';
    let start = 0;
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (quote) {
            if (c === quote) quote = '';
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (c === ';' && depth === 0) {
            out.push(body.slice(start, i));
            start = i + 1;
        }
    }
    out.push(body.slice(start));
    return out.map((d) => d.trim()).filter(Boolean);
}

const COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\([^)]*\)/g;

function analyzeDeclarations(file, line, declarations) {
    for (const declaration of declarations) {
        const colon = declaration.indexOf(':');
        if (colon === -1) continue;
        const prop = declaration.slice(0, colon).trim().toLowerCase();
        const value = declaration.slice(colon + 1).replace(/!important/i, '').trim();
        if (/!important/i.test(declaration)) {
            add('important', 'medium', '`!important` en el CSS: indica guerra de especificidad; se corrige ordenando los selectores.', file, line);
        }
        if (prop.startsWith('--')) {
            variables.push({ name: prop, value, file });
            continue;
        }
        for (const color of value.match(COLOR) ?? []) count(tokenMaps.colors, normalizeColor(color), file);
        if (prop === 'font-family') count(tokenMaps.fonts, value, file);
        else if (prop === 'font-size') count(tokenMaps.fontSizes, value, file);
        else if (/^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(row-|column-)?gap$/.test(prop)) {
            for (const part of value.split(/\s+/)) if (/^-?[\d.]+(px|rem|em)$/.test(part)) count(tokenMaps.spacing, part, file);
        } else if (prop === 'border-radius') count(tokenMaps.radii, value, file);
        else if (prop === 'box-shadow' && value !== 'none') count(tokenMaps.shadows, value, file);
        if (/^(height)$/.test(prop) && /^[\d.]+px$/.test(value)) {
            add('fixed-height', 'medium', '`height` fijo en px: rompe con textos más largos o pantallas chicas; usa `min-height`, `aspect-ratio` o deja que crezca.', file, line);
        }
    }
}

function analyzeCss(file, text, baseLine = 1) {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const lineOf = lineIndex(clean);
    for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1].trim();
        const line = lineOf(m.index + m[0].indexOf(selector)) + baseLine - 1;
        if (selector.startsWith('@')) continue;
        const declarations = splitDeclarations(m[2]);
        analyzeDeclarations(file, line, declarations);

        if (/#[A-Za-z_][\w-]*/.test(selector)) {
            add('id-selector', 'low', 'Selector por `id`: especificidad alta y no reutilizable; usa clases.', file, line);
        }
        if (selector.split(',').some((s) => s.trim().split(/\s*[\s>+~]\s*/).filter(Boolean).length >= 4)) {
            add('deep-selector', 'low', 'Selector con 4 o más niveles: acopla el CSS a la estructura del HTML.', file, line);
        }
        if (declarations.length >= 3) {
            const body = declarations.map((d) => d.replace(/\s+/g, ' ')).sort().join(';');
            const group = duplicateBodies.get(body) ?? { selectors: new Set(), file, line };
            group.selectors.add(selector);
            duplicateBodies.set(body, group);
        }
    }
}

function analyzeInlineStyle(file, line, style) {
    analyzeDeclarations(file, line, splitDeclarations(style));
}

// ---------- JS ----------

const JS_CHECKS = [
    ['jquery', 'medium', 'jQuery: dependencia innecesaria; se reescribe en JS nativo dentro de `src/js/modules/`.', /\bjQuery\b|\$\(\s*['"`.#\w[<]|\$\.(?:ajax|get|post|each)\b/g],
    ['document-write', 'high', '`document.write`: bloquea el parseo y no pertenece a un tema.', /document\.write\s*\(/g],
    ['eval', 'high', '`eval`: riesgo de seguridad; se elimina.', /\beval\s*\(/g],
    ['inner-html', 'medium', 'Asignar `innerHTML`: riesgo de XSS si el contenido no es propio; usa `textContent` o nodos.', /\.innerHTML\s*\+?=/g],
    ['alert', 'low', '`alert()`: bloquea la página; se reemplaza por un mensaje en la interfaz.', /\balert\s*\(/g],
    ['console-log', 'low', '`console.log` olvidado.', /console\.(?:log|debug)\s*\(/g],
    ['var-declaration', 'low', '`var`: usa `const`/`let`.', /(?:^|[^\w.$])var\s+[\w$]/gm],
    ['global-function', 'low', 'Funciones globales (suelen llamarse desde `onclick=`): pasan a módulos con `addEventListener`.', /^function\s+[\w$]+/gm],
];

function analyzeJs(file, text, baseLine = 1) {
    const lineOf = lineIndex(text);
    for (const [id, severity, note, re] of JS_CHECKS) {
        for (const m of text.matchAll(re)) add(id, severity, note, file, lineOf(m.index) + baseLine - 1);
    }
}

// ---------- Páginas ----------

const INTERACTIVE = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);
const NON_CONTENT = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template']);
const FORM_SKIP = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
const FILTER_HINT = /\b(filters?|filtros?|facets?|search|buscador|busqueda|ordenar|sort)\b/i;
const PAGINATION_HINT = /\b(pagination|paginacion|paginador|page-numbers|load-more|cargar-mas)\b/i;
const COMMERCE_HINT = /\b(price|precio|add-to-cart|cart|carrito|checkout)\b/i;
const DYNAMIC_NAME = /(blog|noticia|news|articulo|post|producto|product|catalogo|tienda|shop|proyecto|portafolio|portfolio|propiedad|inmueble|evento|curso|carrito|cart|checkout|cuenta|account|buscar|search|categoria|category)/i;
const MODAL_HINT = /\b(modal|dialog|popup|lightbox|drawer|overlay)\b/i;
const ACCORDION_HINT = /\b(accordion|acordeon|faq|collapse)\b/i;
const SLIDER_HINT = /\b(swiper|slick|carousel|slider|splide|glide)\b/i;
const TABS_HINT = /\b(tabs?|tablist)\b/i;

const pages = [];
const interactions = [];
const dynamicHints = new Map(); // archivo -> motivos por los que parece contenido dinámico
const hintFor = (file) => dynamicHints.get(file) ?? dynamicHints.set(file, new Set()).get(file);
const signatureGroups = new Map();
const sigMemo = new WeakMap();

function signature(node) {
    if (sigMemo.has(node)) return sigMemo.get(node);
    const kids = node.children.filter((c) => isEl(c) && !NON_CONTENT.has(c.tag));
    const parts = kids.map(signature);
    const hasText = node.children.some((c) => !isEl(c));
    const result = {
        sig: `${node.tag}${classesOf(node).length ? '.' + classesOf(node).join('.') : ''}(${parts.map((p) => p.sig).join(',')})${hasText ? 't' : ''}`,
        size: 1 + parts.reduce((total, p) => total + p.size, 0),
    };
    sigMemo.set(node, result);
    return result;
}

function summarize(node) {
    const headings = [];
    const texts = [];
    const images = [];
    const links = [];
    const buttons = [];
    for (const child of descend(node)) {
        if (!isEl(child)) {
            if (texts.length < TEXT_CAP && !hasAncestor(child, 'script') && !hasAncestor(child, 'style')) {
                texts.push({ text: child.text, tag: child.parent.tag, line: child.line });
            }
            continue;
        }
        if (/^h[1-6]$/.test(child.tag)) headings.push({ level: Number(child.tag[1]), text: textOf(child), line: child.line });
        else if (child.tag === 'img') images.push({ src: child.attrs.src ?? '', alt: child.attrs.alt ?? null, line: child.line });
        else if (child.tag === 'a') links.push({ href: child.attrs.href ?? '', text: textOf(child), line: child.line });
        else if (child.tag === 'button') buttons.push({ text: textOf(child), line: child.line });
    }
    return { headings, texts, images, links, buttons };
}

function sectionRoots(container) {
    const visible = (n) => n.children.filter((c) => isEl(c) && !NON_CONTENT.has(c.tag));
    let kids = visible(container);
    for (let depth = 0; depth < 2 && kids.length === 1 && ['div', 'main', 'article'].includes(kids[0].tag); depth++) {
        const inner = visible(kids[0]);
        if (!inner.length) break;
        kids = inner;
    }
    return kids;
}

function isRemote(ref) {
    return !ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);
}

function checkReference(file, ref, line) {
    if (isRemote(ref)) return;
    const clean = decodeURI(ref.split(/[?#]/)[0]);
    if (!clean) return;
    const target = clean.startsWith('/') ? join(source, clean) : join(dirname(join(source, file)), clean);
    if (!existsSync(target)) {
        add('broken-reference', 'medium', 'Referencia a un archivo que no existe en la carpeta fuente.', file, line);
    }
}

function analyzeHtml({ file, full }) {
    const src = readFileSync(full, 'utf8');
    const root = parseHtml(src);
    const all = elementsOf(root);
    const html = all.find((n) => n.tag === 'html');
    const body = all.find((n) => n.tag === 'body') ?? root;

    const title = all.find((n) => n.tag === 'title');
    if (!title || !textOf(title)) add('no-title', 'medium', 'La página no tiene `<title>`.', file, 1);
    if (html && !html.attrs.lang) add('html-no-lang', 'medium', '`<html>` sin `lang`.', file, html.line);
    if (!all.some((n) => n.tag === 'meta' && n.attrs.name === 'viewport')) {
        add('no-viewport', 'medium', 'Falta `<meta name="viewport">`.', file, 1);
    }

    const labelFor = new Set(all.filter((n) => n.tag === 'label' && n.attrs.for).map((n) => n.attrs.for));
    const headings = all.filter((n) => /^h[1-6]$/.test(n.tag));
    const h1 = headings.filter((n) => n.tag === 'h1');
    if (h1.length !== 1) add('h1-count', 'medium', `La página debe tener un solo \`h1\` (tiene ${h1.length}).`, file, (h1[1] ?? headings[0] ?? { line: 1 }).line);
    let previous = 0;
    for (const heading of headings) {
        const level = Number(heading.tag[1]);
        if (previous && level > previous + 1) add('heading-skip', 'medium', 'Salto de nivel de encabezado (por ejemplo `h2` → `h4`): rompe la jerarquía para lectores de pantalla y SEO.', file, heading.line);
        previous = level;
    }

    const stylesheets = [];
    const scripts = [];
    const matched = new Map(); // tipo de interacción -> elementos ya detectados

    if (DYNAMIC_NAME.test(file.replace(/\.[^.]+$/, ''))) hintFor(file).add('nombre');

    for (const el of all) {
        const { attrs } = el;
        const classHint = `${attrs.class ?? ''} ${attrs.id ?? ''}`;
        if (PAGINATION_HINT.test(classHint)) hintFor(file).add('paginación');
        if (COMMERCE_HINT.test(classHint)) hintFor(file).add('comercio');
        if (attrs.style) {
            add('inline-style', 'medium', 'Atributo `style`: el estilo va en clases (Tailwind o CSS del proyecto).', file, el.line);
            analyzeInlineStyle(file, el.line, attrs.style);
        }
        for (const name of Object.keys(attrs)) {
            if (/^on[a-z]+$/.test(name)) add('inline-handler', 'high', 'Manejador de evento en el HTML (`onclick=…`): se mueve a un módulo JS con `addEventListener`.', file, el.line);
        }
        if ((attrs.onclick !== undefined || attrs.role === 'button') && !INTERACTIVE.has(el.tag)) {
            add('clickable-non-interactive', 'high', 'Elemento clicable que no es `button` ni `a`: no se alcanza con teclado ni lo anuncia el lector de pantalla.', file, el.line);
        }
        if (el.tag === 'img' && attrs.alt === undefined) add('img-no-alt', 'high', '`<img>` sin atributo `alt` (usa `alt=""` si es decorativa).', file, el.line);
        if (el.tag === 'a' && (attrs.href === undefined || attrs.href === '#' || /^javascript:/i.test(attrs.href))) {
            add('link-placeholder', 'medium', '`<a>` sin destino real (`#`, `javascript:` o sin `href`): si es una acción debe ser `button`.', file, el.line);
        }
        if (['input', 'select', 'textarea'].includes(el.tag) && !FORM_SKIP.has((attrs.type ?? '').toLowerCase())) {
            const labelled = attrs['aria-label'] || attrs['aria-labelledby'] || attrs.title || (attrs.id && labelFor.has(attrs.id)) || hasAncestor(el, 'label');
            if (!labelled) add('input-no-label', 'high', 'Campo de formulario sin `label` asociado.', file, el.line);
        }
        if (el.tag === 'div') {
            let depth = 0;
            for (let up = el.parent; up; up = up.parent) if (up.tag === 'div') depth++;
            if (depth === 8) {
                add('deep-nesting', 'low', 'Más de 8 `div` anidados: "div soup"; se aplana usando etiquetas semánticas.', file, el.line);
            }
        }
        if (el.tag === 'script') {
            if (attrs.src) {
                scripts.push(attrs.src);
                checkReference(file, attrs.src, el.line);
            } else if (el.raw?.trim()) {
                add('inline-script', 'medium', '`<script>` con código dentro del HTML: se mueve a `src/js/`.', file, el.line);
                analyzeJs(file, el.raw, el.rawLine);
            }
        }
        if (el.tag === 'style' && el.raw?.trim()) {
            add('inline-style-tag', 'medium', '`<style>` dentro del HTML: se mueve al CSS del proyecto.', file, el.line);
            analyzeCss(file, el.raw, el.rawLine);
        }
        if (el.tag === 'link' && (attrs.rel ?? '').includes('stylesheet') && attrs.href) {
            stylesheets.push(attrs.href);
            checkReference(file, attrs.href, el.line);
        }
        if (['img', 'source', 'video', 'audio'].includes(el.tag) && attrs.src) checkReference(file, attrs.src, el.line);
        if (el.tag === 'a' && attrs.href && !isRemote(attrs.href) && /\.(html?|pdf)(?:[?#]|$)/i.test(attrs.href)) checkReference(file, attrs.href, el.line);

        // Interacciones: un registro por contenedor (un acordeón con 5 `details` es una sola interacción).
        const hint = `${attrs.class ?? ''} ${attrs.id ?? ''}`;
        const type = el.tag === 'form' ? 'form'
            : el.tag === 'dialog' || attrs.role === 'dialog' || attrs['aria-modal'] === 'true' || MODAL_HINT.test(hint) ? 'modal'
            : el.tag === 'details' || ACCORDION_HINT.test(hint) ? 'accordion'
            : SLIDER_HINT.test(hint) ? 'slider'
            : attrs.role === 'tablist' || TABS_HINT.test(hint) ? 'tabs'
            : null;
        if (type) {
            const seen = matched.get(type) ?? new Set();
            let nested = false;
            for (let up = el.parent; up; up = up.parent) nested ||= seen.has(up);
            if (!nested) {
                seen.add(el);
                matched.set(type, seen);
                const entry = { type, file, line: el.line, suggestedSkill: { form: 'wp-form', modal: 'wp-modal', accordion: 'wp-accordion' }[type] ?? null };
                if (type === 'form') {
                    const controls = elementsOf(el).filter((n) => ['input', 'select', 'textarea'].includes(n.tag) && !FORM_SKIP.has((n.attrs.type ?? '').toLowerCase()));
                    entry.fields = controls.map((n) => ({ tag: n.tag, type: n.attrs.type ?? null, name: n.attrs.name ?? n.attrs.id ?? null, required: n.attrs.required !== undefined }));
                    // Un formulario que filtra un listado no es un formulario de envío: no va a wp-form.
                    const onlyPickers = controls.length > 0 && controls.every((n) => n.tag === 'select' || ['checkbox', 'radio', 'search', 'range'].includes((n.attrs.type ?? '').toLowerCase()));
                    if (FILTER_HINT.test(hint) || attrs.role === 'search' || (onlyPickers && (attrs.method ?? 'get').toLowerCase() === 'get')) {
                        entry.kind = 'filter';
                        entry.suggestedSkill = null;
                        hintFor(file).add('filtros');
                    }
                } else {
                    entry.hint = hint.trim() || el.tag;
                }
                interactions.push(entry);
            }
        }
    }

    // Secciones
    const main = all.find((n) => n.tag === 'main');
    const chrome = body.children.filter((n) => isEl(n) && ['header', 'footer', 'nav'].includes(n.tag));
    const roots = main ? [...chrome.filter((n) => n.tag !== 'footer'), ...sectionRoots(main), ...chrome.filter((n) => n.tag === 'footer')] : sectionRoots(body);
    const sections = roots.map((node, index) => ({
        index: index + 1,
        tag: node.tag,
        id: node.attrs.id ?? null,
        classes: classesOf(node),
        line: node.line,
        kind: ['header', 'footer', 'nav'].includes(node.tag) ? 'chrome' : 'section',
        ...summarize(node),
    }));

    // Firmas para bloques repetidos
    for (const el of all) {
        if (NON_CONTENT.has(el.tag) || ['html', 'head', 'body', 'main'].includes(el.tag)) continue;
        const { sig, size } = signature(el);
        if (size < 3) continue;
        const key = createHash('sha1').update(sig).digest('hex').slice(0, 8);
        const group = signatureGroups.get(key) ?? { key, size, members: [] };
        group.members.push({ node: el, file });
        signatureGroups.set(key, group);
    }

    pages.push({
        file,
        title: title ? textOf(title) : null,
        lang: html?.attrs.lang ?? null,
        h1: h1.map((n) => textOf(n)),
        stylesheets,
        scripts,
        sections,
    });
}

// ---------- Ejecución ----------

for (const entry of files.html) analyzeHtml(entry);

for (const entry of files.css) {
    const text = readFileSync(entry.full, 'utf8');
    analyzeCss(entry.file, text);
    const lineOf = lineIndex(text);
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        if (!m[1].startsWith('data:')) checkReference(entry.file, m[1], lineOf(m.index));
    }
}

for (const entry of files.js) analyzeJs(entry.file, readFileSync(entry.full, 'utf8'));

for (const [, group] of duplicateBodies) {
    if (group.selectors.size >= 3) {
        add('duplicate-declarations', 'low', 'Varios selectores con exactamente las mismas declaraciones: se resume en una clase o un token.', group.file, group.line);
    }
}

// Bloques repetidos: del más grande al más chico; se descarta lo que queda dentro de un bloque ya aceptado.
const accepted = new Set();
const repeated = [];
for (const group of [...signatureGroups.values()].sort((a, b) => b.size - a.size)) {
    const members = group.members.filter(({ node }) => {
        for (let up = node.parent; up; up = up.parent) if (accepted.has(up)) return false;
        return true;
    });
    if (members.length < 2) continue;
    members.forEach(({ node }) => accepted.add(node));
    const fileSet = [...new Set(members.map((m) => m.file))];
    const first = members[0].node;
    const perFile = new Map();
    for (const { file } of members) perFile.set(file, (perFile.get(file) ?? 0) + 1);
    for (const [file, n] of perFile) if (n >= 6) hintFor(file).add('repetidos');
    repeated.push({
        id: group.key,
        tag: first.tag,
        classes: classesOf(first),
        count: members.length,
        size: group.size,
        kind: fileSet.length > 1 ? 'cross-page' : 'in-page',
        files: fileSet,
        locations: members.slice(0, SAMPLE).map((m) => ({ file: m.file, line: m.node.line })),
        sample: textOf(first).slice(0, 80),
    });
}
repeated.sort((a, b) => b.count * b.size - a.count * a.size);

// Páginas que parecen listados, detalles o tienda: la skill las lista y el usuario dice qué son.
const dynamicCandidates = [...dynamicHints]
    .filter(([, reasons]) => reasons.size > 0)
    .map(([file, reasons]) => ({ file, reasons: [...reasons] }));

const top = (map) => [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP)
    .map(({ value, count: n, files: where }) => ({ value, count: n, files: [...where].slice(0, 5) }));

const severityRank = { high: 0, medium: 1, low: 2 };
const sortedFindings = [...findings.values()].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count);

const report = {
    ok: true,
    source,
    summary: {
        pages: files.html.length,
        css: files.css.length,
        js: files.js.length,
        images: files.image.length,
        fonts: files.font.length,
        sections: pages.reduce((total, p) => total + p.sections.length, 0),
        repeatedGroups: repeated.length,
        interactions: interactions.length,
        dynamicCandidates: dynamicCandidates.length,
        findings: sortedFindings.reduce((total, f) => total + f.count, 0),
    },
    pages,
    assets: {
        css: files.css.map((f) => f.file),
        js: files.js.map((f) => f.file),
        images: files.image.map((f) => ({ file: f.file, bytes: f.size })),
        fonts: files.font.map((f) => f.file),
    },
    tokens: {
        colors: top(tokenMaps.colors),
        fonts: top(tokenMaps.fonts),
        fontSizes: top(tokenMaps.fontSizes),
        spacing: top(tokenMaps.spacing),
        radii: top(tokenMaps.radii),
        shadows: top(tokenMaps.shadows),
        variables: variables.slice(0, 100),
    },
    repeated: repeated.slice(0, 40),
    interactions,
    dynamicCandidates,
    findings: sortedFindings,
    skipped,
};

const json = JSON.stringify(report, null, 2);
if (args.out) writeFileSync(resolve(args.out), json + '\n');
console.log(json);
