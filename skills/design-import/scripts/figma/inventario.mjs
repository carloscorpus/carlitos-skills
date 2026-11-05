// Une las lecturas de Figma de todas las páginas en un inventario con las mismas claves de analyze.mjs
// (tokens, repeated, interactions, dynamicCandidates, siteWide, findings), para que los pasos 3 a 5 del
// SKILL.md se lean igual con carpeta o con Figma. Función pura: no lee ni escribe archivos.

// Distancia máxima entre dos colores (en RGB, de 0 a 441) para considerarlos "casi iguales".
// #9EC0C0 y #9cb0b0 (distancia ~23) sí; un verde y un azul distintos, no.
export const COLOR_PARECIDO = 25;

const SKILL_POR_SENAL = { formulario: 'wp-form', modal: 'wp-modal', acordeon: 'wp-accordion' };
const INTERACCIONES = ['formulario', 'modal', 'acordeon', 'slider', 'menu', 'pestanas'];
const CHROME = /header|footer|cintillo|menu|nav|barra/i;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const distancia = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const stable = (value) => JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v));
const unique = (list) => [...new Set(list)];

// Suma un valor suelto (espacio, radio, color) de todas las secciones de todas las páginas.
function sumar(map, key, page, usos, extra = {}) {
    const row = map.get(key) ?? { ...extra, usos: 0, paginas: new Set() };
    row.usos += usos;
    row.paginas.add(page);
    map.set(key, row);
}
const filas = (map, keyName) => [...map.entries()]
    .map(([key, row]) => ({ [keyName]: key, usos: row.usos, paginas: [...row.paginas] }))
    .sort((a, b) => b.usos - a.usos || (a[keyName] < b[keyName] ? -1 : 1));

// `pages`: [{ slug, data }] con lecturas ya validadas.
export function buildInventario(pages) {
    const nombrados = { colores: new Map(), texto: new Map(), sombras: new Map() }; // nombre -> Map(valor -> Set(páginas))
    const espacios = new Map();
    const radios = new Map();
    const coloresSueltos = new Map();
    const componentes = new Map();
    const imagenes = [];
    const interactions = [];
    const dynamicCandidates = [];
    const pendientes = [];
    const propuestas = [];
    const outPages = [];

    for (const { slug, data } of pages) {
        for (const kind of ['colores', 'texto', 'sombras']) {
            for (const [name, value] of Object.entries(data.tokens[kind])) {
                const values = nombrados[kind].get(name) ?? new Map();
                const key = stable(value);
                values.set(key, { value, paginas: [...(values.get(key)?.paginas ?? []), slug] });
                nombrados[kind].set(name, values);
            }
        }

        const secciones = [];
        for (const s of data.secciones) {
            if (s.estado === 'pendiente') {
                pendientes.push({ page: slug, section: s.nombre });
                secciones.push({ name: s.nombre, nodeId: s.nodeId, estado: 'pendiente' });
                continue;
            }
            for (const item of s.sueltos.espacios) sumar(espacios, item.valor, slug, item.usos);
            for (const item of s.sueltos.radios) sumar(radios, item.valor, slug, item.usos);
            for (const item of s.sueltos.colores) sumar(coloresSueltos, item.valor.toLowerCase(), slug, item.usos);
            for (const img of s.imagenes) imagenes.push({ page: slug, section: s.nombre, ...img });
            for (const c of s.componentes) {
                const row = componentes.get(c.nombre) ?? { usos: [], paginas: new Set() };
                row.usos.push({ page: slug, section: s.nombre, variante: c.variante ?? null, props: c.props });
                row.paginas.add(slug);
                componentes.set(c.nombre, row);
            }
            for (const sig of s.senales) {
                if (sig.estado === 'propuesto') propuestas.push({ page: slug, section: s.nombre, tipo: sig.tipo });
                if (INTERACCIONES.includes(sig.tipo)) {
                    interactions.push({ type: sig.tipo, file: slug, section: s.nombre, suggestedSkill: SKILL_POR_SENAL[sig.tipo] ?? null, hint: sig.evidencia, estado: sig.estado });
                }
                if (sig.tipo === 'listado') dynamicCandidates.push({ page: slug, section: s.nombre, reasons: [sig.evidencia], estado: sig.estado });
            }
            secciones.push({
                name: s.nombre, nodeId: s.nodeId, nombreCapa: s.nombreCapa, estado: 'leida', size: s.tamano,
                components: unique(s.componentes.map((c) => c.nombre)), images: s.imagenes.length, texts: s.textos.length,
                signals: s.senales.map((sig) => sig.tipo),
            });
        }
        outPages.push({ file: `specs/figma/enlaces/${slug}.md`, title: slug, fuente: { fileKey: data.fuente.fileKey, nodeId: data.fuente.nodeId }, sections: secciones });
    }

    // ----- tokens -----
    const findings = [];
    const addFinding = (id, severity, note, locations) => findings.push({ id, severity, note, count: locations.length, locations });

    const variables = [];
    const conflicts = [];
    for (const [kind, tipo] of [['colores', 'color'], ['texto', 'texto'], ['sombras', 'sombra']]) {
        for (const [name, values] of nombrados[kind]) {
            const list = [...values.values()];
            variables.push({ name, tipo, valor: list[0].value, paginas: unique(list.flatMap((v) => v.paginas)) });
            if (list.length > 1) conflicts.push({ name, valores: list.map((v) => ({ valor: v.value, paginas: v.paginas })) });
        }
    }
    if (conflicts.length) {
        addFinding('figma-token-conflict', 'warning', 'Un mismo token tiene valores distintos en páginas distintas (se usó el de la primera página).', conflicts.map((c) => ({ token: c.name, valores: c.valores })));
    }

    const colors = variables.filter((v) => v.tipo === 'color').map((v) => ({ name: v.name, value: v.valor, paginas: v.paginas }));
    const sueltos = filas(coloresSueltos, 'valor').map((row) => {
        const cercano = colors
            .map((c) => ({ name: c.name, value: c.value, distancia: Math.round(distancia(row.valor, c.value) * 10) / 10 }))
            .filter((c) => c.distancia <= COLOR_PARECIDO)
            .sort((a, b) => a.distancia - b.distancia)[0] ?? null;
        return { name: null, value: row.valor, suelto: true, usos: row.usos, paginas: row.paginas, cercano };
    });

    const parecidos = [];
    for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
            const d = distancia(colors[i].value, colors[j].value);
            if (d <= COLOR_PARECIDO) parecidos.push({ a: `${colors[i].name} ${colors[i].value}`, b: `${colors[j].name} ${colors[j].value}`, distancia: Math.round(d * 10) / 10 });
        }
    }
    for (const s of sueltos) {
        if (s.cercano) parecidos.push({ a: `suelto ${s.value} (${s.usos} usos)`, b: `${s.cercano.name} ${s.cercano.value}`, distancia: s.cercano.distancia });
    }
    for (let i = 0; i < sueltos.length; i++) {
        for (let j = i + 1; j < sueltos.length; j++) {
            const d = distancia(sueltos[i].value, sueltos[j].value);
            if (d <= COLOR_PARECIDO) parecidos.push({ a: `suelto ${sueltos[i].value}`, b: `suelto ${sueltos[j].value}`, distancia: Math.round(d * 10) / 10 });
        }
    }
    if (parecidos.length) addFinding('figma-color-parecido', 'info', 'Colores casi iguales: conviene unirlos en un token o decidir que son distintos (se pregunta en _shared.md).', parecidos);

    const estilos = variables.filter((v) => v.tipo === 'texto');
    const fonts = [...new Map(estilos.map((v) => [v.valor.familia, []])).entries()].map(([familia]) => ({
        familia,
        pesos: unique(estilos.filter((v) => v.valor.familia === familia).map((v) => v.valor.peso)).sort((a, b) => a - b),
    }));
    const fontSizes = unique(estilos.map((v) => v.valor.tamano)).sort((a, b) => a - b).map((valor) => ({
        valor,
        estilos: estilos.filter((v) => v.valor.tamano === valor).map((v) => v.name),
    }));

    // ----- componentes y lo que se repite en todo el sitio -----
    const repeated = [];
    const chrome = [];
    const repetidosEntrePaginas = [];
    for (const [nombre, row] of [...componentes.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (row.usos.length < 2) continue;
        const entreVarias = row.paginas.size >= 2;
        const group = {
            id: `componente:${nombre}`, tag: 'componente', nombre, count: row.usos.length, kind: entreVarias ? 'cross-page' : 'in-page',
            files: [...row.paginas], variantes: unique(row.usos.map((u) => u.variante).filter(Boolean)),
            locations: row.usos.map((u) => ({ page: u.page, section: u.section })), sample: stable(row.usos[0].props),
        };
        repeated.push(group);
        if (entreVarias) (CHROME.test(nombre) || row.usos.some((u) => CHROME.test(u.section)) ? chrome : repetidosEntrePaginas).push(group);
    }

    if (pendientes.length) addFinding('figma-seccion-pendiente', 'info', 'Secciones de enlaces/ que todavía no se leyeron.', pendientes);
    if (propuestas.length) addFinding('figma-senal-propuesta', 'info', 'Señales deducidas del diseño (repetidor, slider, formulario...): se confirman con el usuario en los specs.', propuestas);

    const leidas = outPages.reduce((sum, p) => sum + p.sections.filter((s) => s.estado === 'leida').length, 0);
    return {
        ok: true,
        source: 'figma',
        summary: {
            pages: outPages.length, sections: leidas, sectionsPending: pendientes.length, images: imagenes.length,
            repeatedGroups: repeated.length, interactions: interactions.length, dynamicCandidates: dynamicCandidates.length, findings: findings.length,
        },
        pages: outPages,
        assets: { images: imagenes, fonts: fonts.map((f) => ({ familia: f.familia, pesos: f.pesos })) },
        tokens: {
            colors: [...colors, ...sueltos],
            fonts,
            fontSizes,
            spacing: filas(espacios, 'valor'),
            radii: filas(radios, 'valor'),
            shadows: variables.filter((v) => v.tipo === 'sombra').map((v) => ({ name: v.name, value: v.valor, paginas: v.paginas })),
            variables,
            textStyles: estilos.map((v) => ({ name: v.name, ...v.valor, paginas: v.paginas })),
        },
        repeated,
        interactions,
        dynamicCandidates,
        siteWide: { chrome, repeated: repetidosEntrePaginas },
        findings,
        skipped: [],
    };
}
