// HTML del manual (diseño aprobado en el piloto) y del reporte. Sin dependencias: el PDF lo imprime
// build.mjs con el navegador. Ver references/diseno.md.
//
// El reparto final de cada hoja se hace en el navegador, antes de imprimir (script `load`): tamaño de las
// imágenes, hojas con dos secciones (--juntar), número de página, índice y revisión de solapes.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { flatten } from './acf.mjs';
import { NATIVOS, SECCION_NATIVA, incluido, inline } from './borrador.mjs';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');
const asset = (rel) => pathToFileURL(join(ASSETS, rel)).href;
const DPR = 2; // las capturas están al doble de resolución
const esc = (text) => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n) => String(n).padStart(2, '0');

// Ancho y alto (px CSS) de una captura PNG o JPG.
export function imageSize(path) {
    const b = readFileSync(path);
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16) / DPR, h: b.readUInt32BE(20) / DPR };
    for (let i = 2; i < b.length;) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xc2) return { w: b.readUInt16BE(i + 7) / DPR, h: b.readUInt16BE(i + 5) / DPR };
        i += 2 + b.readUInt16BE(i + 2);
    }
    return { w: 800, h: 600 };
}

export const FORMATOS_PAGINA = { horizontal: { w: 1920, h: 1080 }, vertical: { w: 1240, h: 1754 } };

// Textos de las reglas generales (iguales en todos los proyectos) y la captura que acompaña a cada una.
// Las reglas con captura solo salen si la captura existe; las `fija` salen siempre.
const REGLAS = [
    { id: 'actualizar', titulo: 'Guardar los cambios', texto: 'Nada se publica hasta que haces clic en <b>Actualizar</b>, en la caja «Publicar» de la derecha. Si cierras la pestaña antes, los cambios se pierden.' },
    { id: 'obligatorio', titulo: 'Campos obligatorios', texto: 'Los campos con <b>*</b> no pueden quedar vacíos. Si falta uno, la página no se guarda y el campo se marca en rojo con un aviso.' },
    { id: 'filas', titulo: 'Listas (filas)', texto: '<b>Añadir fila</b> agrega un elemento al final. Pasa el mouse sobre una fila: <b>+</b> agrega otra justo ahí y <b>−</b> la elimina. Para cambiar el orden, arrastra la fila desde su número.' },
    { id: 'imagen', titulo: 'Imágenes', texto: 'Pasa el mouse sobre la imagen: el <b>lápiz</b> la edita y la <b>X</b> la quita. Luego elige otra de la biblioteca o súbela. La web la recorta para que encaje, así que no hay medidas obligatorias. Recomendado: hasta 2000 px en el lado más largo.' },
    {
        id: 'fijo', fija: true, titulo: 'Lo que no se edita en cada página',
        texto: (opciones) => `Las migas de pan (Inicio › …) se arman solas y no se editan.${opciones ? ` El encabezado y el pie de página son iguales en todo el sitio: se editan una sola vez en <b>${esc(opciones)}</b>.` : ''}`,
    },
];

export function renderManual({ formato, datos, inventory, chapters = inventory.chapters, borradores, mapa, capturas, juntar = false }) {
    const V = formato === 'vertical';
    const PAGE = FORMATOS_PAGINA[formato];
    const capPath = (file) => (file ? join(capturas, file) : null);
    const cap = (file, boxW, boxH) => {
        const path = capPath(file);
        if (!path || !existsSync(path)) return `<div class="sin-captura" style="width:${Math.round(boxW * 0.7)}px">Sin captura</div>`;
        const { w, h } = imageSize(path);
        const s = Math.min(1, boxW / w, boxH / h);
        return `<img class="cap" src="${pathToFileURL(path).href}" data-w="${w}" data-h="${h}" data-maxw="${boxW}" style="width:${Math.round(w * s)}px">`;
    };
    const activos = chapters.filter((c) => borradores[c.id] && incluido(borradores[c.id]));

    let n = 0;
    const paginas = [];
    const indice = [];
    const titulo = 'Manual de administración';
    const pie = (seccion) => `
        <div class="top"><span>${esc(datos.cliente)} · ${titulo}</span><b>${esc(seccion)}</b></div>
        <div class="bottom"><img class="marca" src="${asset('marca/logo-nerd-negro.png')}" alt="NERD"><span>${pad(++n)}</span></div>`;
    const negra = (contenido, attrs = '') => `<section class="page negra"${attrs}><div class="titular">${contenido}</div>
        <div class="marco"><img class="marca-b" src="${asset('marca/ojitos-nerd-blanco.png')}" alt=""></div><span class="num-b">${pad(++n)}</span></section>`;
    const imagenYTexto = (img, texto) => (V
        ? `<div class="apilado"><div>${cap(img, 1100, 760)}</div><div class="texto">${texto}</div></div>`
        : `<div class="dos"><div>${cap(img, 1100, 820)}</div><div class="texto">${texto}</div></div>`);

    // Portada e índice (el índice se llena al final). La razón social y la fecha son opcionales.
    const sub = [datos.razon, datos.fecha].filter(Boolean).map(esc).join('<br>');
    paginas.push(negra(`<small>${esc(datos.cliente)}</small>${titulo}${sub ? `<p class="sub">${sub}</p>` : ''}
        <img class="logo-portada" src="${asset('marca/logo-nerd-blanco.png')}" alt="NERD">`, ' data-portada'));
    paginas.push('@@INDICE@@'); n += 1;

    // Login.
    indice.push(['Login', n + 1]);
    paginas.push(negra('Login'));
    const panel = datos.panel || '[dirección del panel]/wp-admin';
    paginas.push(`<section class="page">${pie('Login')}${imagenYTexto(mapa.comunes?.login, `<h2>Cómo entrar al panel</h2><ol class="pasos">
        <li>Abre tu navegador (Chrome, Edge o Firefox).</li>
        <li>Escribe la dirección del panel: <b>${esc(panel)}</b> y presiona Enter.</li>
        <li>Escribe tu usuario o correo y tu contraseña.</li>
        <li>Haz clic en <b>Acceder</b>. Llegarás al <b>Escritorio</b>, con el menú a la izquierda.</li></ol>
        <p class="nota">¿Olvidaste tu contraseña? Usa <b>¿Has olvidado tu contraseña?</b> debajo del formulario: llegará un enlace a tu correo.</p>
        <p class="nota">No compartas tu usuario. Si otra persona necesita entrar, pide que le creen su propio acceso.</p>`)}</section>`);

    // Reglas generales.
    const pagReglas = n + 2;
    indice.push(['Reglas generales', n + 1]);
    paginas.push(negra('Reglas<br>generales', ' data-reglas'));
    const opciones = activos.find((c) => c.kind === 'opciones')?.where ?? '';
    const reglas = REGLAS.filter((r) => r.fija || mapa.comunes?.[r.id]);
    paginas.push(`<section class="page">${pie('Reglas generales')}<h2>Lo que vale para todo el panel</h2>
        <div class="reglas">${reglas.map((r, i) => `<div class="regla"><span class="badge">${i + 1}</span><div><h3>${r.titulo}</h3><p>${typeof r.texto === 'function' ? r.texto(opciones) : r.texto}</p>
        ${r.fija ? '' : cap(mapa.comunes[r.id], V ? 1000 : 760, V ? 250 : 220)}</div></div>`).join('')}</div></section>`);
    const recordatorio = `<p class="recuerda">Después de editar, haz clic en <b>Actualizar</b>. Reglas generales en la pág. <span class="pag-reglas">${pagReglas}</span>.</p>`;

    // Capítulos.
    for (const chapter of activos) {
        const b = borradores[chapter.id];
        const m = mapa.capitulos?.[chapter.id] ?? { secciones: {} };
        const extra = chapter.kind === 'extra';
        const sinActualizar = chapter.kind === 'sitio' || extra;
        indice.push([chapter.title, n + 1]);
        paginas.push(negra(esc(chapter.title)));
        const compartida = chapter.shared ? `<p class="nota">Estas páginas usan las mismas secciones: ${chapter.pages.map((p) => `<b>${esc(p)}</b>`).join(', ')}.</p>` : '';
        paginas.push(`<section class="page">${pie(chapter.title)}${imagenYTexto(m.llegar, `<h2>Dónde se edita</h2>
            <ol class="pasos">${b.llegar.map((p) => `<li>${inline(p)}</li>`).join('')}</ol>${compartida}
            ${b.nota ? `<p class="nota">${inline(b.nota)}</p>` : ''}${sinActualizar ? '' : recordatorio}`)}</section>`);

        const sections = [...chapter.sections];
        if (chapter.kind === 'contenido') sections.unshift({ name: SECCION_NATIVA, label: 'Campos de WordPress', fields: NATIVOS.filter((x) => !m.secciones[SECCION_NATIVA] || m.secciones[SECCION_NATIVA].numeros.includes(x.n)).map((x) => ({ ...x, required: false })) });
        sections.forEach((section, i) => {
            const bs = b.sections[section.name];
            if (!bs) return;
            const ms = m.secciones[section.name] ?? {};
            const parte = `${pad(i + 1)} ${bs.titulo || section.label}`;
            const nombre = `${chapter.title} · ${parte}`;
            const datosHoja = ` data-capitulo="${esc(chapter.id)}" data-titulo="${esc(chapter.title)}" data-parte="${esc(parte)}"`;
            const todos = flatten(section.fields);
            const depth = (code) => code.split('.').length - 1;
            const lista = todos.map((f) => `<li style="margin-left:${depth(f.n) * 30}px"><span class="badge${depth(f.n) ? ' -sub' : ''}">${esc(f.n)}</span>
                <div><b>${esc(f.label)}</b>${f.required ? ' <span class="req">*</span>' : ''} — ${inline(bs.textos.get(f.n) ?? '')}</div></li>`).join('');
            const resumen = `<p class="resumen">${inline(bs.resumen)}</p>`;
            const campos = todos.length ? `<ol class="campos${V && todos.length > 7 ? ' -dos' : ''}${!V && todos.length > 10 ? ' -compacta' : ''}" ${V && todos.length > 7 ? `style="--filas:${Math.ceil(todos.length / 2)}"` : ''}>${lista}</ol>` : '';
            const pieSeccion = sinActualizar ? '' : recordatorio;
            // Un capítulo extra puede tener secciones sin captura (notas): hoja de solo texto.
            if (extra && !ms.admin) {
                paginas.push(`<section class="page">${pie(nombre)}<div class="texto solo-texto"><h2>${esc(bs.titulo || section.label)}</h2>${resumen}${campos}</div></section>`);
                return;
            }
            const web = ms.web ? `<figure><figcaption class="rotulo">Así se ve en la web</figcaption>${cap(ms.web, V ? 370 : 280, V ? 900 : 790)}</figure>` : '';
            const editar = `<figure><figcaption class="rotulo">${extra ? 'Dónde se ve' : 'Dónde se edita'}</figcaption>${cap(ms.admin, V ? (web ? 690 : 1100) : (web ? 620 : 900), V ? 900 : 830)}</figure>`;
            if (V) {
                paginas.push(`<section class="page seccion"${datosHoja}>${pie(nombre)}${resumen}<div class="imagenes">${editar}${web}</div>${campos}${pieSeccion}</section>`);
            } else {
                paginas.push(`<section class="page"${datosHoja}>${pie(nombre)}<div class="mitades"><div class="imagenes">${editar}${web}</div>
                    <div class="texto">${resumen}${campos}${pieSeccion}</div></div></section>`);
            }
        });
    }

    const indiceHtml = `<section class="page">
        <div class="top"><span>${esc(datos.cliente)} · ${titulo}</span><b>Contenido</b></div>
        <div class="bottom"><img class="marca" src="${asset('marca/logo-nerd-negro.png')}" alt="NERD"><span>02</span></div>
        <h2>Contenido del manual</h2>
        <div class="indice">${indice.map(([t, p]) => `<div><span>${esc(t)}</span><span>${pad(p)}</span></div>`).join('')}</div></section>`;

    const opts = JSON.stringify({ juntar: Boolean(juntar) && !V });
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(datos.cliente)} · ${titulo}</title>
<style>${css(V, PAGE)}</style>
<script>
addEventListener('load', async () => {
    await document.fonts.ready;
    const opts = ${opts};
    const log = { juntadas: [], fallos: [] };
    ${V ? `(${ajustarVertical})();` : `(${ajustarHorizontal})(opts, log);`}
    const revision = (${numerarYRevisar})();
    document.body.dataset.revision = JSON.stringify({ ...revision, ...log });
    document.body.dataset.listo = '1';
});
</script></head><body>
${paginas.join('\n').replace('@@INDICE@@', indiceHtml)}
</body></html>`;
    return { html, paginas: n };
}

// ---------- Funciones que corren en el navegador (se inyectan con toString: sin variables de afuera) ----------

// Vertical: las imágenes de cada sección ocupan el alto que deja el texto (tope 72% de la hoja).
function ajustarVertical() {
    for (const page of document.querySelectorAll('.page.seccion')) {
        const fig = page.querySelector('.imagenes');
        const imgs = [...fig.querySelectorAll('img')];
        if (!imgs.length) continue;
        const ol = page.querySelector('.campos');
        const fin = page.querySelector('.recuerda') ?? page.querySelector('.bottom');
        const cs = getComputedStyle(page);
        const inner = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const libre = fin.getBoundingClientRect().top - fig.getBoundingClientRect().top - (ol ? ol.offsetHeight + 30 : 0) - 64;
        const alto = Math.min(inner * 0.72, libre);
        for (const img of imgs) {
            const w = +img.dataset.w, h = +img.dataset.h, maxw = +img.dataset.maxw;
            img.style.width = Math.round(Math.max(120, Math.min(w, maxw, (w * alto) / h))) + 'px';
        }
    }
}

// Horizontal: dónde va la imagen web en cada hoja de sección y, con `juntar`, dos secciones cortas
// seguidas del mismo capítulo en una sola hoja (dos franjas). Las medidas son px CSS.
function ajustarHorizontal(opts, log) {
    const INNER_H = 880; // alto útil de la hoja (1080 − 110 − 90)
    const LBL = 27; // rótulo «Dónde se edita» + margen
    const COL = 940; // columna izquierda
    const GAP = 24; // entre admin y web lado a lado
    const nat = (img) => ({ w: +img.dataset.w, h: +img.dataset.h });
    const setW = (img, wpx) => { img.style.width = Math.round(wpx) + 'px'; };
    const seccion = (p) => {
        if (!p.querySelector(':scope > .mitades')) return null;
        const figs = p.querySelectorAll('.mitades > .imagenes > figure');
        const admin = figs[0]?.querySelector('img.cap');
        if (!admin) return null;
        const web = figs[1]?.querySelector('img.cap') ?? null;
        return { p, admin, web, figs, capitulo: p.dataset.capitulo, titulo: p.dataset.titulo, parte: p.dataset.parte };
    };

    // Hoja sola: a) web debajo del admin (columna izquierda) si el admin queda legible (560 px o más);
    // b) si no, web bajo el texto de la derecha, si cabe con 420 px o más; c) si tampoco, lado a lado
    // sin pasarse de la columna: el admin a todo el alto y la web con lo que sobra (300 px o más), o el
    // admin en al menos 560 px y la web con el resto.
    function layoutSolo(s) {
        const { p, admin, web } = s;
        const imgs = p.querySelector('.mitades > .imagenes');
        const a = nat(admin);
        const awAlto = Math.min(a.w, COL, ((INNER_H - LBL) * a.w) / a.h);
        if (!web) { setW(admin, awAlto); return; }
        const v = nat(web);
        const disp = INNER_H - 2 * LBL - 22;
        let aw = Math.min(a.w, COL), ah = (aw * a.h) / a.w;
        let ww = Math.min(v.w, COL), wh = (ww * v.h) / v.w;
        if (ah + wh > disp) {
            const minWebH = (Math.min(560, v.w) * v.h) / v.w;
            wh = Math.max(minWebH, Math.min(wh, disp - ah));
            ww = (wh * v.w) / v.h;
            ah = disp - wh; aw = Math.min(aw, (ah * a.w) / a.h);
        }
        if (ah > 0 && (aw >= 560 || aw >= a.w * 0.98)) {
            imgs.classList.add('-columna'); setW(admin, aw); setW(web, ww); return;
        }
        setW(admin, awAlto);
        const texto = p.querySelector('.mitades > .texto');
        const fig = s.figs[1];
        const rec = texto.querySelector('.recuerda');
        fig.classList.add('web-abajo');
        texto.insertBefore(fig, rec);
        const fin = rec ? rec.getBoundingClientRect().top : p.querySelector('.bottom').getBoundingClientRect().top;
        const libre = fin - fig.getBoundingClientRect().top - LBL - 20;
        const ww2 = Math.min(v.w, texto.clientWidth, (libre * v.w) / v.h);
        if (ww2 >= 420) { setW(web, ww2); return; }
        imgs.appendChild(fig); fig.classList.remove('web-abajo');
        const resto = COL - GAP - awAlto;
        if (resto >= 300) { setW(admin, awAlto); setW(web, Math.min(v.w, resto)); return; }
        const hL = Math.min(INNER_H - LBL, (COL - GAP) / (a.w / a.h + v.w / v.h), a.h);
        const awLegible = Math.min(COL - GAP - 120, Math.max((hL * a.w) / a.h, Math.min(awAlto, 560)));
        setW(admin, awLegible);
        setW(web, Math.max(0, Math.min(v.w, COL - GAP - awLegible, ((INNER_H - LBL) * v.w) / v.h)));
    }

    // Una sección como franja de una hoja doble (alto dado): lado a lado o apiladas, lo que deje más grande.
    function franja(s, alto) {
        const div = document.createElement('div');
        div.className = 'franja';
        const imgs = s.p.querySelector('.mitades > .imagenes');
        const texto = s.p.querySelector('.mitades > .texto');
        texto.querySelector('.recuerda')?.remove();
        div.append(imgs, texto);
        imgs.classList.remove('-columna');
        const fueraDer = texto.querySelector('figure.web-abajo');
        if (fueraDer) { fueraDer.classList.remove('web-abajo'); imgs.appendChild(fueraDer); }
        const a = nat(s.admin);
        const H = alto - 6;
        if (!s.web) { setW(s.admin, Math.min(a.w, COL, ((H - LBL) * a.w) / a.h)); return div; }
        const v = nat(s.web);
        const hL = Math.min(H - LBL, (COL - GAP) / (a.w / a.h + v.w / v.h), a.h);
        const lado = { aw: (hL * a.w) / a.h, ww: (hL * v.w) / v.h };
        let aw = Math.min(a.w, COL), ww = Math.min(v.w, COL);
        const tot = (aw * a.h) / a.w + (ww * v.h) / v.w, disp = H - 2 * LBL - 14;
        if (tot > disp) { aw *= disp / tot; ww *= disp / tot; }
        const apil = { aw, ww };
        const nota = (o) => Math.min(o.aw / Math.min(a.w, COL), o.ww / 600);
        const elegido = nota(apil) > nota(lado) ? apil : lado;
        if (elegido === apil) imgs.classList.add('-columna');
        setW(s.admin, elegido.aw); setW(s.web, elegido.ww);
        return div;
    }

    const todas = [...document.querySelectorAll('body > section.page')].map(seccion).filter(Boolean);
    for (const s of todas) layoutSolo(s);
    if (!opts.juntar) return;

    // Prueba juntar A y B con distintos repartos del alto, sobre copias: si no cabe, nada cambia.
    const TOTAL = 798; // alto de las dos franjas juntas (incluye el separador de la segunda)
    function intentar(A0, B0, hA, registrar) {
        const A = seccion(A0.p.cloneNode(true)), B = seccion(B0.p.cloneNode(true));
        const doble = document.createElement('section');
        doble.className = 'page doble';
        const topA = A.p.querySelector('.top');
        topA.querySelector('b').textContent = `${A.titulo} · ${A.parte} · ${B.parte}`;
        const recuerda = A.p.querySelector('.recuerda')?.cloneNode(true);
        const cont = document.createElement('div');
        cont.className = 'franjas';
        doble.append(topA, A.p.querySelector('.bottom'), cont);
        A0.p.before(doble);
        const fa = franja(A, hA); fa.style.height = hA + 'px'; cont.append(fa);
        const hB = TOTAL - hA - 18;
        const fb = franja(B, hB - 26); fb.style.height = hB + 'px'; cont.append(fb);
        if (recuerda) doble.append(recuerda);
        const cabe = [fa, fb].every((f) => f.querySelector('.texto').scrollHeight <= f.clientHeight - (f === fb ? 26 : 0) + 2);
        const lee = (s) => s.admin.getBoundingClientRect().width >= Math.max(380, 0.5 * Math.min(+s.admin.dataset.w, COL));
        const webOk = (s) => !s.web || s.web.getBoundingClientRect().width >= Math.min(300, 0.9 * +s.web.dataset.w);
        if (cabe && lee(A) && lee(B) && webOk(A) && webOk(B)) return doble;
        if (registrar) log.fallos.push(`${A.titulo} ${A.parte} + ${B.parte}: ${[cabe ? '' : 'texto', lee(A) && lee(B) ? '' : 'admin', webOk(A) && webOk(B) ? '' : 'web'].filter(Boolean).join(', ')}`);
        doble.remove();
        return null;
    }
    const ALTOS = [390, 340, 440, 300, 480, 260, 520, 220];
    for (let i = 0; i < todas.length - 1; i++) {
        const A = todas[i], B = todas[i + 1];
        if (A.capitulo !== B.capitulo || A.p.nextElementSibling !== B.p) continue;
        let doble = null;
        for (const hA of ALTOS) if ((doble = intentar(A, B, hA, hA === ALTOS[0]))) break;
        if (!doble) continue;
        A.p.remove(); B.p.remove();
        log.juntadas.push(`${A.titulo}: ${A.parte} + ${B.parte}`);
        i++;
    }
}

// Números de página, índice y «Reglas generales en la pág. N» según las hojas finales, y solapes:
// una imagen que pisa un texto de su hoja o se sale de ella.
function numerarYRevisar() {
    const pad = (n) => String(n).padStart(2, '0');
    const pages = [...document.querySelectorAll('body > section.page')];
    pages.forEach((p, i) => {
        const nb = p.querySelector(':scope > .num-b'); if (nb) nb.textContent = pad(i + 1);
        const bt = p.querySelector(':scope > .bottom span'); if (bt) bt.textContent = pad(i + 1);
    });
    const separadores = pages.map((p, i) => [p, i + 1]).filter(([p]) => p.classList.contains('negra') && !p.hasAttribute('data-portada'));
    const filas = [...document.querySelectorAll('.indice > div')];
    filas.forEach((f, i) => { if (separadores[i]) f.lastElementChild.textContent = pad(separadores[i][1]); });
    const reglas = pages.findIndex((p) => p.hasAttribute('data-reglas'));
    if (reglas >= 0) document.querySelectorAll('.pag-reglas').forEach((s) => { s.textContent = String(reglas + 2); });

    const solapes = [];
    const TEXTOS = '.top, .bottom, h2, .resumen, .campos, .pasos, .nota, .recuerda, .regla p';
    const cruza = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    pages.forEach((p, i) => {
        const pr = p.getBoundingClientRect();
        const titulo = p.querySelector('.top b')?.textContent ?? '';
        for (const img of p.querySelectorAll('img.cap')) {
            const r = img.getBoundingClientRect();
            if (r.right > pr.right + 1 || r.bottom > pr.bottom + 1) { solapes.push({ pagina: i + 1, titulo, problema: `la imagen ${decodeURIComponent(img.src.split('/').pop())} se sale de la hoja` }); continue; }
            const pisa = [...p.querySelectorAll(TEXTOS)].find((t) => !t.contains(img) && cruza(r, t.getBoundingClientRect()));
            if (pisa) solapes.push({ pagina: i + 1, titulo, problema: `la imagen ${decodeURIComponent(img.src.split('/').pop())} se monta sobre el texto (${pisa.className || pisa.tagName.toLowerCase()})` });
        }
    });
    return { paginas: pages.length, indice: filas.length === separadores.length, solapes };
}

function css(V, PAGE) {
    return `
@font-face { font-family: 'Archivo Black'; src: url('${asset('fuentes/archivo-black.woff2')}') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Inter'; src: url('${asset('fuentes/inter.woff2')}') format('woff2'); font-weight: 100 900; }
@page { size: ${PAGE.w}px ${PAGE.h}px; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font: 400 21px/1.45 Inter, system-ui, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: ${PAGE.w}px; height: ${PAGE.h}px; overflow: hidden; break-after: page; background: #fff; padding: 110px ${V ? 70 : 80}px 90px; display: flex; flex-direction: column; }
.negra { background: #000; color: #fff; padding: 0; display: block; }
.titular { position: absolute; left: ${V ? 80 : 110}px; top: ${V ? '42%' : '50%'}; transform: translateY(-50%); font: 400 ${V ? 96 : 120}px/1 'Archivo Black', sans-serif; text-transform: uppercase; max-width: ${V ? 1000 : 1400}px; }
.titular small { display: block; font: 500 28px/1 Inter; letter-spacing: .3em; margin-bottom: 28px; }
.titular .sub { font: 400 26px/1.5 Inter; text-transform: none; margin-top: 40px; }
${V
        ? `.marco { position: absolute; left: 0; right: 0; bottom: 0; height: 260px; border-top: 3px solid #fff; }
.marco::after { content: ''; position: absolute; top: 0; bottom: 0; right: 300px; border-left: 3px solid #fff; }
.marca-b { position: absolute; right: 70px; width: 160px; bottom: 90px; }`
        : `.marco { position: absolute; right: 0; top: 0; bottom: 0; width: 300px; border-left: 3px solid #fff; }
.marco::after { content: ''; position: absolute; left: 0; right: 0; bottom: 140px; border-top: 3px solid #fff; }
.marca-b { position: absolute; left: 70px; width: 160px; bottom: 30px; }`}
.logo-portada { display: block; height: 46px; margin-top: 56px; }
.num-b { position: absolute; right: 30px; top: 30px; font: 500 18px Inter; }
.top { position: absolute; left: ${V ? 70 : 80}px; right: ${V ? 70 : 80}px; top: 40px; display: flex; justify-content: space-between; gap: 40px; font: 500 16px/1 Inter; letter-spacing: .12em; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 14px; }
.top b { font-weight: 700; text-align: right; }
.bottom { position: absolute; right: ${V ? 70 : 80}px; bottom: 28px; display: flex; align-items: center; gap: 20px; font: 500 16px Inter; }
.marca { height: 22px; width: auto; display: block; }
h2 { font: 400 ${V ? 42 : 46}px/1.1 'Archivo Black', sans-serif; text-transform: uppercase; margin: 0 0 16px; }
h3 { font: 700 22px/1.2 Inter; margin: 0 0 6px; }
.rotulo { font: 500 15px/1 Inter; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 12px; }
.dos { display: flex; gap: 56px; flex: 1; }
.apilado { display: flex; flex-direction: column; gap: 36px; flex: 1; }
.texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.solo-texto { max-width: 1100px; }
.resumen { margin: 0 0 ${V ? 26 : 18}px; }
.cap { display: block; border: 2px solid #000; }
.sin-captura { display: grid; place-items: center; height: 240px; border: 2px dashed #000; font: 500 18px Inter; }
figure { margin: 0; }
.mitades { display: grid; grid-template-columns: 940px 1fr; gap: 60px; flex: 1; min-height: 0; }
.imagenes { display: flex; gap: ${V ? 36 : 24}px; align-items: flex-start; ${V ? 'margin-bottom: 30px;' : ''} }
.imagenes.-columna { flex-direction: column; gap: 22px; }
.texto .web-abajo { margin-top: 26px; }
.franjas { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.franja { display: grid; grid-template-columns: 940px 1fr; gap: 60px; height: 386px; overflow: hidden; }
.franja + .franja { border-top: 2px solid #000; padding-top: 26px; margin-top: 18px; height: 412px; }
.franja .imagenes { gap: 24px; }
.franja .imagenes.-columna { gap: 14px; }
.franja .rotulo { margin-bottom: 8px; }
.franja .resumen { margin-bottom: 14px; font-size: 19px; }
.franja .campos { font-size: 16px; gap: 6px; }
.doble .recuerda { margin-top: 16px; }
.campos { list-style: none; padding: 0; margin: 0; font-size: 17px; line-height: 1.35; display: grid; gap: 9px; align-content: start; }
.campos li { display: flex; gap: 12px; align-items: flex-start; }
.campos.-compacta { font-size: 15.5px; gap: 6px; }
.campos.-dos { grid-template-columns: 1fr 1fr; grid-auto-flow: column; grid-template-rows: repeat(var(--filas, 8), auto); font-size: 16px; gap: 7px 40px; }
.badge { flex: none; display: inline-grid; place-items: center; min-width: 30px; height: 26px; padding: 0 8px; border-radius: 13px; background: #000; color: #fff; font: 700 14px/1 Inter; }
.badge.-sub { background: #fff; color: #000; box-shadow: inset 0 0 0 2px #000; }
.req { font-weight: 700; }
.pasos { padding-left: 28px; margin: 0 0 24px; display: grid; gap: 12px; }
.nota { border-left: 4px solid #000; padding: 4px 0 4px 16px; margin: 0 0 14px; font-size: 19px; }
.recuerda { margin: auto 0 0; border: 2px solid #000; padding: 12px 18px; font-size: 17px; }
.recuerda::before { content: '⚠  '; }
.reglas { display: grid; grid-template-columns: ${V ? '1fr' : '1fr 1fr'}; gap: ${V ? '44px' : '30px 70px'}; margin-top: 24px; }
.regla { display: flex; gap: 16px; font-size: 19px; }
.regla p { margin: 0 0 12px; }
code { font: 500 17px ui-monospace, Consolas, monospace; background: #eee; padding: 1px 6px; }
.indice { ${V ? '' : 'columns: 2; column-gap: 80px;'} margin-top: 30px; font-size: 22px; }
.indice div { display: flex; justify-content: space-between; border-bottom: 1px dotted #000; padding: 8px 0; break-inside: avoid; }`;
}

// Reporte de cobertura: sencillo, para el equipo (no para el cliente).
export function renderReporte({ datos, inventory, chapters = inventory.chapters, borradores, resultados, mapa, version }) {
    const fila = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    const capitulos = chapters.map((c) => {
        const r = resultados[c.id] ?? { errors: [], warnings: [] };
        const capt = mapa.capitulos?.[c.id] ? Object.keys(mapa.capitulos[c.id].secciones ?? {}).length : 0;
        const estado = !borradores[c.id] ? 'sin borrador' : !incluido(borradores[c.id]) ? 'omitido (Incluir: no)' : r.errors.length ? `${r.errors.length} error(es)` : 'listo';
        return fila([esc(c.title), c.kind, String(c.sections.length), String(c.fields), `${capt}`, esc(estado)]);
    }).join('');
    const items = (list) => (list.length ? `<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>Nada.</p>');
    const errores = Object.values(resultados).flatMap((r) => r.errors.map((e) => `${e.file}: ${e.message}`));
    const avisos = Object.values(resultados).flatMap((r) => r.warnings.map((e) => `${e.file}: ${e.message}`));
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte del manual</title><style>
@page { size: A4; margin: 18mm; }
body { font: 11pt/1.45 system-ui, sans-serif; color: #111; }
h1 { font-size: 18pt; margin: 0 0 4px; } h2 { font-size: 13pt; margin: 22px 0 8px; border-bottom: 1px solid #999; }
table { border-collapse: collapse; width: 100%; font-size: 10pt; } td, th { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
li { margin: 2px 0; }
</style></head><body>
<h1>Reporte del manual · ${esc(datos.cliente)}</h1>
<p>Generado con wp-manual ${esc(version)} el ${new Date().toLocaleDateString('es-PE')}. Es para el equipo, no se entrega al cliente.</p>
<h2>Capítulos</h2>
<table><tr><th>Capítulo</th><th>Tipo</th><th>Secciones</th><th>Campos</th><th>Capturas</th><th>Estado</th></tr>${capitulos}</table>
<h2>Sin cubrir</h2>${items(inventory.uncovered.map((u) => `${u.kind} «${u.name}»: ${u.reason}`))}
<h2>Errores</h2>${items(errores)}
<h2>Avisos</h2>${items(avisos)}
</body></html>`;
}
