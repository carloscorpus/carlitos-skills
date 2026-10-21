/*
 * Módulo de acordeones (skill wp-accordion).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. El <details> nativo ya da el teclado (Enter y Espacio), el
 * estado abierto/cerrado y el nombre accesible del <summary>; sin este módulo el acordeón funciona.
 * Aquí solo se cubre lo que el navegador no hace:
 *   - el modo exclusivo en navegadores sin el atributo `name` (los demás lo hacen solos);
 *   - abrir el ítem al llegar con un #ancla (o un enlace) que apunta a él o a algo dentro de él;
 *   - los eventos accordion:open y accordion:close (sirven para analítica).
 */

const ITEM = 'details[data-accordion-item]';
const SUPPORTS_NAME = 'name' in HTMLDetailsElement.prototype;

// Abre el ítem que contiene el elemento (y los ítems de los acordeones que lo contengan).
function openAround(target) {
    let opened = false;
    for (let item = target.closest(ITEM); item; item = item.parentElement?.closest(ITEM)) {
        if (!item.open) {
            item.open = true;
            opened = true;
        }
    }
    return opened;
}

function openFromHash() {
    if (!location.hash) return;

    let id;
    try {
        id = decodeURIComponent(location.hash.slice(1));
    } catch {
        return;
    }

    const target = document.getElementById(id);
    if (!target || !openAround(target)) return;

    // El navegador ya intentó ir al ancla con el panel cerrado: se repite con el panel abierto.
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

// Modo exclusivo de respaldo: cierra los demás ítems del mismo grupo (`name`).
function closeOthers(item) {
    const name = item.getAttribute('name');
    if (!name) return;
    for (const other of document.querySelectorAll(`${ITEM}[open]`)) {
        if (other !== item && other.getAttribute('name') === name) other.open = false;
    }
}

// `toggle` no burbuja: se escucha en la fase de captura, una sola vez en el documento.
function onToggle(event) {
    const item = event.target;
    if (!(item instanceof HTMLDetailsElement) || !item.matches(ITEM)) return;

    if (item.open && !SUPPORTS_NAME) closeOthers(item);
    item.dispatchEvent(new CustomEvent(item.open ? 'accordion:open' : 'accordion:close', { bubbles: true }));
}

export function initAccordions() {
    document.addEventListener('toggle', onToggle, true);
    addEventListener('hashchange', openFromHash);
    openFromHash();
}
