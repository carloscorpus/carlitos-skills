<?php
defined('ABSPATH') || exit;

return [
    'page'   => 'home',
    'fields' => [
        'home_hero' => [
            'titulo' => 'Hacemos crecer tu negocio',
            'boton'  => ['title' => 'Cotizar', 'url' => ['_page' => 'contacto']],
            'slides' => [
                ['imagen' => ['_file' => 'assets/img/hero.webp', 'alt' => 'Equipo de trabajo en la oficina'], 'alt' => 'Equipo de trabajo en la oficina'],
            ],
        ],
    ],
];
