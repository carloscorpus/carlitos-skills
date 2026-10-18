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
| [`wp-vite-theme`](skills/wp-vite-theme/SKILL.md) | 1.1.1   | Nada: parte de un tema vacío                            | Crea la base de un tema WordPress (Local WP) con Vite, Tailwind y pnpm.                                                                              |
| [`wp-form`](skills/wp-form/SKILL.md)             | 1.3.1   | Un tema WordPress con `functions.php` y Vite (pnpm)     | Formularios seguros y accesibles: Zod en el front y las mismas reglas en PHP, nonce, antispam, doble envío, `wp_mail` y envíos guardados opcionales. |
| [`wp-modal`](skills/wp-modal/SKILL.md)           | 1.0.2   | Un tema WordPress con `functions.php` y Vite (pnpm); Tailwind recomendado; `wp-form` es opcional | Modales, confirmaciones, drawers, hojas inferiores y lightbox con el `<dialog>` nativo: el diseño sale de Figma; accesibilidad, SEO, movimiento y auditoría. |
| [`wp-helper`](skills/wp-helper/SKILL.md)         | 1.1.0   | Un tema WordPress con `functions.php` (Vite no hace falta); ACF opcional | Helpers PHP con el prefijo del tema: imágenes seguras de campos ACF (array, ID, URL o vacío), enlaces seguros y accesibles, y texto con partes de otro color con marcadores configurables. |

Las skills son independientes: cada una funciona sola y ninguna exige haber usado otra. `wp-vite-theme` es solo una forma cómoda de partir con un tema que ya cumple lo que `wp-form` necesita. Cada skill tiene su versión (`metadata.version` en su `SKILL.md`) y su `CHANGELOG.md`; el del plugin completo está en [`CHANGELOG.md`](CHANGELOG.md).

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

En un tema WordPress con Vite y pnpm, pide `arma el modal de promoción` o pásale un frame de Figma (o un spec con `skill: wp-modal`). Deduce el tipo de panel (modal, confirmación, drawer, hoja inferior, lightbox) del diseño y te pregunta lo que falta: disparador, apertura automática, movimiento y, si lleva un formulario, si va con `wp-form` o independiente. Instala el motor la primera vez.

El diseño es de Figma: ancho exacto, comportamiento móvil y clases por parte. La skill pone lo demás: el `<dialog>` nativo (foco atrapado, Esc, fondo inerte), un botón de cerrar accesible, el bloqueo de scroll sin saltos, `prefers-reduced-motion` y opciones de movimiento.

```text
inc/modals.php                 motor (no se edita por proyecto)
src/js/modules/modal.js        motor JS (no se edita por proyecto)
src/css/modal.css              motor CSS en @layer components, variables --modal-*
template-parts/modals/<id>.php vista de cada modal (diseño de Figma)
```

- Sin vistas de ejemplo: la skill las arma desde el frame. El detalle está en `skills/wp-modal/references/`.
- Auditoría: `node skills/wp-modal/tests/check.mjs <url | archivo.html>` revisa nombre accesible, botón de cerrar, `h1`, ids, disparadores, imágenes e iframes.
- Un form dentro del modal con `wp-form` necesita `wp-form` 1.3.0 o posterior.

## wp-helper

En un tema WordPress, pide `instala los helpers` (o corre la skill al final de `wp-vite-theme`, que la ofrece). Te pregunta cuál incluir: **imágenes**, **enlaces**, **texto de dos colores**, todos, o uno **local nuevo** solo para ese proyecto. El de imágenes y el de enlaces se recomiendan en todos los proyectos.

```text
inc/helpers/images.php         motor: <prefijo>_image_data(), <prefijo>_image() (no se edita por proyecto)
inc/helpers/text.php           motor: <prefijo>_highlight() (no se edita por proyecto)
inc/helpers/links.php          motor: <prefijo>_link(), _link_attrs(), _link_data() (no se edita por proyecto)
inc/helpers/text-styles.php    estilos del proyecto: marcador + clase (lo escribe --add-style)
inc/helpers/<nombre>.php       helper local del proyecto
```

- **Imágenes:** acepta lo que entregue un campo de imagen de ACF (array, ID o URL), un adjunto o un valor vacío. Una imagen borrada o un PDF dan `null` / `''` en vez de romper la vista. Cambiar el formato de retorno del campo no rompe nada.
- **Enlaces:** acepta el campo Link o URL de ACF. Descarta enlaces vacíos, `#` o con protocolo inseguro; `target="_blank"` siempre lleva `rel="noopener"` (y `noreferrer` si es externo); `mailto`, `tel` y anclas no abren pestaña nueva; avisa a los lectores de pantalla de la pestaña nueva y nunca agrega `nofollow` solo. `<prefijo>_link_attrs()` da solo los atributos para un `<a>` o botón con íconos.
- **Texto de dos colores:** `Negro |naranja| y *rojo*`. Cada estilo tiene su marcador (`* | ~ ^ =`) y su clase; `--add-style` falla si el marcador o el nombre ya están en uso y lista los libres. `-` y `_` no se aceptan como marcadores, para no chocar con texto normal.
- Comandos: `node skills/wp-helper/scripts/install.mjs --list | --helpers images,text,links | --add-style … | --check`.
- Prueba: `node skills/wp-helper/tests/check.mjs` (necesita `php`; busca el de Local solo).
- Guardas de subida en el admin (peso, formatos) no están incluidas.

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
