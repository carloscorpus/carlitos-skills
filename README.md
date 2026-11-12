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
| [`wp-vite-theme`](skills/wp-vite-theme/SKILL.md) | 1.3.1   | Nada: parte de un tema vacío                            | Crea la base de un tema WordPress (Local WP) con Vite, Tailwind y pnpm.                                                                              |
| [`wp-form`](skills/wp-form/SKILL.md)             | 1.5.0   | Un tema WordPress con `functions.php` y Vite (pnpm)     | Formularios seguros y accesibles: Zod en el front y las mismas reglas en PHP, nonce, antispam, doble envío, `wp_mail` y envíos guardados opcionales. |
| [`wp-modal`](skills/wp-modal/SKILL.md)           | 1.0.3   | Un tema WordPress con `functions.php` y Vite (pnpm); Tailwind recomendado; `wp-form` es opcional | Modales, confirmaciones, drawers, hojas inferiores y lightbox con el `<dialog>` nativo: el diseño sale de Figma; accesibilidad, SEO, movimiento y auditoría. |
| [`wp-accordion`](skills/wp-accordion/SKILL.md)   | 1.0.0   | Un tema WordPress con `functions.php` y Vite (pnpm); Tailwind recomendado | Acordeones y FAQ con el `<details>` nativo: el diseño sale de Figma; accesibilidad, SEO, movimiento solo con CSS, responsive y auditoría. |
| [`wp-helper`](skills/wp-helper/SKILL.md)         | 1.3.1   | Un tema WordPress con `functions.php` (Vite no hace falta); ACF opcional | Helpers PHP con el prefijo del tema: imágenes seguras de campos ACF (array, ID, URL o vacío), enlaces seguros y accesibles, y texto con partes de otro color con marcadores configurables. |
| [`design-import`](skills/design-import/SKILL.md) | 1.17.0  | Un tema WordPress y la carpeta de un diseño (`/add-dir`) o links de Figma; sigue la estructura de `wp-vite-theme` o la que detecte | Reordena el diseño exportado por Claude Design (HTML + CSS + JS con malas prácticas) en tokens, componentes, secciones y plantillas; deja un spec por página con los grupos y campos ACF documentados (también lo que se repite en todo el sitio, blog, catálogo y Woo, solo documentados o maquetados) y aplica solo lo que apruebas. |
| [`wp-acf`](skills/wp-acf/SKILL.md)               | 1.12.2  | Un tema WordPress con los specs de `design-import` aplicados y ACF Pro 6.2 o superior; `wp-helper` recomendado | Pasa los specs a ACF Pro administrable: campos, tipos de contenido, taxonomías y páginas de opciones como ACF JSON sincronizado con la base de datos, el contenido del diseño cargado como contenido real, menús, logo y las plantillas leyendo de ACF. |
| [`wp-query`](skills/wp-query/SKILL.md)           | 1.2.1   | Un tema WordPress con Vite y los specs de `design-import` (tabla Filtros); los tipos de contenido y campos de `wp-acf` | Hace funcionar los listados de posts y tipos de contenido: el loop real, filtros combinados (taxonomías, opciones ACF, rangos, fechas, búsqueda y orden), conteos, paginación, relacionados, SEO de las páginas filtradas y filtrar sin recargar. El diseño pone el HTML. |
| [`wp-woocommerce`](skills/wp-woocommerce/SKILL.md) | 1.1.0 | Un tema WordPress con Vite y los specs de `design-import` con contenido `Origen: woo` y su tabla WooCommerce; el plugin WooCommerce en el Local para comparar versiones | Conecta la tienda que `design-import` maquetó sin perder el diseño ni romperse al actualizar WooCommerce: soporte del tema, los marcadores `// woo:` reemplazados por las funciones de WooCommerce con todos sus hooks, `@version` de cada plantilla igual a la original, mini-carrito que se actualiza solo, CSS de los bloques y una auditoría (sin pagos ni pedidos en el tema). Carrito, checkout, mini-carrito y cuenta: plantilla clásica o bloques, según el spec. |
| [`wp-manual`](skills/wp-manual/SKILL.md)         | 1.1.0   | Un tema WordPress con ACF Pro y `acf-json/` (`wp-acf`); los specs de `design-import` ayudan a redactar; Edge o Chrome instalado y `playwright-core`, que se toma del proyecto o de otra carpeta y no se instala solo | Arma el manual de administración del cliente en PDF (horizontal, vertical o ambos): login, reglas generales, opciones, cada página con sus campos numerados sobre la captura del admin y la sección de la web como referencia, entradas y tipos de contenido, menús y logo. Borradores revisables, capturas de solo lectura del sitio local y un reporte aparte con lo que no se cubrió. |
| [`img-webp`](skills/img-webp/SKILL.md)           | 1.0.0   | Nada: cualquier carpeta con imágenes (WordPress no hace falta); necesita `sharp`, que se toma del proyecto y no se instala solo | Convierte PNG, JPG y JPEG a WebP: cada imagen conserva su tamaño (solo se reduce lo que pasa de 2000 px de ancho) y su transparencia; los originales se mueven a un respaldo; actualiza las referencias (PHP, CSS, JS, specs) y se puede deshacer. SVG, GIF, AVIF y WebP no se tocan. |

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
front-page.php                       portada del sitio
pages/                               plantillas de las demás páginas
template-parts/pages/<página>/       secciones de una sola página (home/, nosotros/)
template-parts/components/           piezas reutilizables (card, botón)
inc/{setup,enqueue,cleanup,crear-inicio}.php
src/css/input.css, src/js/main.js
vite.config.ts, pnpm-workspace.yaml, package.json
```

- La portada es `front-page.php`: WordPress la usa sola, sin elegir plantilla. Al activar el tema se crea la página "Inicio" y queda como portada (solo si el sitio aún no tiene una); ahí se guardan los campos de la home.
- Las demás páginas con diseño propio van en `pages/template-<nombre>.php`.
- Una sección que usa una sola página va en `template-parts/pages/<página>/`; si se repite en 2 o más páginas (o es un bloque chico), en `template-parts/components/`.
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

## wp-accordion

En un tema WordPress con Vite y pnpm, pide `arma el acordeón de preguntas frecuentes` o pásale un frame de Figma (o un spec con `skill: wp-accordion`). Te pregunta lo que falta: uno abierto a la vez o varios, cuál empieza abierto, si los títulos son encabezados de la página, si el contenido sale de una lista (por ejemplo un repeater de ACF) y el movimiento. Instala el motor la primera vez.

El diseño es de Figma: clases por parte, ícono (`chevron` o `plus`, al inicio o al final) y estilos compartidos como variables `--accordion-*`. La skill pone lo demás: un `<details>` nativo por ítem (teclado, estado y nombre accesible sin JavaScript), `<summary>` de al menos 44 px, foco visible, panel sin alturas fijas y movimiento de altura solo con CSS que se apaga con `prefers-reduced-motion`.

```text
inc/accordions.php                 motor (no se edita por proyecto)
src/js/modules/accordion.js        motor JS mínimo (no se edita por proyecto)
src/css/accordion.css              motor CSS en @layer components, variables --accordion-*
template-parts/accordions/<id>.php vista de cada acordeón (diseño de Figma)
```

- JS mínimo: modo exclusivo en navegadores viejos, abrir el ítem al llegar con un `#ancla` y eventos `accordion:open` / `accordion:close`. Sin él, el acordeón funciona igual.
- Sin datos estructurados `FAQPage`: desde 2023 Google solo muestra ese resultado a sitios de gobierno y salud, así que en un sitio normal no aporta. El detalle está en `skills/wp-accordion/references/seo.md`.
- Auditoría: `node skills/wp-accordion/tests/check.mjs <url | archivo.html>` revisa título del botón, interactivos dentro del `<summary>`, `h1`, ARIA armado a mano, paneles ocultos, `name` en modo exclusivo, ids, imágenes e iframes.
- Sin vistas de ejemplo: la skill las arma desde el diseño. El detalle está en `skills/wp-accordion/references/`.

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

## design-import

En un tema WordPress (con `wp-vite-theme` o a mano), agrega la carpeta del diseño con `/add-dir` y pide `importa el diseño` o `reordena el diseño de Claude Design`. La carpeta se lee como datos: nunca se ejecuta nada de ella. La skill conserva el aspecto y rehace la estructura: tokens, componentes, secciones y plantillas, sin estilos inline, `!important`, `div` por `button`, JS inline ni encabezados desordenados.

Trabaja por etapas y se detiene a que apruebes:

1. **Inventario** (`analyze.mjs`, solo lectura): páginas y secciones, colores, tipografías, espaciados, bloques repetidos, formularios/modales/acordeones y malas prácticas con archivo:línea.
2. **Compartido** (`specs/_shared.md`): primero el alcance (te pregunta qué es cada página: estática, blog, catálogo o WooCommerce, con sus taxonomías, filtros y la acción del botón) y luego tokens, componentes y nomenclatura. Lo apruebas antes de seguir.
3. **Un spec por página** (`specs/<página>.md`): resumen, y por sección origen, destino, skill, campos ACF, comportamiento y criterios de aceptación propios (los comunes están una sola vez en `_shared.md`). Con más de tres páginas, un subagente por página.
4. **Aplicar** solo las páginas `aprobado`. Formularios, modales y acordeones van a `wp-form` / `wp-modal` / `wp-accordion`; imágenes y enlaces, a `wp-helper`.

```text
specs/_index.md                          páginas y su estado (pendiente, aprobado, descartado, aplicado)
specs/_shared.md                         tokens, componentes compartidos, nomenclatura
specs/<página>.md                        resumen de la página + una sección por bloque
template-parts/pages/<página>/<sección>.php
template-parts/components/<nombre>.php
```

- **Figma en vez de carpeta:** si en lugar de una carpeta tienes el diseño en Figma, pega los links de cada página en `specs/figma/enlaces/<página>.md` (el frame de la página y sus secciones con el nombre que tú les pones); `init.mjs --figma` crea `_ejemplo.md` y `home.md`. Los links se validan (`figma-links.mjs`), se lee cada sección con el MCP de Figma a `specs/figma/lectura/` (`figma-lectura.mjs` la valida; las imágenes se bajan tal como las entrega Figma) y `figma-inventario.mjs` arma el inventario con las mismas claves de `analyze.mjs`. Debajo de cada sección puedes poner, con sangría, el link de su versión móvil (opcional, solo si el diseño la tiene) y notas con lo que el diseño no muestra (qué hace un botón, qué se mueve solo, qué cambia el cliente); las notas de toda la página van en `## Notas`. Tus notas pasan tal cual al spec y mandan sobre lo que se ve en Figma; si chocan con el diseño, la skill pregunta. De ahí en adelante es igual: `_shared.md`, un spec por página, aplicar. Sin links de Figma ni `specs/figma/`, nada de esto corre: la carpeta sigue siendo lo predeterminado.
- **Imágenes pesadas:** si el diseño trae PNG, JPG o JPEG, ofrece **una vez** la skill `img-webp` antes de escribir las plantillas (así nacen con nombres `.webp`); si ya la pediste la usa directo, y si no está instalada sigue sin ella. Nunca convierte SVG.
- **Destino:** si el tema tiene la estructura de `wp-vite-theme`, la usa sin preguntar. Si es otro proyecto, lo analiza y confirma el mapeo una sola vez.
- **Solo front:** los campos ACF se documentan en el spec (nombre `<página>_<sección>_<campo>` en español, tipo, descripción, valor actual); no se crean. El texto queda fijo en la plantilla y cada campo apunta a su valor actual para pasarlo a ACF después.
- **Grupos ACF:** cada página es un grupo de campos con su regla de ubicación y cada sección es un campo `group` (`home_hero`); los nombres siguen siendo `home_hero_titulo`.
- **Todo el sitio:** el logo y el ícono van en Personalizar (Identidad del sitio), los menús son menús de WordPress y lo demás que se repite (logo alternativo, contacto, redes, textos del pie) son campos de una página de opciones, documentados en `specs/opciones.md` con nombres `opciones_<área>_<campo>`.
- **Blog, catálogo y WooCommerce:** se preguntan una vez y se documentan (tipo de contenido, taxonomías, filtros, plantillas, acción del botón). Se maquetan con elementos de ejemplo fijos; no escribe consultas, filtrado real, paginación ni lógica de Woo.
- **Sin límites para el usuario:** la descripción de un campo recomienda largo de texto y medida de imagen, pero no se valida nada; la imagen se adapta al diseño con `aspect-ratio` y `object-cover`.
- Comandos: `node skills/design-import/scripts/analyze.mjs --source <carpeta>`, `init.mjs [--page <slug> …]`, `check.mjs`; con Figma: `init.mjs --figma`, `figma-links.mjs`, `figma-lectura.mjs`, `figma-inventario.mjs`.
- Prueba: `node skills/design-import/tests/check.mjs`.
- No incluye comparación visual automática (la revisión del resultado es tuya).

## wp-acf

Después de `design-import`: pide `pasa los specs a ACF`, `crea los campos ACF` o `hazlo administrable`. Toma las páginas con estado `aplicado` y deja todo editable en el admin de WordPress. No hace falta escribir PHP para registrar nada: lo que ACF puede describir es ACF JSON.

1. **Motor** (`install.mjs`): copia `inc/acf/runner.php` (genérico, con el prefijo del tema), `inc/acf/sitio.php` y `inc/acf/seed/`, y lo conecta a `functions.php`.
2. **JSON de golpe** (`generate.mjs`): un grupo por página (cada sección es un campo `group`), tipos de contenido y taxonomías de la tabla "Contenido dinámico", páginas de opciones y la lista de páginas de WordPress. Claves estables a partir del nombre.
3. **Sitio**: menús, logo de Personalizar y las opciones del sitio (cabecera, pie, aviso).
4. **Una página a la vez**, con un subagente por página si son más de tres: el texto, las imágenes y los enlaces salen de la plantilla hacia `inc/acf/seed/<página>.php` y la plantilla lee con `get_field`.
5. **Verificar** (`check.mjs`): el JSON coincide con los specs y cada sección conectada lee su grupo y tiene su carga.

```text
acf-json/group_*.json, post_type_*.json, taxonomy_*.json, ui_options_page_*.json
inc/acf/runner.php            motor: sincroniza, crea páginas, carga contenido, menús y logo
inc/acf/paginas.php           páginas de WordPress (generado)
inc/acf/sitio.php             menús y logo del proyecto
inc/acf/seed/<página>.php     el contenido que salió de cada plantilla
```

- **Administrable:** el motor importa el JSON a la base como el botón "Sync" de ACF, al activar el tema y desde Herramientas > Cargar contenido inicial. Carga cada grupo una sola vez: lo que el cliente edite no se pisa.
- **Sin límites para el editor:** la recomendación de largo y medida queda en las instrucciones del campo.
- **Textos de varias líneas:** un título o párrafo con saltos es un solo campo de texto largo (textarea); el cliente pasa de línea con Enter y la web lo muestra, con las partes de otro color de `wp-helper`. Si un spec viejo trae un campo por línea (`…_linea_1`, `…_linea_2`), `wp-acf` los une solo: el código ya muestra los saltos y los colores. Un salto que solo se veía en escritorio también queda en celular, y un color nuevo se agrega solo al helper.
- **Elegir entradas (relationship):** un campo `relationship` deja que el cliente elija qué productos, entradas u otro contenido se muestran (por ejemplo, "productos destacados"). En el spec, su descripción dice de dónde elige: `Contenido: producto` (y si quieres un tope, `Máximo: 4`). La carga inicial usa los elementos de ejemplo: `['_item' => 'producto-1']`.
- **Fuera de alcance:** consultas, filtros, buscador y paginación (`wp-query`, el paso siguiente), WooCommerce y multilenguaje.
- Comandos: `node skills/wp-acf/scripts/generate.mjs [--dry-run]`, `install.mjs`, `check.mjs`.
- Prueba: `node skills/wp-acf/tests/check.mjs`. El PHP del motor no se ejecuta en la prueba.

## wp-query

Después de `wp-acf`: pide `conecta los listados`, `haz funcionar los filtros` o `blog con filtros`. Lee la tabla **Filtros** de cada spec de listado (la escribe `design-import`) y toma los listados con estado `aplicado`. Sirve para posts, tipos de contenido propios y la **tienda de WooCommerce** (`Origen: woo`); el carrito, el checkout y las plantillas de producto son de `wp-woocommerce`.

1. **Motor** (`install.mjs`): copia `inc/query/motor.php` y `src/js/modules/query.js` (genéricos, con el prefijo del tema), y los conecta a `functions.php` y al JS principal de Vite.
2. **Definiciones** (`generate.mjs`): un `inc/query/<contenido>.php` por listado, desde su tabla Filtros, sus etiquetas (`Al filtrar`, `Paginación`, `Por página`, `Filtros en móvil`) y los campos de su spec de detalle.
3. **Un listado a la vez**, con un subagente por listado: la plantilla pasa de los ejemplos fijos al loop real con la misma tarjeta, y el formulario de filtros pinta los datos del motor con el HTML del diseño.
4. **Verificar** (`check.mjs`): el motor y su JS conectados, las definiciones iguales a los specs, las zonas `data-query`, el `name` de cada filtro, sin `query_posts` y con la salida escapada.

```text
inc/query/motor.php           motor: consulta principal, filtros, conteos, paginación, relacionados, SEO
inc/query/<contenido>.php     definición de cada listado (generada)
src/js/modules/query.js       filtrar sin recargar
```

- **Filtros combinados:** entre filtros distintos siempre "y"; dentro de uno, "o" o "y" según el spec. La URL queda legible (`?categoria=sillas,mesas&precio_min=100`) y solo acepta los filtros y valores conocidos.
- **El diseño manda:** el motor entrega datos (opciones, conteos, marcada, desactivada); el aspecto lo pone la plantilla.
- **Sin recargar, pero sin depender del JS:** sin JavaScript es un formulario normal y la paginación son enlaces.
- **Tienda de WooCommerce:** se engancha a la consulta que WooCommerce ya armó, sin reemplazarla. Filtros: categorías, etiquetas y atributos, rango de precio, búsqueda y orden (precio, popularidad, valoración). El precio usa la tabla de búsqueda de WooCommerce con su propia lógica (impuestos incluidos) y los conteos y límites solo ven lo visible del catálogo (sin ocultos ni agotados). No admite filtros de campos ACF: se usa un atributo. Los `min_price` y `max_price` nativos de WooCommerce siguen funcionando.
- **SEO:** las páginas filtradas no se indexan y su canonical apunta al listado sin filtros (WordPress, Yoast y Rank Math).
- Comandos: `node skills/wp-query/scripts/status.mjs`, `install.mjs [--dry-run]`, `generate.mjs [--dry-run]`, `check.mjs`.
- Prueba: `node skills/wp-query/tests/check.mjs`. Con `php` disponible también prueba el motor PHP.

## wp-woocommerce

Después de `wp-acf`, solo si el spec tiene contenido con `Origen: woo` (una tienda con pasarela; un catálogo con WhatsApp o formulario es `wp-acf` + `wp-query`): pide `conecta woocommerce`, `tienda con woocommerce` o `carrito y checkout`. Lee la tabla **WooCommerce** de `specs/_shared.md` (la escribe `design-import`: no infiere nada) y las plantillas de `woocommerce/` que dejó maquetadas.

1. **Base** (`install.mjs`): según el spec copia `inc/woocommerce/base.php` (siempre), `fragments.php` (si el mini-carrito es clásico) y `src/css/woocommerce.css` (si alguna pieza va en bloques), y lo conecta a `functions.php` y al CSS principal de Vite.
2. **Comparar con WooCommerce instalado**: cada plantilla del tema se compara con la original del plugin (misma ruta). Se conserva el HTML del diseño y se agrega lo que la original tiene: todos sus `do_action()`, los `name` de los formularios, los nonce.
3. **Conectar** cada `// woo: precio` con la función de WooCommerce (`references/conexion.md`), con un subagente por grupo de plantillas, y copiar el `@version` de la original.
4. **Estilar los bloques**: las piezas en `bloques` no llevan plantilla; su CSS va en `src/css/woocommerce.css`, sin `@layer`, acotado al bloque y con los tokens.
5. **Verificar** (`check.mjs`): sin marcadores, `@version` igual a la original, ningún `do_action()` perdido, ninguna plantilla para una pieza en bloques, sin pasarelas, envíos ni pedidos en el tema.

```text
inc/woocommerce/base.php         soporte de WooCommerce, sin estilos clásicos ni envoltorios (genérico)
inc/woocommerce/fragments.php    contador y total del mini-carrito que se actualizan solos (si es clásico)
page.php                         solo si el tema no tiene plantilla de página: sin ella el carrito y el checkout salen vacíos
src/css/woocommerce.css          CSS de los bloques (si hay piezas en bloques)
woocommerce/                     las plantillas del diseño, conectadas
```

- **Se actualiza sin romperse:** primero hooks y las plantillas originales; el `@version` es el de la original (nunca se edita para silenciar el aviso de WooCommerce → Estado).
- **Sin duplicados:** la base quita lo que WooCommerce imprime por defecto en los ganchos de sus plantillas, y los `do_action()` se conservan para plugins y pasarelas. Cada pieza sale una vez, donde el diseño la pone.
- **Fuera del tema:** pasarelas, envíos, pedidos y campos extra del checkout van en un plugin del proyecto, donde también se declara la compatibilidad con HPOS y bloques.
- **Filtros de tienda:** los conecta `wp-query` (1.2.0, `Origen: woo`); `status.mjs` y `check.mjs` solo avisan si el spec los pide y `wp-query` no está instalada. **Pendiente:** productos variables (se reportan, no se conectan).
- Comandos: `node skills/wp-woocommerce/scripts/status.mjs`, `install.mjs [--dry-run]`, `check.mjs [--woo <raíz del plugin>]`.
- Prueba: `node skills/wp-woocommerce/tests/check.mjs [--php <ruta>]`. Usa plantillas de WooCommerce falsas; con `php` revisa la sintaxis y carga la base con funciones de WordPress simuladas.
- **Probado en Local WP** con WooCommerce 11.2.2: tienda, ficha, carrito clásico, checkout en bloques y el mini-carrito por AJAX. Queda por ver en un navegador el ancho de celular y un pago real con la pasarela del proyecto.

## wp-manual

Al cerrar un proyecto, pide `haz el manual de usuario`, `manual del cliente` o `manual de administración`. Sale del `acf-json/` (y de los specs, si los hay): no hace falta escribir nada a mano salvo revisar los textos.

1. `init.mjs` crea `.env.manual` vacío en la raíz del proyecto (y lo agrega a `.gitignore`). Lo llenas con la URL del sitio **local** y un usuario con el rol del cliente (sin usuario, inicias sesión a mano en el navegador). Al volver a correrlo crea `specs/manual/_manual.md` y un borrador por capítulo con los campos numerados.
2. Claude redacta los borradores en español sencillo y tú los revisas.
3. `capture.mjs` toma las capturas en **solo lectura** (el navegador bloquea todo envío salvo el login): admin con cada campo numerado y la sección de la web como referencia.
4. `check.mjs` revisa los textos y `build.mjs` arma `manual-horizontal.pdf`, `manual-vertical.pdf` y un `reporte.pdf` aparte para el equipo.
5. Al terminar, borra `.env.manual`.

```text
.env.manual                       credenciales del sitio local (en .gitignore; se borra al terminar)
specs/manual/<capítulo>.md        borradores: un capítulo por opciones, página, contenido y menús/logo
specs/manual/capturas/            capturas al doble de resolución + mapa.json
specs/manual/salida/              manual-horizontal.pdf, manual-vertical.pdf, reporte.pdf
```

- **Capítulos:** login, reglas generales, páginas de opciones, una parte por página (las que comparten plantilla van juntas), entradas y tipos de contenido, menús y logo. Una hoja por sección: captura del admin numerada (1, 7.1, 2.5.1) más grande que la de la web, y el texto de cada número.
- **Textos:** sin cantidad de caracteres; imágenes con «Recomendado: hasta 2000 px en el lado más largo»; el resaltado (*asteriscos*, |barras|) solo en los campos cuya plantilla lo usa.
- **Navegador:** usa Edge o Chrome instalados y `playwright-core` del proyecto o de `--playwright-from <carpeta>`; si falta, sale con código 5 y el comando, y no instala nada solo.
- **Sin tocar el tema:** `--out <carpeta>` y `--env <archivo>` dejan todo fuera del proyecto.
- **A medida:** `- **Incluir:** no` en un borrador quita ese capítulo; `extra-<nombre>.md` agrega uno escrito a mano (si el tema guarda los envíos de `wp-form`, `init.mjs` crea `extra-envios.md`); `build.mjs --juntar` pone dos secciones cortas en una hoja.
- Qué cubre y qué falta (WooCommerce, ayuda dentro del admin, videos): [`skills/wp-manual/COBERTURA.md`](skills/wp-manual/COBERTURA.md).
- Comandos: `node skills/wp-manual/scripts/status.mjs | init.mjs | capture.mjs [--bloquear <url,…>] | check.mjs | build.mjs [--formato horizontal|vertical|ambos] [--juntar] [--out <dir>] [--env <archivo>] [--playwright-from <dir>]`.
- Prueba: `node skills/wp-manual/tests/check.mjs` (sin navegador).

## img-webp

En cualquier proyecto con imágenes (un tema WordPress o una carpeta suelta), pide `convierte las imágenes a webp`, `optimiza las imágenes del tema` o pásale una imagen o una carpeta: `/carlitos-skills:img-webp assets/img/hero.jpg` o `/carlitos-skills:img-webp assets/img`. Es independiente: ninguna otra skill la necesita y ella no necesita a ninguna; `design-import` solo la **ofrece** una vez cuando ve PNG o JPEG.

Trabaja en pasos y te muestra el resultado antes de escribir: `--scan` (solo lectura: qué hay y qué se convertiría), `--dry-run` (codifica en memoria y muestra el ahorro real y las referencias que cambiarían, con archivo:línea) y `--apply`. Con `--restore` lo deshace todo.

```text
<nombre>.webp                              junto a cada imagen original, con el mismo nombre
src/img-originales/ (o img-originales/)    los originales movidos, con su estructura; src/ no se sube al servidor
img-webp.manifest.json                     dentro del respaldo: qué se convirtió y qué referencias cambiaron
```

- **Qué convierte:** PNG, JPG y JPEG, según su formato **real** (un `.png` que es un JPEG se detecta). SVG, GIF, AVIF y WebP no se tocan.
- **Tamaño:** cada imagen conserva sus medidas. Solo si el ancho pasa de 2000 px se reduce a 2000 px, con la misma proporción; nunca se amplía. Calidad 80, conserva la transparencia y aplica la orientación Exif. Si el WebP no queda más liviano, se deja el original.
- **Originales:** se mueven al respaldo, nunca se borran. Una segunda corrida no cambia nada.
- **Referencias:** reemplaza el nombre del archivo en PHP, CSS, JS, HTML, MD, JSON, YAML y XML (suelto, con ruta o como URL). Si el nombre es ambiguo no lo toca y lo lista. No edita `node_modules`, `dist`, el respaldo ni `specs/figma/lectura/`. En un proyecto nuevo (sin referencias) solo convierte.
- **Codificador:** usa `sharp`, que **no va incluido**: lo toma del proyecto o de `--sharp-from <carpeta>`. Si falta, sale con código 5 y te da el comando exacto según tu gestor (`pnpm add -D sharp`, `yarn add -D sharp` o `npm install --save-dev sharp`); no instala nada solo. `sharp` no trae script de instalación, así que no choca con las reglas de builds de pnpm.
- Con `wp-acf`: cada imagen se identifica por su ruta, así que conviene convertir **antes** de cargar el contenido; si no, queda un adjunto viejo sin uso.
- Comandos: `node skills/img-webp/scripts/webp.mjs --scan | --dry-run | --apply | --restore | --check-encoder [rutas…] [--max-width 2000] [--quality 80] [--backup <dir>] [--no-refs] [--force] [--sharp-from <dir>]`.
- Prueba: `node skills/img-webp/tests/check.mjs` (sin dependencias, con un `sharp` falso; si defines `IMG_WEBP_SHARP_FROM=<carpeta con node_modules/sharp>` suma una conversión real).
- No genera AVIF, `srcset` ni GIF animado, ni cambia cómo la página usa la imagen.

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

La licencia de este repositorio está pendiente de definir aun. Hasta que se publique un archivo `LICENSE`, no se concede permiso explícito para redistribuirlo.
