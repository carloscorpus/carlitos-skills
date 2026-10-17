/*
 * Estilos funcionales de los modales (skill wp-modal).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Va dentro de `@layer components`, así que las clases de
 * Tailwind (o tu CSS sin capa) de la vista pueden sobrescribirlo. Para cambiar el aspecto sin
 * tocar este archivo, redefine las variables --modal-* en tu CSS.
 */

@layer components {
    :root {
        --modal-backdrop: rgb(0 0 0 / 0.6);
        --modal-bg: Canvas;
        --modal-color: CanvasText;
        --modal-radius: 1rem;
        --modal-padding: 1.5rem;
        --modal-duration: 200ms; /* modal centrado: aparece con un fundido corto */
        --modal-slide-duration: 300ms; /* paneles laterales y hoja inferior: se deslizan */
        --modal-slide-easing: cubic-bezier(0.32, 0.72, 0, 1);
        --modal-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.35);
        --modal-width-sm: 24rem;
        --modal-width-md: 32rem;
        --modal-width-lg: 48rem;
        --modal-width-xl: 64rem;
        --modal-drawer-width: 28rem;
        --modal-drawer-radius: 0;
        --modal-close-size: 2.75rem; /* 44 px: tamaño táctil mínimo */
        --modal-title-size: 1.25rem;
        --modal-title-weight: 600;
        --modal-title-leading: 1.3;
        --modal-header-gap: 1rem;
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
        overflow: hidden;
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

    /* Modo no modal: la página sigue usable, el <dialog> no debe interceptar clics. */
    dialog[data-modal][data-mode='non-modal'] { pointer-events: none; }
    dialog[data-modal][data-mode='non-modal'] .modal__panel { pointer-events: auto; }

    dialog[data-modal]::backdrop { background: var(--modal-backdrop); }

    /* Sin scroll de fondo mientras hay un modal abierto. `--modal-gutter` lo pone modal.js: es
       `stable` solo si la página tenía barra de scroll, así no salta al ocultarla ni reserva
       espacio de más en una página corta. */
    html:has(dialog[data-modal][data-mode='modal'][open]) {
        overflow: hidden;
        scrollbar-gutter: var(--modal-gutter, auto);
    }

    /* ---------- Ancho ----------
       Con diseño, el ancho exacto llega en línea (`style="--modal-width-exact: …"`, opción `width`)
       y gana a estos tamaños, que son solo un respaldo para cuando no hay diseño. Es otra variable
       a propósito: todo modal trae un tamaño (md por defecto) y no debe afectar a los paneles
       laterales, que tienen su propio ancho. */
    dialog[data-modal][data-size='sm'] { --modal-width: var(--modal-width-sm); }
    dialog[data-modal][data-size='md'] { --modal-width: var(--modal-width-md); }
    dialog[data-modal][data-size='lg'] { --modal-width: var(--modal-width-lg); }
    dialog[data-modal][data-size='xl'] { --modal-width: var(--modal-width-xl); }

    .modal__panel {
        display: flex;
        flex-direction: column;
        width: min(100% - 2rem, var(--modal-width-exact, var(--modal-width, var(--modal-width-md))));
        max-height: calc(100dvh - 2rem);
        background: var(--modal-bg);
        color: var(--modal-color);
        border-radius: var(--modal-radius);
        box-shadow: var(--modal-shadow);
        overflow: hidden;
    }

    dialog[data-modal][data-size='full'] .modal__panel {
        width: 100%;
        height: 100%;
        max-height: none;
        border-radius: 0;
    }

    /* ---------- Paneles laterales y hoja inferior ---------- */
    dialog[data-modal][data-placement='right'] .modal__panel,
    dialog[data-modal][data-placement='left'] .modal__panel {
        width: min(100%, var(--modal-width-exact, var(--modal-drawer-width)));
        height: 100%;
        max-height: none;
        border-radius: var(--modal-drawer-radius);
        padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
    }

    dialog[data-modal][data-placement='bottom'] .modal__panel {
        width: 100%;
        max-height: 90dvh;
        border-radius: var(--modal-radius) var(--modal-radius) 0 0;
        padding-bottom: env(safe-area-inset-bottom);
    }

    /* ---------- Móvil (opción `mobile`, atributo data-mobile) ----------
       Sin `data-mobile` (por defecto): los modales grandes ocupan toda la pantalla y el resto deja
       un margen. Con `data-mobile` el diseño móvil de Figma manda: center, sheet o fullscreen. */
    @media (max-width: 40rem) {
        dialog[data-modal][data-placement='center']:not([data-mobile]):not([data-size='full']) .modal__panel {
            width: calc(100% - 1rem);
            max-height: calc(100dvh - 1rem);
        }

        dialog[data-modal][data-placement='center']:not([data-mobile])[data-size='lg'] .modal__panel,
        dialog[data-modal][data-placement='center']:not([data-mobile])[data-size='xl'] .modal__panel {
            width: 100%;
            height: 100%;
            max-height: none;
            border-radius: 0;
        }

        dialog[data-modal][data-mobile='center'] { place-items: center; }
        dialog[data-modal][data-mobile='center'] .modal__panel {
            width: min(100% - 1rem, var(--modal-width-exact, var(--modal-width, 100%)));
            height: auto;
            max-height: calc(100dvh - 1rem);
            border-radius: var(--modal-radius);
            padding: 0;
        }

        dialog[data-modal][data-mobile='sheet'] { place-items: end stretch; }
        dialog[data-modal][data-mobile='sheet'] .modal__panel {
            width: 100%;
            height: auto;
            max-height: 90dvh;
            border-radius: var(--modal-radius) var(--modal-radius) 0 0;
            padding: 0 0 env(safe-area-inset-bottom);
        }

        dialog[data-modal][data-mobile='fullscreen'] .modal__panel {
            width: 100%;
            height: 100%;
            max-height: none;
            border-radius: 0;
        }
    }

    /* ---------- Estructura interna ---------- */
    .modal__header {
        display: flex;
        flex: none;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--modal-header-gap);
        padding: var(--modal-padding) var(--modal-padding) 0;
    }

    .modal__header form { margin: 0; }

    .modal__title {
        margin: 0;
        font-size: var(--modal-title-size);
        font-weight: var(--modal-title-weight);
        line-height: var(--modal-title-leading);
        text-wrap: balance;
    }

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

    .modal__description {
        flex: none;
        margin: 0.5rem var(--modal-padding) 0;
    }

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

    /* Opcional: fila de botones al final del contenido. */
    .modal__footer {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1.5rem;
    }

    /* ---------- Animación (se omite con prefers-reduced-motion) ----------
       Cada parte se anima por separado: el <dialog> NO cambia de opacidad, porque se la heredaría
       el panel y se vería translúcido. Solo el fondo se desvanece; el modal centrado se desvanece
       y sube un poco; los paneles laterales y la hoja inferior se deslizan opacos desde su borde. */
    @media (prefers-reduced-motion: no-preference) {
        dialog[data-modal] { --modal-anim: var(--modal-duration); }

        dialog[data-modal][data-placement='right'],
        dialog[data-modal][data-placement='left'],
        dialog[data-modal][data-placement='bottom'] { --modal-anim: var(--modal-slide-duration); }

        /* Mantiene el <dialog> visible mientras dura la animación de salida. */
        dialog[data-modal] {
            transition:
                display var(--modal-anim) allow-discrete,
                overlay var(--modal-anim) allow-discrete;
        }

        dialog[data-modal]::backdrop {
            opacity: 0;
            transition:
                opacity var(--modal-anim) ease,
                display var(--modal-anim) allow-discrete,
                overlay var(--modal-anim) allow-discrete;
        }

        dialog[data-modal][open]::backdrop { opacity: 1; }

        dialog[data-modal][data-placement='center'] .modal__panel {
            opacity: 0;
            transform: translateY(1rem) scale(0.98);
            transition:
                opacity var(--modal-anim) ease,
                transform var(--modal-anim) ease;
        }

        dialog[data-modal][data-placement='right'] .modal__panel,
        dialog[data-modal][data-placement='left'] .modal__panel,
        dialog[data-modal][data-placement='bottom'] .modal__panel {
            transition: transform var(--modal-anim) var(--modal-slide-easing);
        }

        dialog[data-modal][data-placement='right'] .modal__panel { transform: translateX(100%); }
        dialog[data-modal][data-placement='left'] .modal__panel { transform: translateX(-100%); }
        dialog[data-modal][data-placement='bottom'] .modal__panel { transform: translateY(100%); }

        /* mobile="sheet": en pantallas pequeñas se desliza desde abajo, opaca, como la hoja inferior. */
        @media (max-width: 40rem) {
            dialog[data-modal][data-mobile='sheet'] { --modal-anim: var(--modal-slide-duration); }
            dialog[data-modal][data-mobile='sheet'] .modal__panel {
                opacity: 1;
                transform: translateY(100%);
                transition: transform var(--modal-anim) var(--modal-slide-easing);
            }
        }

        /* Estado abierto: va después de los cerrados para ganarles en igualdad de especificidad. */
        dialog[data-modal][open] .modal__panel {
            opacity: 1;
            transform: none;
        }

        @starting-style {
            dialog[data-modal][open]::backdrop { opacity: 0; }
            dialog[data-modal][data-placement='center'][open] .modal__panel {
                opacity: 0;
                transform: translateY(1rem) scale(0.98);
            }
            dialog[data-modal][data-placement='right'][open] .modal__panel { transform: translateX(100%); }
            dialog[data-modal][data-placement='left'][open] .modal__panel { transform: translateX(-100%); }
            dialog[data-modal][data-placement='bottom'][open] .modal__panel { transform: translateY(100%); }
        }

        @media (max-width: 40rem) {
            @starting-style {
                dialog[data-modal][data-mobile='sheet'][open] .modal__panel {
                    opacity: 1;
                    transform: translateY(100%);
                }
            }
        }
    }

    @media (forced-colors: active) {
        .modal__panel { border: 1px solid CanvasText; }
    }
}
