// Borradores del manual (specs/manual/<capítulo>.md): el texto que Claude redacta y la persona revisa.
// Formato en references/borrador.md. Sin dependencias.

import { flatten } from './acf.mjs';

export const PENDIENTE = 'PENDIENTE';
const KIND_LABEL = { opciones: 'opciones', pagina: 'página', contenido: 'contenido', sitio: 'sitio', extra: 'extra' };

// `- **Incluir:** no` en la cabecera de un borrador quita ese capítulo del manual.
export const incluido = (borrador) => !/^(no|false|0)$/i.test(borrador?.meta?.Incluir?.trim() ?? '');

// Textos fijos del capítulo "Menús y logo": son pantallas de WordPress, iguales en todos los proyectos.
export const RESUMEN_SITIO = {
    menus: 'En **Apariencia › Menús** elige el menú en «Seleccionar el menú a editar». Agrega páginas desde la columna izquierda con **Añadir al menú**, arrastra los elementos para cambiar el orden (o hacia la derecha para que queden dentro de otro) y haz clic en **Guardar menú**.',
    identidad: 'En **Apariencia › Personalizar › Identidad del sitio** cambias el logo, el nombre del sitio y el ícono que se ve en la pestaña del navegador. Los cambios se ven a la derecha antes de guardar; haz clic en **Publicar** para aplicarlos.',
};

// Campos propios de WordPress en la pantalla de edición de una entrada o tipo de contenido, en el
// orden en que se numeran. `selector` es la caja del admin que se captura.
export const NATIVOS = [
    { n: 'W1', label: 'Título', selector: '#titlediv' },
    { n: 'W2', label: 'Contenido', selector: '#postdivrich' },
    { n: 'W3', label: 'Extracto', selector: '#postexcerpt' },
    { n: 'W4', label: 'Categorías', selector: '#categorydiv' },
    { n: 'W5', label: 'Etiquetas', selector: '#tagsdiv-post_tag' },
    { n: 'W6', label: 'Imagen destacada', selector: '#postimagediv' },
];
export const SECCION_NATIVA = 'wordpress';

function llegarDefault(chapter) {
    if (chapter.kind === 'sitio') return ['En el menú de la izquierda entra a **Apariencia**.', 'Elige **Menús** o **Personalizar**, según lo que quieras cambiar.'];
    if (chapter.kind === 'opciones') return [`En el menú de la izquierda entra a **${chapter.where}**.`, 'Cada sección de la pantalla corresponde a una parte del sitio que se repite en todas las páginas.'];
    if (chapter.kind === 'contenido') {
        return [`En el menú de la izquierda entra a **${chapter.title}**.`, 'Para uno nuevo haz clic en **Añadir nuevo**; para cambiar uno existente, haz clic en su título.'];
    }
    const editar = 'y haz clic en **Editar** (aparece al pasar el mouse sobre el nombre).';
    const bajar = 'Baja: debajo del editor está cada sección, en el mismo orden que en la web.';
    if (chapter.shared) return ['En el menú de la izquierda entra a **Páginas**.', `Busca cualquiera de estas páginas en la lista: ${chapter.pages.map((p) => `**${p}**`).join(', ')}, ${editar} Todas tienen las mismas secciones.`, bajar];
    return ['En el menú de la izquierda entra a **Páginas**.', `Busca **${chapter.title}** en la lista ${editar}`, bajar];
}

// Esqueleto de un capítulo. Si hay un borrador anterior, conserva sus textos y solo agrega lo nuevo.
export function skeleton(chapter, previous = null) {
    const keep = (section, n) => previous?.sections[section]?.textos.get(n) ?? PENDIENTE;
    const lines = [
        `# Capítulo: ${chapter.title}`,
        '',
        `- **Tipo:** ${KIND_LABEL[chapter.kind]}`,
        `- **Dónde:** ${chapter.where}`,
        ...(chapter.pages?.length ? [`- **Páginas:** ${chapter.pages.join(', ')}`] : []),
        ...(chapter.group ? [`- **Grupo ACF:** ${chapter.group} (${chapter.groupTitle})`] : []),
        `- **Estado:** ${previous?.meta.Estado ?? 'pendiente'}`,
        ...(previous?.meta.Incluir ? [`- **Incluir:** ${previous.meta.Incluir}`] : []),
        '',
        '## Cómo llegar',
        '',
        ...(previous?.llegar.length ? previous.llegar : llegarDefault(chapter)).map((step, i) => `${i + 1}. ${step}`),
        ...(previous?.nota ? ['', `> ${previous.nota}`] : []),
    ];
    const section = (name, label, fields) => {
        const prev = previous?.sections[name];
        lines.push('', `## Sección: ${name} · ${prev?.titulo || label}`, '', `- **Resumen:** ${prev?.resumen || (chapter.kind === 'sitio' ? RESUMEN_SITIO[name] : '') || PENDIENTE}`);
        if (prev?.web) lines.push(`- **Web:** ${prev.web}`);
        lines.push('');
        for (const f of fields) lines.push(`- **${f.n}** ${f.label}${f.required ? ' *' : ''} — ${keep(name, f.n)}`);
    };
    if (chapter.kind === 'contenido') section(SECCION_NATIVA, 'Campos de WordPress', NATIVOS);
    for (const s of chapter.sections) section(s.name, s.label, flatten(s.fields));
    return `${lines.join('\n')}\n`;
}

// Lee un borrador: datos, pasos de "Cómo llegar", nota y, por sección, título, resumen, selector web
// opcional y el texto de cada número.
export function parseBorrador(text) {
    const src = text.replace(/\r\n/g, '\n');
    const [head, ...blocks] = src.split(/^## /m);
    const meta = Object.fromEntries([...head.matchAll(/^- \*\*(.+?):\*\*[ \t]*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
    const out = { title: /^# Capítulo:\s*(.+)$/m.exec(head)?.[1]?.trim() ?? '', meta, llegar: [], nota: '', sections: {} };
    for (const block of blocks) {
        const [first, ...rest] = block.split('\n');
        const body = rest.join('\n');
        if (/^Cómo llegar/.test(first)) {
            out.llegar = [...body.matchAll(/^\d+\.\s+(.*)$/gm)].map((m) => m[1].trim());
            out.nota = /^>\s*(.*)$/m.exec(body)?.[1]?.trim() ?? '';
            continue;
        }
        const m = /^Sección:\s*(\S+)\s*(?:·\s*(.*))?$/.exec(first.trim());
        if (!m) continue;
        const meta = (name) => new RegExp(`^- \\*\\*${name}:\\*\\*[ \\t]*(.*)$`, 'm').exec(body)?.[1]?.trim() ?? '';
        const textos = new Map();
        const labels = new Map();
        for (const [, n, label, texto] of body.matchAll(/^- \*\*([\w.]+)\*\*\s+(.+?)\s+—\s+(.*)$/gm)) {
            textos.set(n, texto.trim());
            labels.set(n, label.replace(/\s*\*$/, '').trim());
        }
        out.sections[m[1]] = {
            titulo: (m[2] ?? '').trim(),
            resumen: meta('Resumen'),
            web: meta('Web'),
            // Solo capítulos extra (escritos a mano): de dónde sale la captura.
            admin: meta('Admin'),
            selector: meta('Selector'),
            captura: meta('Captura'),
            textos,
            labels,
        };
    }
    return out;
}

// Texto del borrador a HTML del manual: **negrita**, `código` y nada más (se escapa lo demás). Los escapes
// de Markdown (\*, \|, \~, \_, \\, \`) se respetan: el carácter sale tal cual y no abre negrita ni código.
export function inline(text) {
    const literales = [];
    return String(text)
        .replace(/\\([*|~_\\`])/g, (_, c) => `\u0000${literales.push(c) - 1}\u0000`)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\u0000(\d+)\u0000/g, (_, i) => literales[Number(i)]);
}
