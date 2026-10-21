# Compartido

Se define una sola vez y vale para todas las páginas.

- **Estado:** pendiente

## Tokens

Van en `@theme` del CSS principal. Todo valor repetido del diseño se reemplaza por su token.

| Token | Valor | Uso | Origen |
|---|---|---|---|

## Componentes compartidos

Cada componente vive en `template-parts/components/<nombre>.php` y recibe sus datos por `$args`.

### <nombre>

- **Origen:** archivo y líneas del diseño
- **Destino:** `template-parts/components/<nombre>.php`
- **Argumentos:** lista de `$args` (nombre, tipo, requerido)
- **Se usa en:** páginas y secciones

## Nomenclatura

- Campos ACF: `<página>_<sección>_<campo>` en snake_case y en español (`home_hero_titulo`).
- Repetidos (cards, ítems): un repeater `<página>_<sección>_<plural>` con subcampos sin prefijo (`home_servicios_items.titulo`).
- Página en español, sin tildes ni `ñ` en el nombre del campo.
- Sin límites impuestos: la descripción del campo trae una recomendación, no una validación.
