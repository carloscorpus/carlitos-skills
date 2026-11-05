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

// Devuelve { page, frame, sections, pending, errors, warnings }. `slug` es el nombre del archivo sin .md.
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
    let sectionsHeadingSeen = false;
    const sections = [];
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
            sectionsHeadingSeen = true;
            return;
        }
        if (/^#{1,6}\s/.test(line)) {
            inSections = false;
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
        const item = /^[-*]\s+([^:]+?)\s*:\s*(.*)$/.exec(line);
        if (!item) return error(n, `No se entiende la línea "${line}": cada sección va como "- nombre: link".`);
        const [, name, value] = item;
        if (!SLUG.test(name)) {
            const hint = /\s/.test(name) ? ' ¿Falta ":" después del nombre?' : '';
            return error(n, `Nombre de sección inválido "${name}": minúsculas, números y guiones, empieza con letra, sin tildes.${hint}`);
        }
        if (names.has(name)) error(n, `La sección "${name}" ya está en la línea ${names.get(name)}.`);
        else names.set(name, n);
        if (PENDING.test(value.trim())) {
            sections.push({ name, pending: true, line: n });
            return;
        }
        const url = FIRST_URL.exec(value)?.[0];
        if (!url) return error(n, `La sección "${name}" necesita un link de Figma (o "pendiente").`);
        const parsed = parseFigmaUrl(url);
        if (parsed.error) return error(n, `Sección "${name}": ${parsed.error}`);
        const key = `${parsed.fileKey}/${parsed.nodeId}`;
        if (nodes.has(key)) error(n, `La sección "${name}" apunta al mismo frame que "${nodes.get(key)}".`);
        else nodes.set(key, name);
        sections.push({ name, ...parsed, url, line: n });
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
    }

    return {
        page: slug,
        frame,
        pending: framePending,
        sections,
        errors,
        warnings,
    };
}
