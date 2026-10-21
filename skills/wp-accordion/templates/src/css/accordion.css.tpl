/*
 * Estilos funcionales de los acordeones (skill wp-accordion).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Genérico: no se edita por proyecto. Solo lo que el diseño no define: la fila del <summary>, el
 * ícono, el foco y el movimiento. Colores, tipografía, bordes y espacios llegan con las clases de la
 * vista (Tailwind). Va dentro de `@layer components`, así esas clases siempre ganan. Para cambiar un
 * valor de todos los acordeones a la vez, redefine las variables --accordion-* en tu CSS.
 */

@layer components {
    :root {
        --accordion-min-height: 2.75rem; /* 44 px: tamaño táctil mínimo */
        --accordion-gap: 1rem; /* entre el título y el ícono */
        --accordion-icon-size: 1.25rem;
        /* Tiempos y curvas de Material: abre desacelerando y cierra un poco más corto y neutro. */
        --accordion-duration: 225ms;
        --accordion-easing: cubic-bezier(0, 0, 0.2, 1); /* abrir */
        --accordion-easing-out: cubic-bezier(0.4, 0, 0.6, 1); /* cerrar */
    }

    /* El <summary> es el botón: una fila con el título y el ícono. Sin el marcador del navegador
       (el ícono lo reemplaza) y sin el cursor de texto. */
    .accordion__summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--accordion-gap);
        min-height: var(--accordion-min-height);
        cursor: pointer;
        list-style: none;
        -webkit-tap-highlight-color: transparent;
    }

    .accordion__summary::-webkit-details-marker { display: none; }
    .accordion__summary::marker { content: ''; }

    .accordion__summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }

    .accordion__title { flex: 1 1 auto; min-width: 0; margin: 0; overflow-wrap: anywhere; text-wrap: pretty; }

    .accordion__icon {
        flex: none;
        width: var(--accordion-icon-size);
        height: var(--accordion-icon-size);
    }

    /* Estado abierto del ícono: el chevron gira; del "plus" desaparece la barra vertical. */
    .accordion__item[open] > .accordion__summary .accordion__icon--chevron { transform: rotate(180deg); }
    .accordion__bar { transform-box: fill-box; transform-origin: center; }
    .accordion__item[open] > .accordion__summary .accordion__bar { transform: scaleY(0); }

    /* El panel recorta lo que se desborda; no fija alturas (el texto crece con el zoom). */
    .accordion__panel { min-width: 0; overflow-wrap: anywhere; }

    /* ---------- Movimiento (data-motion; ver references/motion.md) ----------
       La altura se anima con `::details-content` e `interpolate-size`: solo CSS. Donde el
       navegador no lo soporta, el ítem abre y cierra sin animar, que también es correcto.
       Con prefers-reduced-motion no hay animación. */
    @media (prefers-reduced-motion: no-preference) {
        .accordion__icon { transition: transform var(--accordion-duration) var(--accordion-easing); }
        .accordion__bar { transition: transform var(--accordion-duration) var(--accordion-easing); }

        @supports selector(::details-content) {
            .accordion { interpolate-size: allow-keywords; }

            .accordion__item::details-content {
                block-size: 0;
                overflow: clip;
                transition:
                    block-size var(--accordion-duration) var(--accordion-easing-out),
                    content-visibility var(--accordion-duration) allow-discrete;
            }

            .accordion__item[open]::details-content {
                block-size: auto;
                transition:
                    block-size var(--accordion-duration) var(--accordion-easing),
                    content-visibility var(--accordion-duration) allow-discrete;
            }
        }

        .accordion[data-motion='none'] .accordion__icon,
        .accordion[data-motion='none'] .accordion__bar,
        .accordion[data-motion='none'] .accordion__item::details-content { transition: none; }
    }

    @media (forced-colors: active) {
        .accordion__summary:focus-visible { outline-color: Highlight; }
    }
}
