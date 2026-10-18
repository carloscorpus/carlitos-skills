/*
 * Módulo de modales (skill wp-modal).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. El <dialog> nativo ya da el foco atrapado, el fondo
 * inerte, la tecla Esc y la devolución del foco. Este módulo solo cubre lo que el navegador no:
 *   - abrir donde no existen los Invoker Commands y con disparadores <a href>;
 *   - cerrar con clic fuera (data-backdrop-close);
 *   - apertura automática opcional (data-modal-auto);
 *   - cerrar tras un envío correcto de wp-form (data-form-success="close");
 *   - los eventos modal:open y modal:close (sirven para analítica).
 */

const SUPPORTS_COMMANDS = 'commandForElement' in HTMLButtonElement.prototype;
const DAY = 864e5;
const SUCCESS_CLOSE_DELAY = 2000; // tiempo para leer el mensaje de éxito antes de cerrar

const openers = new WeakMap(); // dialog -> elemento que lo abrió
const isOpen = new WeakMap(); // dialog -> estado visto por el observador

const findDialog = (id) => {
    const el = document.getElementById(id);
    return el instanceof HTMLDialogElement ? el : null;
};

const anyOpen = () => document.querySelector('dialog[data-modal][open]');

// El CSS bloquea el scroll de fondo al abrir. Para que la página no salte al desaparecer la barra,
// se reserva su espacio (`scrollbar-gutter: stable`), pero solo si la página tiene barra. Se mide
// antes de abrir, porque con el modal abierto la barra ya está oculta.
function syncGutter() {
    if (anyOpen()) return;
    const root = document.documentElement;
    root.style.setProperty('--modal-gutter', innerWidth > root.clientWidth ? 'stable' : 'auto');
}

export function openModal(dialog, opener = document.activeElement) {
    if (!dialog || dialog.open) return;
    syncGutter();
    if (opener instanceof HTMLElement) openers.set(dialog, opener);
    dialog.showModal();
}

export function closeModal(dialog) {
    if (dialog?.open) dialog.close();
}

// ---------- Disparadores ----------

function onTriggerClick(event) {
    const trigger = event.target.closest?.('[data-modal-open]');
    if (!trigger) return;

    const dialog = findDialog(trigger.dataset.modalOpen);
    if (!dialog) return;

    syncGutter(); // también cuando abre el navegador (command="show-modal"): el clic ocurre antes
    openers.set(dialog, trigger);

    // El navegador ya abre el modal con command="show-modal": aquí solo se anotó el disparador.
    const native = SUPPORTS_COMMANDS && trigger instanceof HTMLButtonElement && trigger.getAttribute('command') === 'show-modal';
    if (native) return;

    // Un enlace con teclas modificadoras o clic central conserva su comportamiento normal.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    openModal(dialog, trigger);
}

// ---------- Cada dialog ----------

function emit(dialog, name) {
    dialog.dispatchEvent(new CustomEvent(name, { bubbles: true }));
}

// El <dialog> no avisa de forma uniforme cuando se abre; el atributo `open` sí cambia siempre.
function watchState(dialog) {
    isOpen.set(dialog, dialog.open);

    new MutationObserver(() => {
        const was = isOpen.get(dialog);
        if (dialog.open === was) return;
        isOpen.set(dialog, dialog.open);

        if (dialog.open) {
            emit(dialog, 'modal:open');
            return;
        }

        emit(dialog, 'modal:close');
        // Si el navegador no devolvió el foco, vuelve al disparador.
        const opener = openers.get(dialog);
        const lost = !document.activeElement || document.activeElement === document.body;
        if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
    }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
}

// Clic fuera. El <dialog> ocupa toda la ventana y es transparente: un clic sobre él (no sobre el
// panel) es un clic en el fondo. Se exige pointerdown y pointerup ahí, para no cerrar al soltar
// una selección de texto que empezó dentro del panel.
function enableBackdropClose(dialog) {
    if (dialog.dataset.backdropClose !== 'true') return;

    let startedOnBackdrop = false;
    dialog.addEventListener('pointerdown', (event) => {
        startedOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('pointerup', (event) => {
        if (startedOnBackdrop && event.target === dialog) closeModal(dialog);
        startedOnBackdrop = false;
    });
}

// wp-form avisa con `wp-form:success` (burbujea desde el <form>). Por defecto el mensaje de éxito
// queda a la vista; con data-form-success="close" el modal se cierra tras un momento.
function enableFormSuccess(dialog) {
    if (dialog.dataset.formSuccess !== 'close') return;

    dialog.addEventListener('wp-form:success', () => {
        setTimeout(() => closeModal(dialog), SUCCESS_CLOSE_DELAY);
    });
}

// ---------- Apertura automática ----------

const storageKey = (dialog) => `wp-modal:${dialog.id}`;

function wasSeen(dialog) {
    const repeat = dialog.dataset.modalRepeat || 'session';
    if (repeat === 'always') return false;

    try {
        if (repeat === 'session') return sessionStorage.getItem(storageKey(dialog)) !== null;
        const days = Number(repeat.split(':')[1]);
        const seenAt = Number(localStorage.getItem(storageKey(dialog)));
        return Boolean(seenAt) && Date.now() - seenAt < days * DAY;
    } catch {
        return false; // sin almacenamiento disponible: se comporta como "siempre"
    }
}

function markSeen(dialog) {
    const repeat = dialog.dataset.modalRepeat || 'session';
    try {
        if (repeat === 'session') sessionStorage.setItem(storageKey(dialog), '1');
        else if (repeat.startsWith('days:')) localStorage.setItem(storageKey(dialog), String(Date.now()));
    } catch {
        // sin almacenamiento: no se puede recordar
    }
}

function autoOpen(dialog) {
    const minWidth = Number(dialog.dataset.modalMinWidth) || 0;
    if (minWidth && !matchMedia(`(min-width: ${minWidth}px)`).matches) return;
    if (wasSeen(dialog)) return;

    const open = () => {
        // Nunca encima de otro modal abierto, ni si ya se abrió por otro camino.
        if (dialog.open || anyOpen()) return;
        markSeen(dialog);
        openModal(dialog, null);
    };

    const trigger = dialog.dataset.modalAuto;
    if (trigger === 'load') {
        requestAnimationFrame(open);
    } else if (trigger === 'scroll') {
        const target = Number(dialog.dataset.modalScroll) || 50;
        const onScroll = () => {
            const max = document.documentElement.scrollHeight - innerHeight;
            if (max > 0 && (scrollY / max) * 100 >= target) {
                removeEventListener('scroll', onScroll);
                open();
            }
        };
        addEventListener('scroll', onScroll, { passive: true });
    } else {
        setTimeout(open, Number(dialog.dataset.modalDelay) || 0);
    }
}

// ---------- Inicio ----------

export function initModals() {
    syncGutter();
    addEventListener('resize', syncGutter, { passive: true });
    document.addEventListener('click', onTriggerClick);

    for (const dialog of document.querySelectorAll('dialog[data-modal]')) {
        watchState(dialog);
        enableBackdropClose(dialog);
        enableFormSuccess(dialog);
        if (dialog.dataset.modalAuto) autoOpen(dialog);
    }
}
