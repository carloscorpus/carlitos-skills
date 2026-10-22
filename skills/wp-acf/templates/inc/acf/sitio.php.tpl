<?php
defined('ABSPATH') || exit;

/*
 * Menús y logo del sitio (skill wp-acf). Datos del proyecto: se escriben desde la tabla "Menús" de
 * specs/_shared.md y el diseño. wp-acf registra las ubicaciones y, la primera vez, crea los menús.
 *
 * 'menus'  => [
 *     'principal' => [
 *         'nombre' => 'Menú principal',
 *         'items'  => [
 *             ['titulo' => 'Inicio', 'pagina' => 'home'],                       // 'pagina' = slug del spec
 *             ['titulo' => 'Nosotros', 'pagina' => 'nosotros', 'hijos' => [...]],
 *             ['titulo' => 'Reglamentos', 'url' => '#', 'clases' => 'subtitulo'], // sin enlace
 *         ],
 *     ],
 * ],
 * 'logo'   => 'assets/img/logo.webp',   // archivo del tema que pasa a Personalizar > Identidad del sitio
 */
return [
    'menus' => [],
    'logo'  => '',
];
