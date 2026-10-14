<?php
defined('ABSPATH') || exit;

/*
 * Ejemplo de definición: form de contacto.
 * Copiar a inc/forms/<id>.php, reemplazar {{PREFIX}} por el prefijo del tema
 * y ajustar con el spec del form. Es la única fuente de reglas: HTML, Zod y PHP salen de aquí.
 */
add_filter('{{PREFIX}}_forms', function ($forms) {
    $forms['contacto'] = [
        'title'    => 'Contacto',
        'subject'  => 'Nuevo mensaje de contacto desde la web',
        'to'       => ['ventas@cliente.pe'],      // Del spec. Vacío = admin_email.
        'reply_to' => 'email',                    // Campo cuyo valor va en Reply-To.
        'store'    => 'none',                     // none | all | failed (requiere inc/forms-entries.php)
        'redirect' => '',                         // URL de la página de gracias, o vacío.
        'retention'=> 180,                        // Días que se guardan los envíos (0 = sin borrado).
        'success'  => 'Gracias, recibimos tu mensaje. Te responderemos pronto.',

        'fields' => [
            'name' => [
                'type'     => 'name',
                'label'    => 'Nombre completo',
                'required' => true,
                'min'      => 3,
                'max'      => 100,
            ],
            'phone' => [
                'type'       => 'phone',
                'label'      => 'Teléfono',
                'required'   => true,
                'min_digits' => 7,
                'max_digits' => 15,
            ],
            'email' => [
                'type'     => 'email',
                'label'    => 'Correo electrónico',
                'required' => true,
            ],
            'service' => [
                'type'     => 'select',
                'label'    => 'Servicio de interés',
                'required' => true,
                'options'  => [
                    'suministro'  => 'Suministro energético',
                    'consultoria' => 'Consultoría',
                    'otro'        => 'Otro',
                ],
            ],
            'contact_by' => [
                'type'     => 'radio',
                'label'    => 'Prefiero que me contacten por',
                'required' => true,
                'options'  => [
                    'email'    => 'Correo',
                    'telefono' => 'Teléfono',
                ],
            ],
            'message' => [
                'type'     => 'textarea',
                'label'    => 'Mensaje',
                'required' => true,
                'min'      => 10,
                'max'      => 500,
            ],
            'consent' => [
                'type'  => 'consent',
                'label' => 'Acepta la política de privacidad',
            ],
        ],
    ];

    return $forms;
});
