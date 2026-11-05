# Figma: <página>

<!--
Ejemplo de un archivo de enlaces. Para una página nueva, copia este archivo como
specs/figma/enlaces/<página>.md: el nombre es el slug de la página (home, sobre-nosotros, servicios...).
Una página por archivo. Este archivo no se lee: es solo la guía.
-->

- **Frame de la página:** https://www.figma.com/design/<archivo>/<nombre>?node-id=1-2

## Secciones

<!--
Una sección por línea, en el orden en que aparecen en la página:

- nombre-de-la-seccion: link del frame de esa sección

- El nombre lo pones tú (minúsculas, sin tildes, con guiones). Será el nombre de la sección en el spec
  y del archivo template-parts/pages/<página>/<nombre>.php. El nombre de la capa en Figma (Frame 40) no se usa.
- Un frame que trae dos secciones se divide poniendo el link de cada frame interno.
- Si dejas la lista vacía, la skill propone las secciones leyendo la página y tú las confirmas.
- El link se copia desde Figma: clic derecho en el frame > Copy/Paste as > Copy link to selection.
  Trae el archivo y el node-id.
-->

- hero: https://www.figma.com/design/<archivo>/<nombre>?node-id=1-10
  - móvil: https://www.figma.com/design/<archivo>/<nombre>?node-id=5-20
  - nota: el slider avanza solo cada 5 segundos.
  - nota: el botón lleva a /contacto.
- servicios: https://www.figma.com/design/<archivo>/<nombre>?node-id=1-25
  - nota: las tarjetas las agrega el cliente (repetidor), máximo 6.

<!--
Debajo de cada sección, con sangría (dos espacios), puedes agregar:

- móvil: el link del frame de la versión móvil. Opcional: ponlo solo si el diseño lo tiene.
  Sin él, la versión móvil se propone en el spec y tú la apruebas.
- nota: lo que el diseño no muestra y no se debe adivinar (qué hace un botón, si algo se mueve solo,
  qué cambia el cliente, cuántos elementos caben...). Una nota por línea. Puedes escribir "- nota: ..."
  o solo "- ...".

Tus notas pasan tal cual al spec y mandan sobre lo que se ve en Figma. Si una nota choca con el diseño
(dices 3 tarjetas y hay 4), la skill te pregunta.
-->

## Notas

<!--
Opcional: lo que vale para toda la página, una nota por línea. Pasan a "Notas de página" del spec.
-->

- el header es transparente solo en esta página.
