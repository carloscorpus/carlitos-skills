/*
 * Estilos funcionales de los modales (skill wp-modal).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Solo lo que el diseño no define: posición, scroll, bloqueo
 * del fondo y movimiento. Colores, tipografía, radios y espacios llegan con las clases de la
 * vista (Tailwind). Va dentro de `@layer components`, así esas clases siempre ganan. Para cambiar
 * un valor de todos los modales a la vez, redefine las variables --modal-* en tu CSS.
 */

@layer components {
    :root {
        --modal-backdrop: rgb(0 0 0 / 0.6);
        --modal-bg: Canvas;
        --modal-color: CanvasText;
        --modal-width-default: 32rem;
        --modal-drawer-width: 28rem;
        --modal-padding: 1.5rem;
        --modal-close-size: 2.75rem; /* 44 px: tamaño táctil mínimo */
        /* Tiempos y curvas de Material: entra desacelerando (225 ms) y sale más corto y neutro
           (la salida dura 87 % de la entrada, 195 ms). */
        --modal-duration: 225ms; /* fundido y escala */
        --modal-slide-duration: 225ms; /* paneles laterales y hoja inferior */
        --modal-easing: cubic-bezier(0, 0, 0.2, 1); /* entrada */
        --modal-easing-out: cubic-bezier(0.4, 0, 0.6, 1); /* salida */
        --modal-stagger: 45ms; /* retraso entre elementos del cuerpo (data-stagger) */
    }

    /* El <dialog> ocupa toda la ventana y es transparente: un clic sobre él (fuera del panel)
       cuenta como clic en el fondo. El scroll vive en .modal__body. */
    dialog[data-modal] {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--modal-color);
        /* `clip`, no `hidden`: showModal() enfoca el primer control con el panel aún fuera de
           pantalla, y un contenedor `hidden` se desplaza solo para mostrarlo (el drawer "rebota").
           `clip` recorta igual pero no se puede desplazar. */
        overflow: clip;
    }

    dialog[data-modal][open] { display: grid; }

    /* La posición no depende de [open]: durante la animación de salida el atributo ya no está,
       pero el <dialog> sigue visible, y sin esto el panel saltaría a la esquina. */
    dialog[data-modal] { place-items: center; }
    dialog[data-modal][data-placement='right'] { place-items: stretch end; }
    dialog[data-modal][data-placement='left'] { place-items: stretch start; }
    dialog[data-modal][data-placement='bottom'] { place-items: end stretch; }

    /* Mientras se anima la salida el <dialog> aún se ve, pero ya no debe tapar la página. */
    dialog[data-modal]:not([open]) { pointer-events: none; }

    dialog[data-modal]::backdrop { background: var(--modal-backdrop); }

    /* Sin scroll de fondo mientras hay un modal abierto. `--modal-gutter` lo pone modal.js: es
       `stable` solo si la página tenía barra de scroll, así no salta al ocultarla. */
    html:has(dialog[data-modal][open]) {
        overflow: hidden;
        scrollbar-gutter: var(--modal-gutter, auto);
    }

    /* ---------- Panel ----------
       El ancho exacto de Figma llega en línea (`--modal-width-exact`, opción `width`). */
    .modal__panel {
        display: flex;
        flex-direction: column;
        width: min(100% - 2rem, var(--modal-width-exact, var(--modal-width-default)));
        max-height: calc(100dvh - 2rem);
        background: var(--modal-bg);
        color: var(--modal-color);
        overflow: hidden;
    }

    dialog[data-modal][data-placement='right'] .modal__panel,
    dialog[data-modal][data-placement='left'] .modal__panel {
        width: min(100%, var(--modal-width-exact, var(--modal-drawer-width)));
        height: 100%;
        max-height: none;
        padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
    }

    dialog[data-modal][data-placement='bottom'] .modal__panel {
        width: min(100%, var(--modal-width-exact, 100%));
        max-height: 90dvh;
        padding-bottom: env(safe-area-inset-bottom);
    }

    /* ---------- Móvil (opción `mobile`, data-mobile) ----------
       Sin `data-mobile` el panel centrado deja un pequeño margen. Con él manda el frame móvil. */
    @media (max-width: 40rem) {
        dialog[data-modal][data-mobile='center'] { place-items: center; }
        dialog[data-modal][data-mobile='center'] .modal__panel {
            width: min(100% - 1rem, var(--modal-width-exact, 100%));
            height: auto;
            max-height: calc(100dvh - 1rem);
        }

        dialog[data-modal][data-mobile='sheet'] { place-items: end stretch; }
        dialog[data-modal][data-mobile='sheet'] .modal__panel {
            width: 100%;
            height: auto;
            max-height: 90dvh;
            padding: 0 0 env(safe-area-inset-bottom);
        }

        dialog[data-modal][data-mobile='fullscreen'] .modal__panel {
            width: 100%;
            height: 100%;
            max-height: none;
        }
    }

    /* ---------- Estructura interna ---------- */
    .modal__header {
        display: flex;
        flex: none;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: var(--modal-padding) var(--modal-padding) 0;
    }

    .modal__header form { margin: 0; }
    .modal__title { margin: 0; text-wrap: balance; }

    /* Título presente para los lectores de pantalla, oculto a la vista. */
    .modal__title--hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
    }

    .modal__description { flex: none; margin: 0.5rem var(--modal-padding) 0; }

    .modal__close {
        display: inline-grid;
        flex: none;
        place-items: center;
        width: var(--modal-close-size);
        height: var(--modal-close-size);
        margin: -0.5rem -0.5rem 0 auto;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    .modal__close:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
    .modal__close:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }

    .modal__body {
        flex: 1 1 auto;
        min-height: 0;
        padding: var(--modal-padding);
        overflow-y: auto;
        overscroll-behavior: contain;
    }

    /* ---------- Movimiento (data-motion; ver references/motion.md) ----------
       Cada parte se anima por separado: el <dialog> NO cambia de opacidad, porque el panel se la
       heredaría y se vería translúcido. Solo el fondo se desvanece y el panel hace su movimiento.
       Sin data-motion: centrado = scale; paneles laterales y hoja inferior = slide.
       Con prefers-reduced-motion solo queda el fundido (sin desplazamiento ni escala). */
    dialog[data-modal][data-motion='none'] { --modal-anim: 0ms; }

    @media (prefers-reduced-motion: no-preference) {
        dialog[data-modal] { --modal-anim: var(--modal-duration); }

        dialog[data-modal][data-placement='right']:not([data-motion]),
        dialog[data-modal][data-placement='left']:not([data-motion]),
        dialog[data-modal][data-placement='bottom']:not([data-motion]),
        dialog[data-modal][data-motion='slide'] { --modal-anim: var(--modal-slide-duration); }

        dialog[data-modal][data-motion='none'] { --modal-anim: 0ms; }

        /* Posición de partida de cada movimiento (cerrado). */
        dialog[data-modal] .modal__panel { --from: translateY(1rem) scale(0.98); }
        dialog[data-modal][data-motion='fade'] .modal__panel { --from: none; }
        dialog[data-modal][data-placement='center'][data-motion='slide'] .modal__panel { --from: translateY(2.5rem); }
        dialog[data-modal][data-placement='right']:not([data-motion='fade']):not([data-motion='scale']) .modal__panel { --from: translateX(100%); }
        dialog[data-modal][data-placement='left']:not([data-motion='fade']):not([data-motion='scale']) .modal__panel { --from: translateX(-100%); }
        dialog[data-modal][data-placement='bottom']:not([data-motion='fade']):not([data-motion='scale']) .modal__panel { --from: translateY(100%); }
        @media (max-width: 40rem) {
            dialog[data-modal][data-mobile='sheet']:not([data-motion='fade']) { --modal-anim: var(--modal-slide-duration); }
            dialog[data-modal][data-mobile='sheet']:not([data-motion='fade']) .modal__panel { --from: translateY(100%); }
        }

        /* La transición del estado base manda al CERRAR y la de [open] al ABRIR. Así la salida
           es más corta y con otra curva que la entrada. */
        dialog[data-modal] { --modal-anim-leave: calc(var(--modal-anim) * 0.87); }

        /* Mantiene el <dialog> visible mientras dura la animación de salida. */
        dialog[data-modal] {
            transition:
                display var(--modal-anim-leave) allow-discrete,
                overlay var(--modal-anim-leave) allow-discrete;
        }

        dialog[data-modal]::backdrop {
            opacity: 0;
            transition:
                opacity var(--modal-anim-leave) linear,
                display var(--modal-anim-leave) allow-discrete,
                overlay var(--modal-anim-leave) allow-discrete;
        }

        dialog[data-modal][open]::backdrop {
            opacity: 1;
            transition:
                opacity var(--modal-anim) linear,
                display var(--modal-anim) allow-discrete,
                overlay var(--modal-anim) allow-discrete;
        }

        dialog[data-modal] .modal__panel {
            opacity: 0;
            transform: var(--from);
            transition:
                opacity var(--modal-anim-leave) linear,
                transform var(--modal-anim-leave) var(--modal-easing-out);
        }

        /* Los paneles laterales y la hoja inferior se deslizan opacos. */
        dialog[data-modal][data-placement='right']:not([data-motion='fade']):not([data-motion='scale']) .modal__panel,
        dialog[data-modal][data-placement='left']:not([data-motion='fade']):not([data-motion='scale']) .modal__panel,
        dialog[data-modal][data-placement='bottom']:not([data-motion='fade']):not([data-motion='scale']) .modal__panel { opacity: 1; }
        @media (max-width: 40rem) {
            dialog[data-modal][data-mobile='sheet']:not([data-motion='fade']) .modal__panel { opacity: 1; }
        }

        /* Estado abierto: va después de los cerrados para ganarles en igualdad de especificidad. */
        dialog[data-modal][open] .modal__panel {
            opacity: 1;
            transform: none;
            transition:
                opacity var(--modal-anim) linear,
                transform var(--modal-anim) var(--modal-easing);
        }

        @starting-style {
            dialog[data-modal][open]::backdrop { opacity: 0; }
            dialog[data-modal][open] .modal__panel { opacity: 0; transform: var(--from); }
            dialog[data-modal][data-placement='right']:not([data-motion='fade']):not([data-motion='scale'])[open] .modal__panel,
            dialog[data-modal][data-placement='left']:not([data-motion='fade']):not([data-motion='scale'])[open] .modal__panel,
            dialog[data-modal][data-placement='bottom']:not([data-motion='fade']):not([data-motion='scale'])[open] .modal__panel { opacity: 1; }
        }

        /* Microinteracción: el contenido del cuerpo entra uno tras otro (data-stagger). */
        dialog[data-modal][data-stagger] .modal__body > * {
            opacity: 0;
            transform: translateY(0.5rem);
            transition:
                opacity var(--modal-duration) ease,
                transform var(--modal-duration) var(--modal-easing);
        }

        dialog[data-modal][data-stagger][open] .modal__body > * {
            opacity: 1;
            transform: none;
            transition-delay: calc(var(--modal-stagger) * var(--i, 1));
        }

        dialog[data-modal][data-stagger] .modal__body > :nth-child(1) { --i: 1; }
        dialog[data-modal][data-stagger] .modal__body > :nth-child(2) { --i: 2; }
        dialog[data-modal][data-stagger] .modal__body > :nth-child(3) { --i: 3; }
        dialog[data-modal][data-stagger] .modal__body > :nth-child(4) { --i: 4; }
        dialog[data-modal][data-stagger] .modal__body > :nth-child(n + 5) { --i: 5; }

        @starting-style {
            dialog[data-modal][data-stagger][open] .modal__body > * { opacity: 0; transform: translateY(0.5rem); }
        }
    }

    /* Movimiento reducido: solo fundido, sin desplazamiento ni escala. */
    @media (prefers-reduced-motion: reduce) {
        dialog[data-modal] .modal__panel,
        dialog[data-modal]::backdrop {
            transition: opacity 120ms ease, display 120ms allow-discrete, overlay 120ms allow-discrete;
        }
        dialog[data-modal] .modal__panel { opacity: 0; }
        dialog[data-modal][open] .modal__panel { opacity: 1; }
        dialog[data-modal]::backdrop { opacity: 0; }
        dialog[data-modal][open]::backdrop { opacity: 1; }
        dialog[data-modal][data-motion='none'] .modal__panel,
        dialog[data-modal][data-motion='none']::backdrop { transition: none; }
        @starting-style {
            dialog[data-modal][open]::backdrop,
            dialog[data-modal][open] .modal__panel { opacity: 0; }
        }
    }

    @media (forced-colors: active) {
        .modal__panel { border: 1px solid CanvasText; }
    }
}
