# Changelog: design-import

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico por skill; la versión vive en `metadata.version` de `SKILL.md`.

## [1.15.0] - 2026-11-08

### Agregado
- **"Native first" en `references/campos-acf.md`**: antes de escribir una fila de "Campos ACF" se pregunta si WordPress (o WooCommerce) ya guarda y edita ese dato. Una tabla de equivalencias reúne lo que estaba suelto en `sitio-global.md` y `contenido-dinamico.md`: título, contenido, imagen destacada, extracto/fecha/autor del blog, categorías y etiquetas, logo e ícono, menús y precio/stock/botón de Woo. Dice cuándo sí es un campo (secciones de una página, datos extra de un elemento, opciones del sitio, elegir algo dentro de una sección) y deja claro que el `h1` del hero de una página estática sí puede ser un campo.
- `check.mjs` **avisa** (no falla) cuando un campo parece duplicar algo nativo: `titulo`, `nombre`, `contenido`, `imagen_destacada`, `imagen_principal` o `miniatura` en un detalle; `extracto`, `resumen`, `fecha` o `autor` en un detalle de blog; `precio`, `stock`, `sku`, `agregar_carrito`, `boton_comprar` o `descripcion_corta` en un detalle de Woo; `logo`, `logo_principal`, `favicon`, `icono_sitio`, `nombre_sitio` o `menu*` en `opciones`. El aviso dice qué es nativo y cómo renombrar el campo si es otra cosa (`logo_alternativo`).
- La etapa B de `SKILL.md` remite a esa regla antes de escribir los campos.
- Prueba: título e imagen destacada de un detalle, logo y menú de `opciones`, y `logo_alternativo` sin aviso.

## [1.14.0] - 2026-11-05

### Agregado
- Fuente Figma: **notas del usuario** en `specs/figma/enlaces/<página>.md`. Las de toda la página van en `## Notas`; las de una sección, con sangría debajo de ella (`- nota: …` o cualquier línea con sangría). Dicen lo que el diseño no muestra (qué hace un botón, qué se mueve solo, qué cambia el cliente, límites) para que no se deduzca.
- Las notas mandan sobre lo que muestra Figma y sobre lo que deduce la skill: pasan **tal cual** al spec (las de la página a `Notas de página`, las de la sección a la etiqueta nueva `Indicaciones del diseño`), lo que responden no se vuelve a preguntar, y si chocan con el diseño o no son claras, se pregunta. `check.mjs` avisa si una nota falta en el spec y falla si la página ya está `aprobado` o `aplicado`.
- **Link opcional de la versión móvil** de cada sección (`- móvil: <link>`, con sangría). Si está, se lee también (`<sección>.movil.ref.txt` y `.movil.png`, entrada `movil` en la lectura) y las pantallas chicas lo siguen. Si no está, todo funciona como antes.
- `figma-links.mjs` devuelve `notes` y `mobile`; `figma-lectura.mjs` valida el `movil` y avisa si su link cambió o falta leerlo; `figma-inventario.mjs` lleva las notas y el móvil a `_inventario.json` para la etapa A.
- `_ejemplo.md` y la plantilla de cada página traen el formato y un ejemplo.

## [1.13.0] - 2026-11-05

### Agregado
- **Filtros de una tienda de WooCommerce.** Con `Filtros de tienda: sí` el spec del listado de la tienda lleva la tabla "Filtros" (antes se anotaba solo la intención) y `check.mjs` la valida con la gramática de una tienda: `taxonomía` sobre `product_cat`, `product_tag` o un atributo `pa_<nombre>`; `rango` sobre `precio`; `búsqueda`; `orden` con `popularidad`, `valoracion` y `precio` asc/desc. `opciones` y `fecha` (campos ACF) se rechazan con el motivo, y los nombres `orderby`, `min_price`, `max_price` y `rating_filter` están reservados (son de WooCommerce).
- Avisos de coherencia: con `Filtros de tienda: sí` y sin tabla avisa que `wp-query` la necesita; con `no` y con tabla avisa que no se usa. `popularidad` y `valoracion` en un contenido que no es de WooCommerce son un error.
- `ORDER_KEYWORDS` de `shared/specs.mjs` suma `popularidad` y `valoracion` (copia sincronizada en todas las skills).
- Pruebas: una tienda con tabla válida, con atributo y etiqueta, y cada rechazo (taxonomía ajena, `opciones`, `fecha`, rango o orden por un campo, nombre reservado).

### Cambiado
- `references/formato-spec.md` ("A WooCommerce shop") y `references/contenido-dinamico.md`: qué admite la tabla en una tienda.

## [1.12.0] - 2026-11-05

### Agregado
- Sección `## WooCommerce` en `_shared.md` (y en su plantilla): cuando algún contenido tiene `Origen: woo`, la skill pregunta **una vez**, en el mismo mensaje del alcance, cómo se dibuja cada pieza que WooCommerce puede entregar como plantilla PHP o como bloque (`carrito`, `checkout`, `mini-carrito`, `cuenta`: `clásico`, `bloques` o `no aplica`), si hay productos con variaciones y si la tienda tiene filtros. Nada se infiere. Tienda, tarjeta y ficha de producto son siempre plantillas PHP y no se preguntan.
- `check.mjs` valida la sección: pieza y modo válidos, las cuatro piezas presentes y sin repetir, `Variaciones` y `Filtros de tienda` en `sí` o `no`. Si hay contenido `woo` y falta la sección, o la sección existe sin contenido `woo`, solo avisa (los proyectos anteriores no se rompen). La plantilla trae la sección vacía y vacía cuenta como ausente.
- `parseWoo()`, `WOO_PIECES` y `WOO_MODES` en `shared/specs.mjs` (copia sincronizada en todas las skills) para que la skill de WooCommerce lea estas decisiones sin volver a preguntar.
- Prueba en `tests/check.mjs` con los casos válidos (todo clásico, mixto) y los errores de cada regla.

### Cambiado
- `check.mjs` ya no avisa "Falta la tabla Filtros: wp-query la necesita" en una tienda de WooCommerce (`Origen: woo`): `wp-query` no la conecta todavía y los filtros de la tienda se anotan en la tabla "WooCommerce" (Filtros de tienda). Con una prueba.
- `references/contenido-dinamico.md`, `references/destino-wp-vite-theme.md` y `SKILL.md`: una pieza en `bloques` **no se maqueta** (WooCommerce ignora la plantilla PHP cuando usa el bloque); el diseño queda descrito en `Notas de página` para estilarlo después con CSS. Los archivos de `woocommerce/` que se listan son los habituales, no una lista cerrada.

## [1.11.0] - 2026-11-04

### Agregado
- Ofrece la skill `img-webp` cuando ve imágenes PNG, JPG o JPEG (paso 7.4 de `SKILL.md`): se pregunta **una vez**, antes de escribir las plantillas, si se convierten a WebP. En un proyecto nuevo se convierten primero y las plantillas nacen con nombres `.webp`; en uno ya hecho, `img-webp` actualiza las referencias. Si el usuario ya lo pidió se usa directo; si la skill no está instalada se dice y se sigue con los archivos como están. Nunca se convierten los SVG. `img-webp` es independiente: `design-import` no la necesita.
- `analyze.mjs` suma el hallazgo informativo `raster-not-webp` (severidad baja, no bloquea nada): cuenta las imágenes PNG y JPEG de la carpeta fuente con su ubicación; los SVG y los `.webp` no cuentan. Con su entrada en `references/malas-practicas.md` y una prueba.

### Cambiado
- `references/fuente-figma.md` y el mensaje de `scripts/figma/lectura.mjs` ya no dicen "no es parte de esta skill / no se convierte aquí": dicen que la conversión la hace `img-webp` si el usuario la quiere. La lectura de Figma sigue sin convertir nada y `specs/figma/lectura/` sigue describiendo la descarga original (`img-webp` no lo toca).

## [1.10.0] - 2026-11-04

### Agregado
- Fuente Figma además de la carpeta de diseño. El modo carpeta es el de siempre y sigue siendo el predeterminado; Figma se usa solo si el usuario da links de Figma, lo pide, o el proyecto ya tiene `specs/figma/enlaces/`. Con las dos fuentes presentes se pregunta una vez (puede ser por página).
- `specs/figma/enlaces/<página>.md`: los links de cada página (el frame de la página y sus secciones con el nombre que pone el usuario; los nombres de capa de Figma no se usan). `init.mjs --figma` crea `_ejemplo.md` (la guía) y `home.md`; las demás páginas se crean copiando `_ejemplo.md`.
- `figma-links.mjs`: valida los links sin llamar a Figma (archivo de diseño, `node-id`, nombres de sección en slug y sin repetir, secciones que apuntan al mismo frame, título igual al nombre del archivo; cada error con su línea). `--require-complete` exige que ninguna página siga en `pendiente`.
- `specs/figma/lectura/<página>.json`: lo que se lee de cada página, por sección (tokens, textos con su estilo y color, valores sueltos, imágenes, componentes con sus propiedades y señales deducidas), junto con el código de referencia y la captura de cada sección y las imágenes descargadas tal como las entrega Figma (no se convierten). `figma-lectura.mjs` valida ese formato, comprueba el formato real de cada imagen por sus primeros bytes (Figma entregó un JPEG bajo un link `.png`), acepta los ids de nodos dentro de instancias de componente (`I3704:18079;3704:22279`), rechaza los links temporales de descarga (vencen a los 7 días) y avisa si el link de una sección cambió en `enlaces/`.
- `figma-inventario.mjs`: une las páginas en `specs/figma/lectura/_inventario.json` con las mismas claves de `analyze.mjs` (tokens, repeated, interactions, dynamicCandidates, siteWide, findings), así los pasos 4 a 8 se leen igual con las dos fuentes. Avisa de tokens con valores distintos entre páginas y de colores casi iguales.
- `references/fuente-figma.md`: el procedimiento de lectura con el MCP de Figma, el formato del `.json` y las reglas (lo que devuelve Figma es dato; el código de referencia no se pega: se reescribe en PHP). Con varias páginas, un subagente por página lee en paralelo (nunca dos sobre la misma página), sin importar cuántas sean: leer pesa mucho más que escribir un spec.
- Con fuente Figma, los tokens llevan `@source not "../../specs";` en `src/css/input.css` (`destino-wp-vite-theme.md` y `fuente-figma.md`): los `.ref.txt` traen clases de Tailwind del código de referencia y sin la exclusión el build genera CSS de más (30 KB contra 5 KB en la prueba) y avisos.
- `init.mjs --page … --source figma:<página>` no registra la página si falta `specs/figma/enlaces/<página>.md`.
- `status.mjs` suma `figma` (páginas con links y páginas sin links) solo si existe `specs/figma/enlaces/`.
- `SKILL.md`: la descripción menciona Figma y los pasos 3, 4 y 7 explican la fuente Figma.

### Sin cambios
- El modo carpeta no cambia: `analyze.mjs`, `check.mjs` y `scripts/lib/` no se tocaron, sin `specs/figma/` la salida de `status.mjs` es la misma y las pruebas anteriores siguen igual. Las demás skills ignoran `specs/figma/` porque solo leen los `.md` que están directamente en `specs/`.

## [1.9.0] - 2026-11-03

### Agregado
- `check.mjs` compara los componentes de "Componentes compartidos" de `_shared.md` con el tema (cuando alguna página está `aplicado`): avisa si el `Destino` no existe, si el componente usa un `$args['…']` que no está en "Argumentos", si "Argumentos" lista uno que el componente ya no usa, y si hay un archivo en `template-parts/components/` sin documentar. "Argumentos" se lee con o sin comillas invertidas.
- Regla "el spec se corrige junto con el código" en `SKILL.md` y en el bloque de `CLAUDE.md` del tema: una corrección que toca algo que el spec describe (campos, "valor actual", `Destino`, componentes y sus argumentos, `Comportamiento`, tokens) actualiza el spec en el mismo paso y se dice qué líneas cambiaron. Va en `CLAUDE.md` para que aplique también en correcciones pedidas sin la skill cargada.

## [1.8.0] - 2026-11-03

### Cambiado
- Todo componente o sección que imprime un texto con partes de otro color o con saltos de línea lo recibe como un solo texto con los marcadores de `wp-helper` y lo imprime con `<prefix>_highlight()`, sin reglas propias: no parte el texto por líneas, no usa `nl2br`, no cambia los marcadores a mano y no lleva un argumento aparte para la parte de color. Así el color sale igual en una línea o en varias, en un campo `text` o `textarea`. Ver `references/destino-wp-vite-theme.md`, `campos-acf.md`, `acceptance.md` y los criterios comunes de `_shared.md`.

## [1.7.0] - 2026-10-30

### Cambiado
- Un título o párrafo que el diseño parte con `<br>` es un solo campo `textarea`, no un campo por línea (`…_linea_1`, `…_linea_2`). En "valor actual" el salto se escribe `<br>`; una parte de otro color lleva su marcador de `wp-helper` dentro de su línea. Un `<br>` que el diseño solo muestra en escritorio también es un salto en celular. Un color que aún no está en `wp-helper` se agrega sin preguntar. Ver `references/campos-acf.md`.

### Agregado
- `check.mjs` avisa cuando una sección tiene campos `…_linea_1`, `…_linea_2`: deberían ser un solo textarea. La regla vive en `shared/specs.mjs` (`lineSplits`), la misma que usa `wp-acf`.

## [1.6.1] - 2026-10-22

### Agregado
- Etiqueta opcional `Query: pendiente | conectado` en las secciones de un listado o detalle (la escribe `wp-query`). `check.mjs` rechaza otro valor y la etiqueta en otros tipos de página.

## [1.6.0] - 2026-10-22

### Agregado
- Tabla **Filtros** en el spec de cada listado: el nombre de cada filtro en la URL, su tipo (`taxonomía`, `rango`, `opciones`, `fecha`, `búsqueda`, `orden`), de dónde sale (la taxonomía del contenido o un campo ACF del detalle), si admite varios valores (`sí (o)` / `sí (y)`), su conteo (`ninguno`, `fijo`, `dinámico`) y cómo se ve en el diseño. Más las etiquetas `Al filtrar`, `Paginación`, `Por página` y `Filtros en móvil`. Es lo que lee wp-query para conectar filtros combinados.
- `init.mjs --type listado` agrega la tabla vacía y las etiquetas con sus valores por defecto.
- `check.mjs` valida la tabla: la taxonomía existe en su fila de "Contenido dinámico", el campo existe en el detalle con un tipo compatible, los nombres no chocan con variables de WordPress, y "Varios" y "Conteo" solo van en taxonomías y opciones. Un listado sin tabla solo avisa.
- El maquetado de filtros usa los nombres de la tabla y marca con `data-query` las partes que se actualizan (`filtros`, `resultados`, `paginacion`, `total`).

### Corregido
- `init.mjs` deja el spec con un solo tipo de salto de línea aunque la plantilla venga con `\r\n` (Windows).

## [1.5.0] - 2026-10-22

### Agregado
- Etiqueta `Padre` en el resumen de la página (`ninguno` por defecto; los specs sin ella siguen pasando): el slug de otra página estática de la que cuelga. `init.mjs --page … --parent <slug>` la escribe y `check.mjs` rechaza un padre que no existe o no es estático, la página de inicio con padre y los ciclos. `wp-acf` 1.3.0 la crea como página hija.

## [1.4.1] - 2026-10-22

### Agregado
- `status.mjs`: una sola lectura del tema (solo lee) que dice si tiene la estructura de `wp-vite-theme` (`askStructure`), su prefijo y los helpers de `wp-helper`, si hay specs y cuántas páginas hay por estado, si el motor de `wp-acf` está instalado y el siguiente paso. El paso 1 de `SKILL.md` lo corre primero, para no explorar el tema a mano ni preguntar una estructura que ya se conoce.

## [1.4.0] - 2026-10-21

### Agregado
- Etiqueta opcional `ACF: pendiente | conectado` en cada sección (la escribe `wp-acf`). Con `conectado`, `check.mjs` no compara el "valor actual" con la plantilla, porque el texto ya salió del PHP y vive en la carga inicial de ACF. Los specs anteriores siguen pasando.

### Corregido
- `check.mjs` exige la fila del repetidor antes de sus subcampos (`home_hero_slides` antes de `home_hero_slides.imagen`); sin ella `wp-acf` no puede armar el campo.

### Cambiado
- El lector de specs (etiquetas, tablas, índice, contenido dinámico, páginas) vive en `shared/specs.mjs` y se copia a `scripts/lib/specs.mjs`; `check.mjs` lo usa y comparte con `wp-acf`.

## [1.3.1] - 2026-10-21

### Corregido
- `check.mjs`: el "valor actual" también se busca en los textos entre comillas de los bloques PHP (una variable o arreglo al inicio de la plantilla) y en los atributos `alt`, `title`, `aria-label` y `placeholder`. Antes solo miraba el texto entre etiquetas y daba falsos errores en las plantillas que guardan el texto fijo en variables (56 en la portada de un tema real). Los marcadores de resaltado `|` y `*` se ignoran al comparar.

## [1.3.0] - 2026-10-21

### Cambiado
- Los criterios de aceptación comunes se escriben una sola vez, en la sección "Criterios comunes" de `_shared.md` (todas las secciones, según lo que tenga la sección y cada página). Cada sección dice "Cumple los criterios comunes de `_shared.md`" y lista solo los suyos; un spec ya no repite el mismo bloque en cada sección.
- Las notas de página son una lista (una nota por línea) y ya no llevan los criterios de página.
- `references/acceptance.md` y `formato-spec.md` describen el formato nuevo.

### Agregado
- `check.mjs` avisa cuando una sección repite tres o más criterios comunes, cuando remite a "Criterios comunes" sin que `_shared.md` los tenga, y cuando las notas de página son un párrafo largo o traen criterios de página. Los specs anteriores a la 1.3.0 siguen pasando.

## [1.2.0] - 2026-10-21

### Agregado
- Contenido de todo el sitio: `_shared.md` trae la sección "Sitio" (identidad, menús) y el spec `opciones` (`init.mjs --page opciones --type global`) documenta lo que se repite en todas las páginas: logo alternativo, contacto, redes, textos del pie, aviso superior. Campos `opciones_<área>_<campo>` en una página de opciones de ACF.
- El logo principal y el ícono del sitio se documentan como Personalizar (Identidad del sitio) y los menús como menús de WordPress; ninguno es un campo ACF.
- `analyze.mjs`: `siteWide` (cabecera, menú, pie y bloques repetidos entre páginas, con las imágenes que parecen logo).
- `check.mjs`: tipo `global`, el slug `opciones` y la tabla de menús.
- `references/sitio-global.md`.

### Cambiado
- El número de WhatsApp global de los catálogos sale de `opciones_contacto_whatsapp`.

## [1.1.0] - 2026-10-21

### Agregado
- Alcance del diseño: `_shared.md` trae las tablas "Alcance" y "Contenido dinámico". La skill pregunta una sola vez qué es cada página candidata (estática, blog, catálogo con tipo de contenido propio, WooCommerce u otro) y anota tipo de contenido, taxonomías, filtros, plantillas y la acción del botón de cada elemento (WhatsApp, formulario, contacto, carrito de Woo, ninguna). No adivina.
- `analyze.mjs`: `dynamicCandidates` (páginas que parecen listado, catálogo o tienda, con los motivos) y los formularios que solo filtran se marcan `kind: filter` sin skill sugerida, para que no vayan a `wp-form`.
- Páginas `listado` y `detalle` (`init.mjs --page … --type --content`, más `--group` y `--location`) y `references/contenido-dinamico.md`: qué se documenta, cómo se maqueta (tarjeta como componente con `$args`, filtros y paginación solo como marcado) y WooCommerce solo maquetado en `woocommerce/`.
- Grupos de ACF: cada página es un grupo de campos (`Grupo ACF` y `Ubicación` en el resumen) y cada sección un campo `group` (`Grupo: home_hero`). Los nombres de los campos no cambian (`home_hero_titulo` es como ACF guarda el subcampo `titulo`).
- `check.mjs` valida tipo, contenido, grupos y las dos tablas de `_shared.md`.

### Cambiado
- Un spec de la 1.0 sin los datos nuevos sigue pasando, con un aviso.
- Ya no se dice "sin campos group": reemplazado por el grupo por sección.

No incluye consultas, filtrado real, paginación, registro de tipos de contenido ni taxonomías, ni lógica de WooCommerce.

## [1.0.1] - 2026-10-21

### Cambiado
- Los acordeones se delegan a `wp-accordion` (antes decía "la skill de acordeón"): `analyze.mjs` la sugiere en la interacción `accordion`, y `SKILL.md`, `formato-spec.md`, `malas-practicas.md`, `acceptance.md` y `destino-wp-vite-theme.md` la nombran (destino `template-parts/accordions/`).

## [1.0.0] - 2026-10-21

### Agregado
- Skill para reordenar el diseño que exporta Claude Design (carpeta con HTML + CSS + JS estático, agregada con `/add-dir`) dentro de un tema WordPress: tokens, componentes, secciones y plantillas de página, solo front.
- `scripts/analyze.mjs`: inventario de solo lectura (páginas y secciones, tokens, bloques repetidos, interacciones y malas prácticas con archivo:línea). No ejecuta nada de la carpeta fuente.
- `scripts/init.mjs`: crea `specs/_index.md`, `specs/_shared.md` y un spec por página (`--page`), y mantiene un bloque corto en el `CLAUDE.md` del tema.
- `scripts/check.mjs`: valida los specs (formato, nomenclatura `<página>_<sección>_<campo>`, tipos ACF, criterios, estados) y su coherencia con el PHP aplicado.
- Destino `wp-vite-theme` (`template-parts/pages/<página>/` y `template-parts/components/`) o el que detecte en otro proyecto, confirmado una sola vez.
- Etapas con aprobación: `_shared.md`, luego cada página; solo se aplica lo `aprobado`. Un subagente por página cuando hay más de tres.
- Formularios, modales, acordeones, imágenes y enlaces se delegan a `wp-form`, `wp-modal` y `wp-helper`.
- Los campos ACF se documentan, no se crean; sin límites para el usuario (solo recomendaciones en la descripción).

No incluye comparación visual automática ni crea campos ACF.
