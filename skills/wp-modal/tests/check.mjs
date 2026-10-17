#!/usr/bin/env node
// Auditoría estática de los modales de una página (skill wp-modal). Sin dependencias.
//
// Uso:
//   node check.mjs <url | archivo.html> [--json]
//   node check.mjs --self-test
//
// Lee el HTML ya renderizado (una URL o un archivo guardado) y revisa cada <dialog data-modal>
// y sus disparadores. Las reglas están explicadas en references/accessibility.md.
// Códigos de salida: 0 sin errores (puede haber avisos), 1 con errores o entrada inválida.
// Lo que no se ve en el HTML (foco, animación, móvil) está en references/acceptance.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

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

// Texto de un elemento: hasta la primera etiqueta de cierre del mismo nombre.
function textOf(clean, tags, el) {
    const close = tags.find((t) => t.closing && t.name === el.name && t.start >= el.end);
    return close ? textBetween(clean, el.end, close.start) : '';
}

// ---------- Auditoría ----------

export function audit(html) {
    const { clean, tags } = tokenize(html);
    const open = tags.filter((t) => !t.closing);
    const findings = [];
    const add = (level, rule, message, where) => findings.push({ level, rule, message, where });

    // Elementos dentro de cada <dialog> (pila por si hubiera anidados).
    const dialogs = [];
    const stack = [];
    for (const tag of tags) {
        if (tag.name === 'dialog') {
            if (tag.closing) {
                const d = stack.pop();
                if (d) d.end = tag.start;
            } else {
                const d = { el: tag, children: [], end: clean.length };
                dialogs.push(d);
                stack.push(d);
            }
            continue;
        }
        if (!tag.closing) for (const d of stack) d.children.push(tag);
    }

    const ids = new Map();
    for (const t of open) {
        if (t.attrs.id) ids.set(t.attrs.id, (ids.get(t.attrs.id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
        if (count > 1) add('error', 'duplicate-id', `El id "${id}" aparece ${count} veces.`, `#${id}`);
    }

    const byId = (id) => open.find((t) => t.attrs.id === id);
    const accessibleName = (el) => {
        if (el.attrs['aria-label']?.trim()) return el.attrs['aria-label'].trim();
        if (el.attrs['aria-labelledby']) {
            const ref = byId(el.attrs['aria-labelledby'].split(/\s+/)[0]);
            if (ref) return textOf(clean, tags, ref);
        }
        return textOf(clean, tags, el) || el.attrs.title?.trim() || '';
    };

    const engineDialogs = dialogs.filter((d) => 'data-modal' in d.el.attrs);
    for (const d of dialogs.filter((x) => !('data-modal' in x.el.attrs))) {
        add('warn', 'dialog-no-engine', '<dialog> sin data-modal: no lo gestiona el motor (clic fuera, apertura automática).', `#${d.el.attrs.id ?? '(sin id)'}`);
    }

    for (const d of engineDialogs) {
        const a = d.el.attrs;
        const where = `#${a.id ?? '(sin id)'}`;

        if (!a.id) add('error', 'no-id', 'El <dialog> no tiene id: no se puede abrir.', where);
        if ('open' in a) add('error', 'open-attr', 'El <dialog> trae el atributo open: se mostraría como no modal y sin foco atrapado. Ábrelo con un disparador.', where);

        const labelled = a['aria-labelledby'] ? byId(a['aria-labelledby']) : null;
        const inside = labelled && d.children.includes(labelled);
        if (!a['aria-labelledby'] && !a['aria-label']) add('error', 'no-name', 'El modal no tiene nombre accesible (aria-labelledby o aria-label).', where);
        else if (a['aria-labelledby'] && !inside) add('error', 'no-name', `aria-labelledby="${a['aria-labelledby']}" no apunta a un elemento dentro del modal.`, where);
        else if (inside && !textOf(clean, tags, labelled)) add('error', 'no-name', 'El elemento al que apunta aria-labelledby está vacío.', where);

        if (a['aria-describedby'] && !d.children.some((t) => t.attrs.id === a['aria-describedby'])) {
            add('error', 'bad-describedby', `aria-describedby="${a['aria-describedby']}" no apunta a un elemento dentro del modal.`, where);
        }

        if (d.children.some((t) => t.name === 'h1')) add('error', 'h1-inside', 'Hay un <h1> dentro del modal: la página ya tiene el suyo.', where);

        // Botones que cierran: command="close" o dentro de un <form method="dialog">.
        const dialogForms = d.children
            .filter((t) => t.name === 'form' && (t.attrs.method ?? '').toLowerCase() === 'dialog')
            .map((form) => ({ from: form.end, to: tags.find((t) => t.closing && t.name === 'form' && t.start >= form.end)?.start ?? clean.length }));
        const closeButtons = d.children.filter((t) => t.name === 'button'
            && (['close', 'request-close'].includes(t.attrs.command) || dialogForms.some((r) => t.start >= r.from && t.start < r.to)));
        if (!closeButtons.length) {
            add('error', 'no-close', 'No hay un botón para cerrar: falta un <form method="dialog"> con un botón, o un botón con command="close".', where);
        } else if (!closeButtons.some((b) => accessibleName(b))) {
            add('error', 'no-close', 'El botón de cerrar no tiene nombre accesible (aria-label o texto).', where);
        }

        for (const t of d.children) {
            if (t.name === 'img') {
                if (!('alt' in t.attrs)) add('error', 'img-alt', `<img src="${t.attrs.src ?? ''}"> sin alt (vacío si es decorativa).`, where);
                if (t.attrs.loading !== 'lazy') add('warn', 'lazy', `<img src="${t.attrs.src ?? ''}"> sin loading="lazy": se descarga aunque el modal esté cerrado.`, where);
            }
            if (t.name === 'iframe') {
                if (!t.attrs.title?.trim()) add('error', 'iframe-title', '<iframe> sin title.', where);
                if (t.attrs.loading !== 'lazy') add('warn', 'lazy', '<iframe> sin loading="lazy": se carga aunque el modal esté cerrado.', where);
            }
        }

        if (a.role === 'alertdialog') {
            if (!d.children.some((t) => 'autofocus' in t.attrs)) add('warn', 'alert-autofocus', 'alertdialog sin autofocus: pon el foco inicial en el botón menos destructivo.', where);
            if (a['data-backdrop-close'] === 'true') add('warn', 'alert-backdrop', 'alertdialog que se cierra con clic fuera: debería exigir una decisión.', where);
        }

        if (a['data-modal-auto']) add('warn', 'auto-open', `Apertura automática (${a['data-modal-auto']}): confirma que el proyecto la pidió y revisa el riesgo en móvil.`, where);
    }

    for (const t of open) {
        if (t.attrs.tabindex && Number(t.attrs.tabindex) > 0 && dialogs.some((d) => d.children.includes(t))) {
            add('error', 'tabindex', `tabindex="${t.attrs.tabindex}" dentro de un modal: rompe el orden natural del foco.`, `<${t.name}>`);
        }
        if ((t.attrs.role === 'dialog' || t.attrs.role === 'alertdialog') && t.name !== 'dialog') {
            add('error', 'role-div', `<${t.name} role="${t.attrs.role}"> en vez de un <dialog> nativo.`, `<${t.name}>`);
        }
    }

    const dialogIds = new Set(engineDialogs.map((d) => d.el.attrs.id).filter(Boolean));
    for (const t of open) {
        const targets = [t.attrs['data-modal-open'], t.attrs.commandfor].filter(Boolean);
        for (const target of new Set(targets)) {
            if (!dialogIds.has(target)) add('error', 'trigger-target', `El disparador <${t.name}> apunta a "${target}", que no es un modal de la página.`, `<${t.name} data-modal-open="${target}">`);
        }
        if (targets.length && t.name === 'button' && !t.attrs.type) add('warn', 'trigger-type', `<button> disparador de "${targets[0]}" sin type="button": enviaría el formulario donde esté.`, `[${targets[0]}]`);
        if (targets.length && t.name === 'a' && (!t.attrs.href || t.attrs.href === '#')) add('warn', 'href-hash', `Disparador <a> de "${targets[0]}" sin una URL real: no se puede rastrear ni funciona sin JavaScript.`, `[${targets[0]}]`);
    }

    return { dialogs: engineDialogs.length, findings };
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

function report({ dialogs, findings }, json) {
    const errors = findings.filter((f) => f.level === 'error');
    if (json) {
        console.log(JSON.stringify({ ok: errors.length === 0 && dialogs > 0, dialogs, findings }, null, 2));
    } else {
        for (const f of findings) console.log(`${f.level === 'error' ? 'ERROR' : 'AVISO'} [${f.rule}] ${f.message} (${f.where})`);
        console.log(`\n${dialogs} modal(es) revisado(s): ${errors.length} error(es), ${findings.length - errors.length} aviso(s).`);
    }
    return errors.length === 0 && dialogs > 0;
}

async function selfTest() {
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
    const ok = audit(readFileSync(join(dir, 'ok.html'), 'utf8'));
    const bad = readFileSync(join(dir, 'bad.html'), 'utf8');
    const bad_result = audit(bad);

    const expected = new Set(/<!--\s*expect:\s*([\w,\s-]+?)\s*-->/.exec(bad)[1].split(/[,\s]+/).filter(Boolean));
    const got = new Set(bad_result.findings.map((f) => f.rule));
    const missing = [...expected].filter((r) => !got.has(r));
    const extra = [...got].filter((r) => !expected.has(r));
    const okErrors = ok.findings.filter((f) => f.level === 'error');

    const problems = [];
    if (okErrors.length) problems.push(`ok.html no debería tener errores: ${okErrors.map((f) => f.rule).join(', ')}`);
    if (ok.dialogs < 1) problems.push('ok.html no tiene ningún modal');
    if (missing.length) problems.push(`bad.html no detectó: ${missing.join(', ')}`);
    if (extra.length) problems.push(`bad.html detectó de más: ${extra.join(', ')}`);

    if (problems.length) {
        console.log(`self-test FALLÓ\n- ${problems.join('\n- ')}`);
        process.exit(1);
    }
    console.log(`self-test ok: ok.html limpio (${ok.dialogs} modales), bad.html detecta ${expected.size} reglas.`);
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
    if (result.dialogs === 0) console.error('No hay ningún <dialog data-modal> en esa página: ¿es la URL correcta y el modal se imprime en el HTML?');
    process.exit(report(result, args.includes('--json')) ? 0 : 1);
}
