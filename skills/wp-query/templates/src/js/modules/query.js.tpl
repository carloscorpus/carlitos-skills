/*
 * Listados sin recargar (skill wp-query).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Es genérico: sirve para todos los listados del tema. Sin este módulo el listado funciona igual (el formulario de
 * filtros es un <form method="get"> normal y la paginación son enlaces). Con él:
 *   - al cambiar un filtro (o al enviar, con "Al filtrar: botón aplicar") pide la misma URL con el encabezado
 *     X-WP-Query: 1 y reemplaza solo las zonas [data-query] (filtros, resultados, paginacion, total...);
 *   - la URL se actualiza (history) y el botón atrás vuelve al filtro anterior;
 *   - "cargar más" e "infinito" agregan los resultados de la página siguiente;
 *   - mientras carga, la zona de resultados tiene aria-busy y al terminar se anuncia el total;
 *   - si algo falla, abre la URL como una página normal.
 * Los ajustes de cada listado llegan en <script id="wp-query-config"> (los imprime inc/query/motor.php).
 *
 * Este archivo no se edita por proyecto. Avisa con el evento `wp-query:update` en document ({ url, total, zonas }).
 */

const HEADER = 'X-WP-Query';
const DEBOUNCE = 300;
const MAX_ITEMS = 50;

// ---------- URL (funciones puras: las prueba tests/check.mjs) ----------

/*
 * Parámetros limpios de la URL a partir de los pares [name, value] de un formulario:
 *   - sin vacíos; `categoria[]` varias veces -> `categoria=sillas,mesas`;
 *   - un extremo de rango igual a su límite (`limits[name]`, del min/max del input) no se manda;
 *   - `paged` nunca: cambiar un filtro vuelve a la primera página.
 */
export function queryParams(entries, limits = {}) {
    const grouped = new Map();
    for (const [rawName, rawValue] of entries) {
        if (typeof rawValue !== 'string') continue;
        const value = rawValue.trim();
        const name = rawName.endsWith('[]') ? rawName.slice(0, -2) : rawName;
        if (!value || name === 'paged') continue;
        if (limits[name] !== undefined && Number(value) === Number(limits[name])) continue;
        const list = grouped.get(name) ?? [];
        if (!list.includes(value) && list.length < MAX_ITEMS) list.push(value);
        grouped.set(name, list);
    }
    const params = new URLSearchParams();
    for (const [name, values] of grouped) params.set(name, values.join(','));
    return params;
}

// URL final: la base sin su query string, más los parámetros (las comas se dejan legibles).
export function buildUrl(base, params) {
    const url = new URL(base);
    url.search = params.toString().replace(/%2C/gi, ',');
    url.hash = '';
    return url.toString();
}

// Zonas de un HTML completo (respuesta que no fue JSON, por ejemplo servida por una caché de páginas).
export function zonesFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const zones = {};
    for (const element of doc.querySelectorAll('[data-query]')) {
        const name = element.getAttribute('data-query');
        if (name && !(name in zones)) zones[name] = element.outerHTML;
    }
    return { ok: Object.keys(zones).length > 0, zonas: zones, titulo: doc.title };
}

// ---------- Estado ----------

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let config = { modo: 'auto', paginacion: 'numeros' };
let controller = null;
let timer = null;
let live = null;
let observer = null;

const zone = (name) => document.querySelector(`[data-query="${name}"]`);
const form = () => zone('filtros')?.closest('form') ?? zone('filtros')?.querySelector('form') ?? null;

function readConfig() {
    try {
        const data = JSON.parse(document.getElementById('wp-query-config')?.textContent ?? '{}');
        config = { ...config, ...data };
    } catch {
        // sin ajustes válidos: se usan los de por defecto
    }
}

// Región para anunciar el total a los lectores de pantalla (la zona total puede no ser aria-live).
function announce(text) {
    if (!text) return;
    if (!live) {
        live = document.createElement('div');
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('role', 'status');
        live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
        document.body.append(live);
    }
    live.textContent = '';
    window.setTimeout(() => {
        live.textContent = text;
    }, 50);
}

function urlFromForm(target) {
    const limits = {};
    for (const input of target.querySelectorAll('input[name$="_min"][min], input[name$="_max"][max]')) {
        limits[input.name] = input.name.endsWith('_min') ? input.min : input.max;
    }
    return buildUrl(target.action || window.location.href, queryParams([...new FormData(target).entries()], limits));
}

// ---------- Pedido ----------

async function fetchZones(url) {
    controller?.abort();
    controller = new AbortController();
    const response = await fetch(url, {
        headers: { [HEADER]: '1', Accept: 'application/json, text/html' },
        credentials: 'same-origin',
        signal: controller.signal,
    });
    if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('Content-Type') ?? '';
    const data = type.includes('application/json') ? await response.json() : zonesFromHtml(await response.text());
    if (!data?.ok) throw new Error('Respuesta sin zonas');
    return data;
}

// Guarda el control con el foco para devolvérselo tras reemplazar el formulario.
function rememberFocus() {
    const active = document.activeElement;
    if (!active?.name || !active.closest('[data-query]')) return null;
    return {
        name: active.name,
        value: active.type === 'checkbox' || active.type === 'radio' ? active.value : null,
        text: 'selectionStart' in active && typeof active.value === 'string' ? active.value : null,
        start: active.selectionStart ?? null,
        end: active.selectionEnd ?? null,
    };
}

function restoreFocus(saved) {
    if (!saved) return;
    const candidates = [...document.querySelectorAll(`[data-query] [name="${CSS.escape(saved.name)}"]`)];
    const target = candidates.find((el) => saved.value === null || el.value === saved.value);
    if (!target) return;
    // Lo que se siguió escribiendo mientras llegaba la respuesta no se pierde.
    if (saved.text !== null && target.value !== saved.text) target.value = saved.text;
    target.focus({ preventScroll: true });
    if (saved.start !== null && typeof target.setSelectionRange === 'function') {
        try {
            target.setSelectionRange(saved.start, saved.end);
        } catch {
            // algunos tipos de input (number) no aceptan selección
        }
    }
}

function swap(zones) {
    const focus = rememberFocus();
    for (const [name, html] of Object.entries(zones)) {
        const current = zone(name);
        if (current) current.outerHTML = html;
    }
    restoreFocus(focus);
    watchInfinite();
}

function setBusy(busy) {
    const results = zone('resultados');
    if (results) results.setAttribute('aria-busy', busy ? 'true' : 'false');
    document.documentElement.toggleAttribute('data-query-cargando', busy);
}

function done(url, data) {
    if (data.titulo) document.title = data.titulo;
    const total = zone('total')?.textContent?.trim() ?? '';
    announce(total);
    document.dispatchEvent(new CustomEvent('wp-query:update', { detail: { url, total: data.total ?? null, zonas: Object.keys(data.zonas) } }));
}

/*
 * Carga una URL del listado y reemplaza sus zonas. history: 'push' (un filtro nuevo), 'replace' (mientras se
 * escribe) o 'none' (botón atrás).
 */
async function load(url, { history = 'push', scroll = false } = {}) {
    setBusy(true);
    try {
        const data = await fetchZones(url);
        swap(data.zonas);
        if (history === 'push') window.history.pushState({ wpQuery: true }, '', url);
        if (history === 'replace') window.history.replaceState({ wpQuery: true }, '', url);
        if (scroll) zone('resultados')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        done(url, data);
    } catch (error) {
        if (error.name === 'AbortError') return;
        window.location.assign(url);
    } finally {
        setBusy(false);
    }
}

// "Cargar más" / infinito: agrega los elementos de la página siguiente y reemplaza la paginación.
async function loadMore(link) {
    if (link.dataset.queryCargando) return;
    link.dataset.queryCargando = '1';
    link.setAttribute('aria-busy', 'true');
    try {
        const data = await fetchZones(link.href);
        // Los elementos van dentro de [data-query-items] si la zona lo marca (una rejilla dentro de la zona).
        const results = zone('resultados');
        const incoming = document.createElement('template');
        incoming.innerHTML = data.zonas.resultados ?? '';
        const source = incoming.content.querySelector('[data-query-items]') ?? incoming.content.firstElementChild;
        const destination = results?.querySelector('[data-query-items]') ?? results;
        const items = [...(source?.children ?? [])];
        const first = items[0];
        destination?.append(...items);
        const pagination = zone('paginacion');
        if (pagination) pagination.outerHTML = data.zonas.paginacion ?? '<div data-query="paginacion"></div>';
        if (first && config.paginacion === 'cargar_mas') {
            first.setAttribute('tabindex', '-1');
            first.focus({ preventScroll: reducedMotion() });
        }
        watchInfinite();
        done(link.href, data);
    } catch (error) {
        if (error.name !== 'AbortError') window.location.assign(link.href);
    }
}

function watchInfinite() {
    if (config.paginacion !== 'infinito' || !('IntersectionObserver' in window)) return;
    observer?.disconnect();
    const link = document.querySelector('[data-query="paginacion"] [data-query-mas]');
    if (!link) return;
    observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            loadMore(link);
        }
    }, { rootMargin: '400px 0px' });
    observer.observe(link);
}

// ---------- Eventos ----------

function onChange(event) {
    const target = form();
    if (!target || !target.contains(event.target) || config.modo === 'boton') return;
    if (event.type === 'input' && !['search', 'text', 'number', 'range'].includes(event.target.type)) return;
    window.clearTimeout(timer);
    const typing = event.type === 'input';
    timer = window.setTimeout(() => {
        const url = urlFromForm(target);
        // Al salir de un campo ya cargado mientras se escribía, `change` no pide lo mismo otra vez.
        if (url !== window.location.href) load(url, { history: typing ? 'replace' : 'push' });
    }, typing ? DEBOUNCE : 0);
}

function onSubmit(event) {
    const target = form();
    if (!target || event.target !== target) return;
    event.preventDefault();
    window.clearTimeout(timer);
    load(urlFromForm(target));
}

function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    const area = link?.closest('[data-query]');
    // Los enlaces de los resultados (las tarjetas) son páginas normales.
    if (!link || !area || area.getAttribute('data-query') === 'resultados' || link.hasAttribute('data-query-ignorar')) return;
    if (link.target && link.target !== '_self') return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    if (link.hasAttribute('data-query-mas')) loadMore(link);
    else load(url.toString(), { scroll: area.getAttribute('data-query') === 'paginacion' });
}

function onPopState(event) {
    if (event.state?.wpQuery) load(window.location.href, { history: 'none' });
}

export function initQuery() {
    if (!zone('resultados') || document.documentElement.hasAttribute('data-query-listo')) return;
    document.documentElement.setAttribute('data-query-listo', '');
    readConfig();
    window.history.replaceState({ wpQuery: true }, '', window.location.href);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
    watchInfinite();
}
