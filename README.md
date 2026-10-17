<div align="center">
	<h1>carlitos-skills</h1>
	<p>Colección de skills para proyectos WordPress con Vite, JavaScript, Tailwind CSS y pnpm.</p>
	<p>
		<a href="https://wordpress.org/"><img src="https://img.shields.io/badge/WordPress-Local%20WP-21759B?style=flat-square&logo=wordpress&logoColor=white" alt="WordPress Local WP"></a>
		<a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-latest-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
		<a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind%20CSS-latest-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
		<a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-required-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm"></a>
	</p>
</div>

## Skills

| Skill                                            | Versión | Requiere                                                | Qué hace                                                                                                                                             |
| ------------------------------------------------ | ------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`wp-vite-theme`](skills/wp-vite-theme/SKILL.md) | 1.1.0   | Nada: parte de un tema vacío                            | Crea la base de un tema WordPress (Local WP) con Vite, Tailwind y pnpm.                                                                              |
| [`wp-form`](skills/wp-form/SKILL.md)             | 1.2.0   | Un tema WordPress con `functions.php` y Vite (pnpm)     | Formularios seguros y accesibles: Zod en el front y las mismas reglas en PHP, nonce, antispam, doble envío, `wp_mail` y envíos guardados opcionales. |
| [`wp-modal`](skills/wp-modal/SKILL.md)           | 1.1.0   | Un tema WordPress con `functions.php` y Vite (pnpm)     | Modales, drawers, lightbox y confirmaciones con el `<dialog>` nativo: accesibles, responsive y con el contenido y el diseño de cada proyecto (Figma). |

Las skills son independientes: cada una funciona sola y ninguna exige haber usado otra. `wp-vite-theme` es solo una forma cómoda de partir con un tema que ya cumple lo que `wp-form` y `wp-modal` necesitan. Cada skill tiene su versión (`metadata.version` en su `SKILL.md`) y su `CHANGELOG.md`; el del plugin completo está en [`CHANGELOG.md`](CHANGELOG.md).

## Instalación

### Claude Code (recomendado)

Una vez por PC, dentro de Claude Code:

```
/plugin marketplace add carloscorpus/carlitos-skills
/plugin install carlitos-skills@carlitos-skills
```

Para recibir skills nuevas o cambios:

```
/plugin marketplace update carlitos-skills
```

Las skills se invocan con el prefijo del plugin, por ejemplo `/carlitos-skills:wp-vite-theme`, o se activan solas al decir "nuevo tema wp".

### Otros agentes (CLI `skills`)

```bash
pnpm dlx skills@latest add carloscorpus/carlitos-skills -g
```

Usa `pnpm` porque el CLI lo declara en `devEngines`. Con npm/npx 11 puede aparecer `EBADDEVENGINES`.

## wp-vite-theme

Desde la carpeta del tema (`wp-content/themes/<slug>`), pide al agente `inicia tema`, `nuevo tema wp` o `scaffold theme`. Detecta el slug de la carpeta, pregunta los datos que falten y no sobrescribe archivos sin confirmación.

Genera:

```text
style.css, functions.php, header.php, footer.php, index.php
page-templates/template-inicio.php   plantilla "Página de inicio"
inc/{setup,enqueue,cleanup}.php
src/css/input.css, src/js/main.js
vite.config.ts, pnpm-workspace.yaml, package.json
```

- Las páginas con diseño propio van en `page-templates/template-<nombre>.php`. No se crea `front-page.php`: en el admin crea la página "Inicio", elige la plantilla "Página de inicio" y fíjala en Ajustes → Lectura.
- `pnpm dev`: inicia Vite y crea el indicador `hot`.
- `pnpm build`: genera `dist/manifest.json` y los assets finales.
- WordPress usa Vite en desarrollo y el manifest en producción.

**Despliegue:** ejecuta `pnpm build` con el servidor detenido. Publica `dist/` junto con los PHP modificados. No publiques `hot`, `node_modules/`, `src/` ni los archivos de configuración.

## wp-form

En un tema WordPress con Vite y pnpm (creado con `wp-vite-theme` o a mano), pide `arma el form de contacto` (o usa un spec con `skill: wp-form`). Te pregunta lo que falta (destinatarios, página de gracias, si guarda los envíos, CRM) e instala el motor la primera vez. Detecta el JS principal leyendo `vite.config.*`; si no puede, te pide la ruta (`--entry`).

Cada form se define una sola vez en `inc/forms/<id>.php`. De esa definición salen los atributos del HTML, el esquema Zod del navegador y la validación en PHP: los dos lados usan las mismas reglas, en el mismo orden y con los mismos mensajes. `skills/wp-form/tests/` lo comprueba corriendo los mismos casos en PHP y en JS, y si algo llegara a diferir, el error del servidor vuelve al campo.

```text
inc/forms.php                   motor (no se edita por proyecto)
src/js/modules/form.js          motor JS con Zod (no se edita por proyecto)
inc/forms-entries.php           opcional: menú "Envíos" en el admin
inc/forms/<id>.php              definición de cada form
template-parts/forms/<id>.php   vista de cada form (diseño de Figma)
```

El detalle de la skill (tipos de campo, contrato de la vista, integraciones, comportamiento del motor y criterios de aceptación) está en `skills/wp-form/references/`; el agente lo lee solo cuando el paso lo pide.

- Correo solo con `wp_mail()`: Mailpit en local, Fluent SMTP en producción.
- Necesita `zod` en su última versión estable (`pnpm add zod@latest`); se carga solo en páginas con un form.
- Envíos guardados (opcional): solo los ven administradores, sin borrado automático (se eliminan desde la lista) y conectados a las herramientas de datos personales de WordPress.

## wp-modal

En un tema WordPress con Vite y pnpm, pide `arma un modal de promoción`, `un drawer`, `un lightbox` o `una confirmación` (o usa un spec con `skill: wp-modal`). Primero decide con el diseño si el panel es un **modal**, un **diálogo no modal** (la página sigue usable) o un simple `<aside>`; si el diseño no lo deja claro, te pregunta. También pregunta si el modal se abre solo, porque eso depende de cada proyecto.

La estructura es fija (título, botón de cerrar, zona con scroll) y el contenido es libre. Casi todo lo da el navegador: el `<dialog>` con `showModal()` ya trae el foco atrapado, el fondo inerte, la tecla Esc y la devolución del foco, y los atributos `command`/`commandfor` abren el modal sin JavaScript. El motor solo agrega lo que falta: abrir en navegadores antiguos, cerrar con clic fuera, apertura automática opcional y los eventos `modal:open` / `modal:close`.

```text
inc/modals.php                  motor PHP (no se edita por proyecto)
src/js/modules/modal.js         motor JS, se carga solo en páginas con un modal
src/css/modal.css               estilos funcionales con variables --modal-* (se importa desde el CSS principal)
template-parts/modals/<id>.php  vista de cada modal (contenido libre)
```

- **El diseño sale de Figma, no de la skill.** El motor solo fija el comportamiento y la accesibilidad. El ancho exacto va en `width`, el comportamiento en móvil en `mobile` (`center`, `sheet` o `fullscreen`), el aspecto en clases por parte (`title_class`, `close_class`, `body_class`...) y lo común a varios modales en variables `--modal-*` del proyecto. Los tamaños `sm/md/lg/xl/full` son solo un respaldo cuando no hay diseño. Ver `skills/wp-modal/references/figma-mapping.md`.
- Detecta el JS y el CSS principales leyendo `vite.config.*`; si no puede, te pide las rutas (`--entry`, `--css`).
- Un modal no mejora el SEO: la skill solo evita perjudicarlo (contenido en el HTML, enlace rastreable si hay una página real, sin pop-ups al cargar salvo que el proyecto lo pida).
- `skills/wp-modal/tests/check.mjs` audita el HTML renderizado de una página (nombre accesible, `h1`, botón de cerrar, disparadores, imágenes). La lista de pruebas en navegador está en `skills/wp-modal/references/acceptance.md`.
- Ejemplos incluidos: contenido/promoción, confirmación (`alertdialog`), lightbox, panel lateral y un formulario de `wp-form` dentro de un modal.

## Agregar una skill

1. Crea `skills/<nombre>/SKILL.md` con `name`, `description` y `metadata.version` (empieza en `"1.0.0"`) en el frontmatter, y un `CHANGELOG.md` en su carpeta.
2. Si tiene scripts, ponlos en `skills/<nombre>/scripts/` y usa el código común (`import ... from './lib/common.mjs'`). **No edites `scripts/lib/`**: es una copia generada. Si necesitas cambiar algo común, edita `shared/common.mjs` y corre `node scripts/sync-shared.mjs`.
3. Si la skill deja archivos en el proyecto, que escriba un bloque corto (3-5 líneas) en su `CLAUDE.md` con `claudeBlock()` de `shared/common.mjs`: qué archivos creó, cuáles no se editan y sus reglas. Así `CLAUDE.md` refleja lo que el proyecto realmente usa, sin crecer de más.
4. No asumas otra skill: si necesita algo del tema, detéctalo o pregúntalo, y decláralo en la columna "Requiere" de la tabla de este README.
5. Agrégala a la tabla de este README.
6. Sube `metadata.version` de la skill que cambió, anótalo en su `CHANGELOG.md` y en el `CHANGELOG.md` de la raíz, y sube `version` en `.claude-plugin/plugin.json`.
7. Antes del commit: `node scripts/sync-shared.mjs --check` (debe salir con `0`).
8. Haz commit y push; en cada PC, `/plugin marketplace update carlitos-skills`.

## Licencia

La licencia de este repositorio está pendiente de definir. Hasta que se publique un archivo `LICENSE`, no se concede permiso explícito para redistribuirlo.
