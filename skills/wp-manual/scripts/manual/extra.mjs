// Capítulos extra: borradores escritos a mano (`specs/manual/extra-<nombre>.md`, `- **Tipo:** extra`) para lo
// que no sale de ACF, como los envíos guardados de wp-form. Sus secciones y números salen del propio
// borrador; cada sección puede indicar de dónde sale su captura. Formato en references/borrador.md.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBorrador } from './borrador.mjs';

export const PREFIJO_EXTRA = 'extra-';

// Capítulos extra de la carpeta del manual, en orden alfabético. Van al final del manual.
export function loadExtras(root) {
    if (!existsSync(root)) return [];
    const out = [];
    for (const file of readdirSync(root).filter((f) => f.startsWith(PREFIJO_EXTRA) && f.endsWith('.md')).sort()) {
        const b = parseBorrador(readFileSync(join(root, file), 'utf8'));
        if (!/^extra$/i.test(b.meta.Tipo ?? '')) continue;
        const sections = Object.entries(b.sections).map(([name, s]) => ({
            name,
            label: s.titulo || name,
            fields: [...s.textos.keys()].map((n) => ({ n, name: n, label: s.labels.get(n) ?? '', type: 'extra', required: false })),
            admin: s.admin,
            selector: s.selector,
            captura: s.captura,
        }));
        out.push({
            id: file.replace(/\.md$/, ''),
            kind: 'extra',
            title: b.title || file,
            where: b.meta['Dónde'] ?? '',
            admin: { llegar: b.meta.Admin ?? '' },
            pages: [],
            sections,
            fields: sections.reduce((n, s) => n + s.fields.length, 0),
        });
    }
    return out;
}

// Capítulos del manual: los del inventario y luego los extra.
export const allChapters = (inventory, root) => [...inventory.chapters, ...loadExtras(root)];

// Borrador del capítulo "Envíos de formularios" (envíos guardados de wp-form). Textos generales: Claude los
// ajusta a los formularios del proyecto (cuáles guardan, si alguno numera sus solicitudes, adjuntos).
export function esqueletoEnvios(postType) {
    const lista = `edit.php?post_type=${postType}`;
    return `# Capítulo: Envíos de formularios

<!-- Capítulo extra (no sale de ACF): lo creó init.mjs porque el tema guarda los envíos de wp-form.
     Ajusta los textos a los formularios del proyecto. Para quitarlo del manual: - **Incluir:** no -->

- **Tipo:** extra
- **Dónde:** Envíos
- **Admin:** ${lista}
- **Estado:** pendiente

## Cómo llegar

1. En el menú de la izquierda entra a **Envíos**.
2. Haz clic en **Ver** debajo de un envío para abrir su detalle.

> Solo los usuarios **Administradores** ven este menú: los envíos tienen datos personales.

## Sección: listado · Listado de envíos

- **Resumen:** Cada vez que alguien envía un formulario de la web, además del correo al área, se guarda una copia aquí. No se crean ni se editan a mano: solo se leen y, si hace falta, se borran.
- **Admin:** ${lista}
- **Selector:** #posts-filter

- **1** Envío — El nombre del formulario y el correo de la persona que lo envió.
- **2** Formulario — De qué formulario de la web viene.
- **3** Estado — **Enviado** si el correo llegó al área; **Correo no enviado** si falló. En ese caso los datos no se pierden: están aquí, y conviene atenderlos desde el envío y revisar los correos configurados.
- **4** Fecha — Día y hora en que se recibió.
- **5** Buscar envíos — Busca por nombre de formulario o por correo.

## Sección: detalle · Ver un envío

- **Resumen:** Muestra el estado del correo, la fecha de recepción y una tabla con cada pregunta del formulario y lo que respondió la persona. Es de solo lectura: no hay botón para guardar cambios.
- **Admin:** ${lista}#primero
- **Selector:** #poststuff

- **1** Estado — Si el correo al área se envió o no.
- **2** Recibido — Fecha y hora del envío.
- **3** Datos — Una fila por campo del formulario, con su respuesta.

## Sección: notas · Qué conviene saber

- **Resumen:** Reglas de los envíos que funcionan solas.

- **1** Archivos adjuntos — Los archivos que sube la persona viajan adjuntos en el correo al área y no se guardan aquí: en el envío solo queda el nombre de cada archivo. Búscalos en el correo.
- **2** Borrar un envío — Marca la casilla y elige **Mover a la papelera** en «Acciones en lote». Los envíos no se borran solos con el tiempo.
- **3** Datos personales — Si una persona pide sus datos o que se borren, ve a **Herramientas › Exportar datos personales** o **Borrar datos personales** y busca por su correo: incluye sus envíos.
`;
}
