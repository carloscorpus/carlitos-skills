// Reglas que revisa check.mjs en cada borrador (ver references/redaccion.md). Sin dependencias.

import { flatten } from './acf.mjs';
import { NATIVOS, PENDIENTE, SECCION_NATIVA } from './borrador.mjs';

export const FRASE_IMAGEN = 'hasta 2000 px en el lado más largo';
const IMAGEN = new Set(['image', 'gallery']);
const RESALTADO = /\*[^*\s][^*]*\*|\|[^|\s][^|]*\|/; // *texto* o |texto| en el ejemplo del borrador
const pendiente = (text) => !text || text.trim() === PENDIENTE;

// Revisa un capítulo: borrador contra el inventario y, si hay capturas, contra lo que se vio en el admin.
// Devuelve { errors, warnings } con { file, message }.
export function checkChapter(chapter, borrador, file, mapa = null) {
    const errors = [];
    const warnings = [];
    const error = (message) => errors.push({ file, message });
    const warn = (message) => warnings.push({ file, message });

    if (borrador.llegar.length === 0) error('Falta "Cómo llegar".');
    const sections = [...chapter.sections];
    if (chapter.kind === 'contenido') sections.unshift({ name: SECCION_NATIVA, label: 'Campos de WordPress', fields: NATIVOS.map((n) => ({ ...n, type: 'nativo' })) });

    for (const section of sections) {
        const b = borrador.sections[section.name];
        if (!b) { error(`Falta la sección "${section.name}".`); continue; }
        if (pendiente(b.resumen)) error(`${section.name}: falta el resumen.`);
        const seen = mapa?.secciones?.[section.name]?.numeros;
        const fields = flatten(section.fields);
        for (const f of fields) {
            const text = b.textos.get(f.n);
            // Un campo de WordPress que la pantalla no tiene (por ejemplo, sin etiquetas) no necesita texto.
            if (section.name === SECCION_NATIVA && seen && !seen.includes(f.n)) continue;
            if (pendiente(text)) { error(`${section.name} ${f.n} (${f.label}): falta el texto.`); continue; }
            if (/\d+\s*caracteres|caracteres\s*\d/i.test(text)) error(`${section.name} ${f.n}: no se recomienda cantidad de caracteres.`);
            if (IMAGEN.has(f.type)) {
                if (!text.includes(FRASE_IMAGEN)) error(`${section.name} ${f.n} (imagen): usa "Recomendado: ${FRASE_IMAGEN}, horizontal" (o vertical, o cuadrada).`);
                else if (/\d+\s*[×x]\s*\d+|m[ií]nimo\s+\d+\s*px/i.test(text)) error(`${section.name} ${f.n} (imagen): sin medidas fijas, solo la recomendación.`);
            }
            if (f.highlight === false && RESALTADO.test(text) && /asterisco|barra/i.test(text)) error(`${section.name} ${f.n}: este campo no acepta resaltado (*asteriscos*, |barras|); su plantilla no usa el helper.`);
            if (f.highlight && !/asterisco|barra|resalt/i.test(text)) warn(`${section.name} ${f.n}: la plantilla resalta este texto; explica *asteriscos* y |barras|.`);
        }
        const known = new Set(fields.map((f) => f.n));
        for (const n of b.textos.keys()) if (!known.has(n)) warn(`${section.name}: el número ${n} ya no existe en el grupo de ACF; quítalo del borrador.`);
        if (seen && section.name !== SECCION_NATIVA && chapter.kind !== 'extra') {
            const missing = fields.map((f) => f.n).filter((n) => !seen.includes(n));
            if (missing.length) warn(`${section.name}: ${missing.join(', ')} no se ven en la captura (por ejemplo, una lista sin filas).`);
        }
    }
    for (const name of Object.keys(borrador.sections)) {
        if (!sections.some((s) => s.name === name)) warn(`La sección "${name}" ya no existe en el grupo de ACF; quítala del borrador.`);
    }
    return { errors, warnings };
}
