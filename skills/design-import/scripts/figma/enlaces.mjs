// Lee y valida un archivo de specs/figma/enlaces/<página>.md. Sin dependencias y sin llamar a Figma: solo texto.
// Lo usan figma-links.mjs (el validador) y, en la lectura, quien necesite saber qué frames tiene una página.

export const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FILE_KEY = /^[0-9a-zA-Z]{22,128}$/;
const NODE_ID = /^\d+[:-]\d+$/;

// Interpreta un link de Figma. Devuelve { fileKey, nodeId } (nodeId con ":" como pide el MCP) o { error }.
export function parseFigmaUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        return { error: `"${raw}" no es un link.` };
    }
    if (!/^(www\.)?figma\.com$/.test(url.hostname)) return { error: `El link no es de figma.com (${url.hostname}).` };
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const kind = parts[0];
    if (['make', 'board', 'slides', 'proto'].includes(kind)) {
        return { error: `Un link de "${kind}" no sirve: hace falta el de un archivo de diseño (figma.com/design/...).` };
    }
    if (!['design', 'file'].includes(kind)) return { error: 'El link no es de un archivo de diseño (figma.com/design/<archivo>/...).' };
    // En una rama (/design/<archivo>/branch/<rama>/...) la clave del archivo es la de la rama.
    const fileKey = parts[2] === 'branch' ? parts[3] : parts[1];
    if (!fileKey || !FILE_KEY.test(fileKey)) return { error: 'No se reconoce la clave del archivo en el link.' };
    const nodeRaw = url.searchParams.get('node-id');
    if (!nodeRaw) return { error: 'El link no trae node-id: copia el link del frame (clic derecho > Copy link to selection).' };
    if (!NODE_ID.test(nodeRaw)) return { error: `El node-id "${nodeRaw}" no es válido (se espera algo como 3638-2095).` };
    return { fileKey, nodeId: nodeRaw.replace('-', ':') };
}

// Quita los comentarios HTML dejando los mismos saltos de línea, para que los números de línea no cambien.
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));

const PENDING = /^(pendiente|ninguno|-|)$/i;
const FIRST_URL = /https?:\/\/[^\s)>\]]+/;

// Debajo de una sección, con sangría, van sus extras: "- móvil: <link>" (el frame de la versión móvil, opcional) y
// sus notas ("- nota: <texto>" o cualquier otra línea con sangría). Las notas de toda la página van en "## Notas".
// Las notas las escribe el usuario: son indicaciones que no se deducen del diseño y pasan tal cual al spec.
const MOBILE_KEY = /^(m[oó]vil|mobile)$/i;
const NOTE_KEY = /^notas?$/i;
const BULLET = /^[-*]\s+(.*)$/;

// Devuelve { page, frame, notes, sections, pending, errors, warnings }. `slug` es el nombre del archivo sin .md.
// Cada sección: { name, fileKey, nodeId, url, line, mobile, notes } o, si está pendiente, { name, pending, line, mobile, notes }.
export function parseEnlaces(text, slug) {
    const errors = [];
    const warnings = [];
    const error = (line, message) => errors.push({ line, message });
    const warn = (line, message) => warnings.push({ line, message });
    const lines = stripComments(text.replace(/\r\n/g, '\n')).split('\n');

    if (!SLUG.test(slug) || slug.startsWith('_')) {
        error(1, `El nombre del archivo "${slug}.md" no es un slug de página válido: minúsculas, números y guiones, empieza con letra.`);
    }

    let title = null;
    let frame = null;
    let frameLine = null;
    let framePending = false;
    let inSections = false;
    let inNotes = false;
    let sectionsHeadingSeen = false;
    const notes = [];
    const sections = [];
    let current = null; // la última sección leída, para sus líneas con sangría
    const names = new Map();
    const nodes = new Map();

    lines.forEach((raw, index) => {
        const n = index + 1;
        const line = raw.trim();
        if (!line) return;

        const heading = /^#\s+Figma:\s*(.+)$/.exec(line);
        if (heading) {
            title = heading[1].trim();
            if (title !== slug) error(n, `El título dice "${title}" pero el archivo es "${slug}.md": deben coincidir.`);
            return;
        }
        if (/^##\s+Secciones\s*$/i.test(line)) {
            inSections = true;
            inNotes = false;
            sectionsHeadingSeen = true;
            return;
        }
        if (/^##\s+Notas\s*$/i.test(line)) {
            inNotes = true;
            inSections = false;
            return;
        }
        if (/^#{1,6}\s/.test(line)) {
            inSections = false;
            inNotes = false;
            return;
        }

        // Notas de la página: una por viñeta; una línea sin viñeta sigue la nota anterior.
        if (inNotes) {
            const bullet = BULLET.exec(line);
            if (bullet || !notes.length) notes.push((bullet ? bullet[1] : line).trim());
            else notes[notes.length - 1] += ` ${line}`;
            return;
        }

        // Con sangría bajo una sección: su móvil o sus notas.
        if (inSections && /^[ \t]+\S/.test(raw)) {
            if (!current) return error(n, 'Una línea con sangría va debajo de una sección ("- nombre: link").');
            const bullet = BULLET.exec(line);
            if (!bullet) {
                if (!current.notes.length) return error(n, `No se entiende la línea "${line}": las notas de una sección van como "- nota: texto", con sangría.`);
                current.notes[current.notes.length - 1] += ` ${line}`;
                return;
            }
            const keyed = /^([^:]+?)\s*:\s*(.*)$/.exec(bullet[1]);
            if (keyed && MOBILE_KEY.test(keyed[1])) {
                if (current.mobile) return error(n, `La sección "${current.name}" ya tiene link de móvil (línea ${current.mobile.line}).`);
                const url = FIRST_URL.exec(keyed[2])?.[0];
                if (!url) return error(n, `Móvil de "${current.name}": hace falta el link del frame móvil.`);
                const parsed = parseFigmaUrl(url);
                if (parsed.error) return error(n, `Móvil de "${current.name}": ${parsed.error}`);
                const key = `${parsed.fileKey}/${parsed.nodeId}`;
                if (nodes.has(key)) return error(n, `El móvil de "${current.name}" apunta al mismo frame que "${nodes.get(key)}".`);
                nodes.set(key, `${current.name} (móvil)`);
                current.mobile = { ...parsed, url, line: n };
                return;
            }
            const note = (keyed && NOTE_KEY.test(keyed[1]) ? keyed[2] : bullet[1]).trim();
            if (!note) return error(n, `Nota vacía en la sección "${current.name}".`);
            current.notes.push(note);
            return;
        }

        const frameMatch = /^[-*]\s+\*\*Frame de la página:\*\*\s*(.*)$/.exec(line);
        if (frameMatch) {
            frameLine = n;
            const value = frameMatch[1].trim();
            if (PENDING.test(value)) {
                framePending = true;
                return;
            }
            const url = FIRST_URL.exec(value)?.[0];
            if (!url) return error(n, 'El frame de la página debe ser un link de Figma (o "pendiente").');
            const parsed = parseFigmaUrl(url);
            if (parsed.error) return error(n, parsed.error);
            frame = { ...parsed, url, line: n };
            return;
        }

        if (!inSections) return;
        // Una sección con error deja `current` en un objeto suelto: sus líneas con sangría no se pegan a la anterior.
        current = { name: null, mobile: null, notes: [] };
        const item = /^[-*]\s+([^:]+?)\s*:\s*(.*)$/.exec(line);
        if (!item) return error(n, `No se entiende la línea "${line}": cada sección va como "- nombre: link".`);
        const [, name, value] = item;
        current.name = name;
        if (!SLUG.test(name)) {
            const hint = /\s/.test(name) ? ' ¿Falta ":" después del nombre?' : '';
            return error(n, `Nombre de sección inválido "${name}": minúsculas, números y guiones, empieza con letra, sin tildes.${hint}`);
        }
        if (names.has(name)) error(n, `La sección "${name}" ya está en la línea ${names.get(name)}.`);
        else names.set(name, n);
        if (PENDING.test(value.trim())) {
            current = { name, pending: true, line: n, mobile: null, notes: [] };
            sections.push(current);
            return;
        }
        const url = FIRST_URL.exec(value)?.[0];
        if (!url) return error(n, `La sección "${name}" necesita un link de Figma (o "pendiente").`);
        const parsed = parseFigmaUrl(url);
        if (parsed.error) return error(n, `Sección "${name}": ${parsed.error}`);
        const key = `${parsed.fileKey}/${parsed.nodeId}`;
        if (nodes.has(key)) error(n, `La sección "${name}" apunta al mismo frame que "${nodes.get(key)}".`);
        else nodes.set(key, name);
        current = { name, ...parsed, url, line: n, mobile: null, notes: [] };
        sections.push(current);
    });

    if (title === null) error(1, 'Falta el título "# Figma: <página>".');
    if (frameLine === null) error(1, 'Falta la línea "- **Frame de la página:** <link>".');
    if (!sectionsHeadingSeen) error(1, 'Falta el apartado "## Secciones" (puede quedar vacío).');

    if (frame) {
        for (const s of sections) {
            if (s.pending) continue;
            if (s.fileKey !== frame.fileKey) warn(s.line, `La sección "${s.name}" es de otro archivo de Figma que la página.`);
            else if (s.nodeId === frame.nodeId) warn(s.line, `La sección "${s.name}" es el frame completo de la página: solo tiene sentido si la página tiene una única sección.`);
        }
        for (const s of sections) {
            if (s.mobile && s.mobile.fileKey !== frame.fileKey) warn(s.mobile.line, `El móvil de "${s.name}" es de otro archivo de Figma que la página.`);
        }
    }
    // Espacios de más (o de líneas unidas) no cuentan.
    const clean = (list) => list.splice(0, list.length, ...list.map((note) => note.replace(/\s+/g, ' ').trim()));
    clean(notes);
    for (const s of sections) clean(s.notes);

    return {
        page: slug,
        frame,
        notes,
        pending: framePending,
        sections,
        errors,
        warnings,
    };
}
