#!/usr/bin/env node
// Auditoría estática de los acordeones de una página (skill wp-accordion). Sin dependencias.
//
// Uso:
//   node check.mjs <url | archivo.html> [--json]
//   node check.mjs --self-test
//
// Lee el HTML ya renderizado (una URL o un archivo guardado) y revisa cada <details data-accordion-item>
// y su contenedor [data-accordion]. Las reglas están explicadas en references/accessibility.md.
// Códigos de salida: 0 sin errores (puede haber avisos), 1 con errores o entrada inválida.
// Lo que no se ve en el HTML (foco, contraste, lector de pantalla, animación) está en references/acceptance.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const INTERACTIVE = new Set(['a', 'button', 'input', 'select', 'textarea']);

// ---------- Lectura del HTML ----------

function tokenize(html) {
    // Se rellenan con espacios (no se borran) para conservar las posiciones.
    const blank = (m) => ' '.repeat(m.length);
    const clean = html
        .replace(/<!--[\s\S]*?-->/g, blank)
        .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, blank);

    const tags = [];
    const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
    for (const m of clean.matchAll(tagRe)) {
        const attrs = {};
        for (const a of m[3].matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
            attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
        }
        tags.push({
            name: m[2].toLowerCase(),
            closing: m[1] === '/',
            attrs,
            start: m.index,
            end: m.index + m[0].length,
        });
    }
    return { clean, tags };
}

const textBetween = (clean, from, to) => clean.slice(from, to).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Etiqueta de cierre que corresponde a `el` (cuenta las anidadas del mismo nombre).
function closeOf(tags, el) {
    if (VOID.has(el.name)) return null;
    let depth = 0;
    for (const t of tags) {
        if (t.start < el.start || t.name !== el.name) continue;
        depth += t.closing ? -1 : 1;
        if (depth === 0) return t;
    }
    return null;
}

// ---------- Auditoría ----------

export function audit(html) {
    const { clean, tags } = tokenize(html);
    const open = tags.filter((t) => !t.closing);
    const findings = [];
    const add = (level, rule, message, where) => findings.push({ level, rule, message, where });

    // Cada elemento con su cierre y las etiquetas de apertura que contiene.
    const span = (el) => {
        const close = closeOf(tags, el);
        const to = close ? close.start : clean.length;
        return { el, close, to, children: open.filter((t) => t.start >= el.end && t.start < to) };
    };

    const containers = open.filter((t) => 'data-accordion' in t.attrs).map(span);
    const items = open.filter((t) => t.name === 'details' && 'data-accordion-item' in t.attrs).map(span);

    const ids = new Map();
    for (const t of open) {
        if (t.attrs.id) ids.set(t.attrs.id, (ids.get(t.attrs.id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
        if (count > 1) add('error', 'duplicate-id', `El id "${id}" aparece ${count} veces.`, `#${id}`);
    }

    for (const d of items) {
        const a = d.el.attrs;
        const where = `#${a.id ?? '(sin id)'}`;
        const first = d.children[0];

        if (first?.name !== 'summary') {
            add('error', 'no-summary', 'El <details> no empieza con un <summary>: el navegador inventaría uno que dice "Detalles".', where);
            continue;
        }

        const summary = span(first);
        const label = first.attrs['aria-label']?.trim() || textBetween(clean, first.end, summary.to);
        if (!label) add('error', 'no-title', 'El <summary> no tiene texto: el botón no tiene nombre accesible.', where);

        for (const t of summary.children) {
            if (INTERACTIVE.has(t.name)) add('error', 'summary-interactive', `<${t.name}> dentro del <summary>: es un elemento interactivo dentro de un botón. Muévelo al panel.`, where);
            if (t.name === 'h1') add('error', 'h1-inside', 'Hay un <h1> dentro del acordeón: la página ya tiene el suyo.', where);
        }

        // Contenido del ítem: todo lo que sigue al <summary>.
        const panel = d.children.filter((t) => t.start >= summary.to);
        for (const t of panel) {
            if (t.name === 'h1') add('error', 'h1-inside', 'Hay un <h1> dentro del acordeón: la página ya tiene el suyo.', where);

            const style = (t.attrs.style ?? '').replace(/\s+/g, '').toLowerCase();
            if (('hidden' in t.attrs && t.attrs.hidden !== 'until-found') || /display:none|visibility:hidden/.test(style)) {
                add('error', 'panel-hidden', `<${t.name}> oculto dentro de un panel: no se alcanza ni con el ítem abierto. Deja que el <details> cerrado lo oculte.`, where);
            }
            if (t.name === 'img') {
                if (!('alt' in t.attrs)) add('error', 'img-alt', `<img src="${t.attrs.src ?? ''}"> sin alt (vacío si es decorativa).`, where);
                if (t.attrs.loading !== 'lazy') add('warn', 'lazy', `<img src="${t.attrs.src ?? ''}"> sin loading="lazy": se descarga aunque el ítem esté cerrado.`, where);
            }
            if (t.name === 'iframe') {
                if (!t.attrs.title?.trim()) add('error', 'iframe-title', '<iframe> sin title.', where);
                if (t.attrs.loading !== 'lazy') add('warn', 'lazy', '<iframe> sin loading="lazy": se carga aunque el ítem esté cerrado.', where);
            }
        }

        for (const t of d.children) {
            if (t.attrs.tabindex && Number(t.attrs.tabindex) > 0) add('error', 'tabindex', `tabindex="${t.attrs.tabindex}" dentro de un acordeón: rompe el orden natural del foco.`, where);
        }
    }

    for (const c of containers) {
        const group = items.filter((d) => d.el.start >= c.el.end && d.el.start < c.to);
        const where = `#${c.el.attrs.id ?? '(sin id)'}`;

        if ('data-exclusive' in c.el.attrs) {
            if (group.some((d) => !d.el.attrs.name)) add('error', 'no-name', 'Acordeón exclusivo con ítems sin atributo name: se abrirían varios a la vez. Usa la opción exclusive.', where);
            else if (group.filter((d) => 'open' in d.el.attrs).length > 1) add('warn', 'exclusive-open', 'Acordeón exclusivo con más de un ítem abierto al inicio: el navegador solo deja uno.', where);
        }
        if (group.length >= 3 && group.every((d) => 'open' in d.el.attrs)) add('warn', 'all-open', 'Todos los ítems empiezan abiertos: el acordeón no cumple su función.', where);
    }

    // ARIA a mano: un acordeón armado con div, role="button" y aria-expanded.
    for (const t of open) {
        const native = ['button', 'summary', 'a', 'input', 'select', 'details'].includes(t.name);
        if (!native && ('aria-expanded' in t.attrs || t.attrs.role === 'button') && 'aria-controls' in t.attrs) {
            add('error', 'aria-div', `<${t.name}> con aria-expanded/aria-controls armado a mano: usa un <details> con su <summary>.`, `<${t.name}>`);
        }
    }

    return { accordions: containers.length, items: items.length, findings };
}

// ---------- Entrada y salida ----------

async function load(input) {
    if (/^https?:\/\//i.test(input)) {
        const res = await fetch(input, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`${input} respondió ${res.status}.`);
        return res.text();
    }
    return readFileSync(input, 'utf8');
}

function report({ accordions, items, findings }, json) {
    const errors = findings.filter((f) => f.level === 'error');
    if (json) {
        console.log(JSON.stringify({ ok: errors.length === 0 && items > 0, accordions, items, findings }, null, 2));
    } else {
        for (const f of findings) console.log(`${f.level === 'error' ? 'ERROR' : 'AVISO'} [${f.rule}] ${f.message} (${f.where})`);
        console.log(`\n${accordions} acordeón(es), ${items} ítem(s) revisado(s): ${errors.length} error(es), ${findings.length - errors.length} aviso(s).`);
    }
    return errors.length === 0 && items > 0;
}

async function selfTest() {
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
    const ok = audit(readFileSync(join(dir, 'ok.html'), 'utf8'));
    const bad = readFileSync(join(dir, 'bad.html'), 'utf8');
    const badResult = audit(bad);

    const expected = new Set(/<!--\s*expect:\s*([\w,\s-]+?)\s*-->/.exec(bad)[1].split(/[,\s]+/).filter(Boolean));
    const got = new Set(badResult.findings.map((f) => f.rule));
    const missing = [...expected].filter((r) => !got.has(r));
    const extra = [...got].filter((r) => !expected.has(r));
    const okErrors = ok.findings.filter((f) => f.level === 'error');

    const problems = [];
    if (okErrors.length) problems.push(`ok.html no debería tener errores: ${okErrors.map((f) => f.rule).join(', ')}`);
    if (ok.findings.length) problems.push(`ok.html no debería tener avisos: ${ok.findings.map((f) => f.rule).join(', ')}`);
    if (ok.items < 1) problems.push('ok.html no tiene ningún ítem');
    if (missing.length) problems.push(`bad.html no detectó: ${missing.join(', ')}`);
    if (extra.length) problems.push(`bad.html detectó de más: ${extra.join(', ')}`);

    if (problems.length) {
        console.log(`self-test FALLÓ\n- ${problems.join('\n- ')}`);
        process.exit(1);
    }
    console.log(`self-test ok: ok.html limpio (${ok.accordions} acordeones, ${ok.items} ítems), bad.html detecta ${expected.size} reglas.`);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
    await selfTest();
} else {
    const input = args.find((a) => !a.startsWith('--'));
    if (!input) {
        console.error('Uso: node check.mjs <url | archivo.html> [--json]   |   node check.mjs --self-test');
        process.exit(1);
    }
    let html;
    try {
        html = await load(input);
    } catch (e) {
        console.error(`No pude leer ${input}: ${e.message}`);
        process.exit(1);
    }
    const result = audit(html);
    if (result.items === 0) console.error('No hay ningún <details data-accordion-item> en esa página: ¿es la URL correcta y el acordeón se imprime en el HTML?');
    process.exit(report(result, args.includes('--json')) ? 0 : 1);
}
