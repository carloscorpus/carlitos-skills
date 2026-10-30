<?php
defined('ABSPATH') || exit;

/*
 * Motor de formularios (skill wp-form).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Cada formulario se define una sola vez en `inc/forms/<id>.php` con el filtro
 * `{{PREFIX}}_forms`. De esa definición salen las tres capas:
 *   - HTML: atributos de cada campo ({{PREFIX}}_field_attrs).
 *   - JS:   las reglas viajan en data-rules y el módulo arma el esquema Zod.
 *   - PHP:  validación, sanitizado y envío ({{PREFIX}}_form_submit).
 * Así front y back comparten reglas y mensajes: un cambio en la definición cambia todo.
 * Donde las librerías no son idénticas, el servidor manda: su error vuelve al campo (422).
 * tests/ en la skill compara ambos lados con los mismos casos.
 *
 * Este archivo no se edita por proyecto. Lo propio de cada form va en inc/forms/.
 */

const {{PREFIX_UPPER}}_FORM_NONCE = '{{PREFIX}}_form';
const {{PREFIX_UPPER}}_FORM_MIN_SECONDS = 3;          // Tiempo mínimo entre ver el form y enviarlo.
const {{PREFIX_UPPER}}_FORM_TOKEN_MAX_AGE = 12 * HOUR_IN_SECONDS;
const {{PREFIX_UPPER}}_FORM_RATE_WINDOW = HOUR_IN_SECONDS;
const {{PREFIX_UPPER}}_FORM_DUPLICATE_WINDOW = 2 * MINUTE_IN_SECONDS;
// Nombre poco reconocible a propósito: los autocompletadores rellenan campos como
// "website" o "url", y un humano con autocompletado perdería su envío.
const {{PREFIX_UPPER}}_FORM_HONEYPOT = '{{PREFIX}}_hp';
// Claves que el motor usa en el POST; ningún campo puede llamarse así.
const {{PREFIX_UPPER}}_FORM_RESERVED = ['action', 'form', 'nonce', 'token', {{PREFIX_UPPER}}_FORM_HONEYPOT];

// Definiciones de cada form y módulo opcional de envíos guardados.
(function () {
    foreach (glob(get_theme_file_path('/inc/forms/*.php')) ?: [] as $file) {
        require_once $file;
    }

    if (file_exists(get_theme_file_path('/inc/forms-entries.php'))) {
        require_once get_theme_file_path('/inc/forms-entries.php');
    }
})();

/* -------------------------------------------------------------------------
 * Definiciones
 * ---------------------------------------------------------------------- */

// Devuelve la definición normalizada de un form, o null si no existe.
function {{PREFIX}}_get_form($form_id)
{
    static $cache = [];

    $form_id = (string) $form_id;
    if (array_key_exists($form_id, $cache)) {
        return $cache[$form_id];
    }

    $forms = apply_filters('{{PREFIX}}_forms', []);
    if (!isset($forms[$form_id]) || !is_array($forms[$form_id])) {
        return $cache[$form_id] = null;
    }

    $form = wp_parse_args($forms[$form_id], [
        'title'      => $form_id,
        'subject'    => 'Nuevo mensaje desde la web',
        'to'         => [],
        'reply_to'   => '',
        'store'      => 'none',   // none | all | failed
        'redirect'   => '',       // URL de la página de gracias; vacío = mensaje en el form
        'success'    => 'Gracias, recibimos tu mensaje. Te responderemos pronto.',
        'rate_limit' => 10,       // Envíos por IP por hora.
        'fields'     => [],
    ]);

    $fields = [];
    foreach ((array) $form['fields'] as $key => $field) {
        $key = (string) $key;
        if (in_array($key, {{PREFIX_UPPER}}_FORM_RESERVED, true)) {
            {{PREFIX}}_form_log("El campo \"$key\" del form \"$form_id\" usa una clave reservada y se ignora.");
            continue;
        }
        $fields[$key] = {{PREFIX}}_normalize_field((array) $field);
    }
    $form['id'] = $form_id;
    $form['fields'] = $fields;

    return $cache[$form_id] = $form;
}

// Completa una definición de campo con los valores y mensajes por defecto de su tipo.
function {{PREFIX}}_normalize_field(array $field)
{
    $type = $field['type'] ?? 'text';

    $defaults = [
        'text'     => ['min' => 0, 'max' => 150, 'invalid' => 'No se permiten los caracteres < ni >.'],
        'name'     => ['min' => 2, 'max' => 100, 'invalid' => 'Solo se permiten letras, espacios, punto, apóstrofe y guion.', 'autocomplete' => 'name'],
        'email'    => ['min' => 0, 'max' => 254, 'invalid' => 'Ingresa un correo electrónico válido.', 'autocomplete' => 'email'],
        'phone'    => ['min' => 0, 'max' => 20, 'min_digits' => 7, 'max_digits' => 15, 'autocomplete' => 'tel'],
        'digits'   => ['min' => 0, 'max' => 20, 'invalid' => 'Solo se permiten números.'],
        'textarea' => ['min' => 0, 'max' => 1000, 'invalid' => 'No se permiten los caracteres < ni >.'],
        'select'   => ['invalid' => 'Elige una opción válida.'],
        'radio'    => ['invalid' => 'Elige una opción válida.'],
        'checkbox' => [],
        // Varias opciones: min y max cuentan opciones marcadas; max 0 = sin límite.
        'checkboxes' => ['min' => 0, 'max' => 0, 'invalid' => 'Elige una opción válida.'],
        'consent'  => ['required' => true],
    ];

    if (!isset($defaults[$type])) {
        {{PREFIX}}_form_log("Tipo de campo desconocido \"$type\"; se usa text.");
        $type = 'text';
    }

    $field = wp_parse_args($field, $defaults[$type] + [
        'label'        => '',
        'required'     => false,
        'options'      => [],
        'autocomplete' => '',
        'messages'     => [],
    ]);
    $field['type'] = $type;

    if ($type === 'phone') {
        $field['invalid'] = sprintf('Ingresa un teléfono válido (%d a %d dígitos).', $field['min_digits'], $field['max_digits']);
    }

    $required = $type === 'consent'
        ? 'Debes aceptar la política de privacidad.'
        : (in_array($type, ['select', 'radio'], true) ? 'Elige una opción.' : 'Este campo es obligatorio.');

    // Mensajes finales: los mismos en PHP y en JS.
    $field['messages'] = wp_parse_args((array) $field['messages'], $type === 'checkboxes' ? [
        'required' => 'Elige al menos una opción.',
        'invalid'  => $field['invalid'],
        'min'      => sprintf((int) $field['min'] === 1 ? 'Elige al menos %d opción.' : 'Elige al menos %d opciones.', (int) $field['min']),
        'max'      => sprintf((int) $field['max'] === 1 ? 'Elige como máximo %d opción.' : 'Elige como máximo %d opciones.', (int) $field['max']),
    ] : [
        'required' => $required,
        'invalid'  => $field['invalid'] ?? 'Valor no válido.',
        'min'      => sprintf('Debe tener al menos %d caracteres.', (int) ($field['min'] ?? 0)),
        'max'      => sprintf('No puede superar %d caracteres.', (int) ($field['max'] ?? 0)),
    ]);
    unset($field['invalid']);

    return $field;
}

/* -------------------------------------------------------------------------
 * Helpers de HTML (las vistas en template-parts/forms/ los usan)
 * ---------------------------------------------------------------------- */

function {{PREFIX}}_field_id($form_id, $key)
{
    return sanitize_html_class($form_id . '-' . $key);
}

// Regla de un campo tal como la recibe el JS (data-rules). La usa también tests/check.php.
function {{PREFIX}}_field_rule(array $field)
{
    $rule = [
        'type'     => $field['type'],
        'required' => (bool) $field['required'],
        'messages' => $field['messages'],
    ];
    if (in_array($field['type'], ['text', 'name', 'email', 'phone', 'digits', 'textarea'], true)) {
        $rule['min'] = (int) $field['min'];
        $rule['max'] = (int) $field['max'];
    }
    if ($field['type'] === 'phone') {
        $rule['min_digits'] = (int) $field['min_digits'];
        $rule['max_digits'] = (int) $field['max_digits'];
    }
    if (in_array($field['type'], ['select', 'radio', 'checkboxes'], true)) {
        $rule['options'] = array_map('strval', array_keys((array) $field['options']));
    }
    if ($field['type'] === 'checkboxes') {
        $rule['min'] = (int) $field['min'];
        $rule['max'] = (int) $field['max'];
    }

    return $rule;
}

// Atributos del <form>: identificación, endpoint y reglas para Zod.
// method="post": si el JS no llegó a cargar, el navegador no pone los datos en la URL.
function {{PREFIX}}_form_attrs($form_id)
{
    $form = {{PREFIX}}_get_form($form_id);
    if (!$form) {
        {{PREFIX}}_form_log("El form \"$form_id\" no está definido en inc/forms/.");
        return;
    }

    $rules = array_map('{{PREFIX}}_field_rule', $form['fields']);

    printf(
        'id="%s" method="post" data-form="%s" data-ajax-url="%s" data-rules="%s" novalidate',
        esc_attr(sanitize_html_class($form_id)),
        esc_attr($form_id),
        esc_url(admin_url('admin-ajax.php')),
        esc_attr(wp_json_encode($rules))
    );
}

// Atributos de un input/textarea/select. Las clases las pone la vista (vienen de Figma).
// Para radios y checkboxes de varias opciones, pasa el valor de la opción en $option.
function {{PREFIX}}_field_attrs($form_id, $key, $option = null)
{
    $form = {{PREFIX}}_get_form($form_id);
    $field = $form['fields'][$key] ?? null;
    if (!$field) {
        {{PREFIX}}_form_log("El campo \"$key\" no existe en el form \"$form_id\".");
        return;
    }

    $id = {{PREFIX}}_field_id($form_id, $key);
    $attrs = ['name' => $key, 'aria-describedby' => $id . '-error'];

    switch ($field['type']) {
        case 'radio':
            $attrs['type'] = 'radio';
            $attrs['id'] = $id . '-' . sanitize_html_class((string) $option);
            $attrs['value'] = (string) $option;
            break;
        case 'checkboxes':
            // name[]: el navegador manda todas las marcadas como lista.
            $attrs['type'] = 'checkbox';
            $attrs['name'] = $key . '[]';
            $attrs['id'] = $id . '-' . sanitize_html_class((string) $option);
            $attrs['value'] = (string) $option;
            break;
        case 'checkbox':
        case 'consent':
            $attrs['type'] = 'checkbox';
            $attrs['id'] = $id;
            $attrs['value'] = '1';
            break;
        case 'select':
            $attrs['id'] = $id;
            break;
        default:
            $attrs['id'] = $id;
            $attrs['maxlength'] = (int) $field['max'];
            if ($field['type'] !== 'textarea') {
                $attrs['type'] = ['email' => 'email', 'phone' => 'tel'][$field['type']] ?? 'text';
            }
            if ($field['type'] === 'digits') {
                $attrs['inputmode'] = 'numeric';
            }
            if ($field['autocomplete'] !== '') {
                $attrs['autocomplete'] = $field['autocomplete'];
            }
    }

    $out = [];
    foreach ($attrs as $name => $value) {
        $out[] = sprintf('%s="%s"', $name, esc_attr((string) $value));
    }
    // En un grupo de checkboxes, "required" en cada casilla pediría marcarlas todas: el
    // obligatorio se marca en el legend y lo valida el módulo.
    if ($field['required'] && $field['type'] !== 'checkboxes') {
        $out[] = 'required';
    }

    echo implode(' ', $out);
}

// Opciones de un select, radio o checkboxes, desde la definición: [valor => etiqueta].
function {{PREFIX}}_field_options($form_id, $key)
{
    $form = {{PREFIX}}_get_form($form_id);

    return (array) ($form['fields'][$key]['options'] ?? []);
}

// Atributos del contenedor de error de un campo.
function {{PREFIX}}_error_attrs($form_id, $key)
{
    printf(
        'id="%s" data-error-for="%s"',
        esc_attr({{PREFIX}}_field_id($form_id, $key) . '-error'),
        esc_attr($key)
    );
}

// Campo trampa: invisible para personas, los bots lo llenan.
function {{PREFIX}}_form_honeypot()
{
    printf(
        '<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">'
        . '<label>No llenar este campo<input type="text" name="%s" tabindex="-1" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore></label></div>',
        esc_attr({{PREFIX_UPPER}}_FORM_HONEYPOT)
    );
}

/* -------------------------------------------------------------------------
 * Validación y sanitizado (servidor)
 * ---------------------------------------------------------------------- */

function {{PREFIX}}_form_length($value)
{
    return mb_strlen($value, 'UTF-8');
}

// Igual que String.prototype.trim() de JS: también quita espacios Unicode (NBSP, etc.).
function {{PREFIX}}_form_trim($value)
{
    return (string) preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
}

// Valida un campo. Devuelve [valor_sanitizado, mensaje_error|null].
// El orden de los chequeos es el mismo que en el módulo JS.
function {{PREFIX}}_validate_field(array $field, $raw)
{
    $m = $field['messages'];
    $type = $field['type'];

    if ($type === 'checkboxes') {
        return {{PREFIX}}_validate_choices($field, $raw);
    }

    if (is_array($raw)) {
        return ['', $m['invalid']];
    }

    if ($type === 'checkbox' || $type === 'consent') {
        $checked = in_array((string) $raw, ['1', 'on', 'true'], true);
        return [$checked, ($field['required'] && !$checked) ? $m['required'] : null];
    }

    $value = (string) $raw;
    if ($value !== '' && wp_check_invalid_utf8($value) === '') {
        return ['', $m['invalid']];
    }
    if ($type === 'textarea') {
        $value = str_replace(["\r\n", "\r"], "\n", $value);
    }
    $value = {{PREFIX}}_form_trim($value);

    if ($value === '') {
        return ['', $field['required'] ? $m['required'] : null];
    }

    if ($type === 'select' || $type === 'radio') {
        $valid = in_array($value, array_map('strval', array_keys((array) $field['options'])), true);
        return [$valid ? $value : '', $valid ? null : $m['invalid']];
    }

    if ({{PREFIX}}_form_length($value) > (int) $field['max']) {
        return ['', $m['max']];
    }

    $forbidden = $type === 'textarea'
        ? '/[<>\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u'
        : '/[<>\x00-\x1F\x7F]/u';

    switch ($type) {
        case 'name':
            $valid = preg_match('/^[\p{L}\p{M} .\'\-]+$/u', $value) === 1;
            break;
        case 'email':
            // is_email() a secas: form.js tiene una copia exacta de sus reglas.
            $valid = (bool) is_email($value);
            break;
        case 'phone':
            $digits = strlen(preg_replace('/[^0-9]/', '', $value));
            $valid = preg_match('/^\+?[0-9 ()\-]+$/', $value) === 1
                && $digits >= (int) $field['min_digits']
                && $digits <= (int) $field['max_digits'];
            break;
        case 'digits':
            $valid = preg_match('/^[0-9]+$/', $value) === 1;
            break;
        default: // text, textarea
            $valid = preg_match($forbidden, $value) === 0;
    }
    if (!$valid) {
        return ['', $m['invalid']];
    }

    if ({{PREFIX}}_form_length($value) < (int) $field['min']) {
        return ['', $m['min']];
    }

    switch ($type) {
        case 'textarea':
            return [sanitize_textarea_field($value), null];
        case 'email':
            return [sanitize_email($value), null];
        case 'phone':
            // Se guarda normalizado: + opcional y solo dígitos.
            return [(str_starts_with($value, '+') ? '+' : '') . preg_replace('/[^0-9]/', '', $value), null];
        case 'digits':
            return [$value, null];
        default:
            return [sanitize_text_field($value), null];
    }
}

// Varias opciones (checkboxes): llega como lista de valores; vacío = ninguna marcada.
// Devuelve [valores en el orden de las opciones, mensaje_error|null]. Mismo orden que el JS:
// obligatorio → opción válida → máximo → mínimo.
function {{PREFIX}}_validate_choices(array $field, $raw)
{
    $m = $field['messages'];
    if ($raw === '' || $raw === null) {
        $raw = [];
    }
    if (!is_array($raw)) {
        return [[], $m['invalid']];
    }

    $values = [];
    foreach ($raw as $item) {
        if (!is_string($item)) {
            return [[], $m['invalid']];
        }
        $values[] = $item;
    }
    $values = array_values(array_unique($values));

    if (!$values) {
        return [[], $field['required'] ? $m['required'] : null];
    }

    $allowed = array_map('strval', array_keys((array) $field['options']));
    if (array_diff($values, $allowed)) {
        return [[], $m['invalid']];
    }
    if ((int) $field['max'] > 0 && count($values) > (int) $field['max']) {
        return [[], $m['max']];
    }
    if (count($values) < (int) $field['min']) {
        return [[], $m['min']];
    }

    // El orden de las opciones, no el de llegada: el correo sale siempre igual.
    return [array_values(array_intersect($allowed, $values)), null];
}

// Valor de un campo como texto, para el correo y los envíos guardados.
function {{PREFIX}}_form_value_text(array $field, $value)
{
    if (is_bool($value)) {
        return $value ? 'Sí' : 'No';
    }
    if (is_array($value)) {
        return implode(', ', array_map(static fn($item): string => (string) ($field['options'][$item] ?? $item), $value));
    }
    if (in_array($field['type'], ['select', 'radio'], true) && $value !== '') {
        return (string) ($field['options'][$value] ?? $value);
    }

    return (string) $value;
}

// Valida todos los campos definidos. Los campos no definidos se ignoran.
function {{PREFIX}}_validate_form(array $form, array $input)
{
    $data = [];
    $errors = [];

    foreach ($form['fields'] as $key => $field) {
        $raw = array_key_exists($key, $input) ? wp_unslash($input[$key]) : '';
        [$value, $error] = {{PREFIX}}_validate_field($field, $raw);
        $data[$key] = $value;
        if ($error !== null) {
            $errors[$key] = $error;
        }
    }

    return [$data, $errors];
}

/* -------------------------------------------------------------------------
 * Antispam
 * ---------------------------------------------------------------------- */

function {{PREFIX}}_form_client_ip()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';

    // Detrás de Cloudflare o un proxy, REMOTE_ADDR es la IP del proxy y todos los visitantes
    // compartirían el límite. Ahí se filtra este valor (ver SKILL.md, paso 8).
    $ip = (string) apply_filters('{{PREFIX}}_form_client_ip', $ip);

    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
}

function {{PREFIX}}_form_sign($time)
{
    return hash_hmac('sha256', (string) $time, wp_salt('nonce'));
}

// 'ok', 'too_fast' o 'expired'.
function {{PREFIX}}_form_check_token($token)
{
    $parts = explode('.', (string) $token, 2);
    if (count($parts) !== 2 || !ctype_digit($parts[0]) || !hash_equals({{PREFIX}}_form_sign($parts[0]), $parts[1])) {
        return 'expired';
    }

    $elapsed = time() - (int) $parts[0];
    if ($elapsed < {{PREFIX_UPPER}}_FORM_MIN_SECONDS) {
        return 'too_fast';
    }

    return $elapsed > {{PREFIX_UPPER}}_FORM_TOKEN_MAX_AGE ? 'expired' : 'ok';
}

// El token es de un solo uso: tras un envío real ya no sirve. Frena bots simples que
// reutilizan el mismo token; no es una defensa fuerte, el límite real es por IP.
function {{PREFIX}}_form_token_key($token)
{
    return '{{PREFIX}}_tk_' . md5((string) $token);
}

// Suma un envío para esta IP y form. Devuelve false si superó el límite.
function {{PREFIX}}_form_rate_limit($form_id, $limit)
{
    if ((int) $limit <= 0) {
        return true;
    }

    $key = '{{PREFIX}}_rl_' . md5($form_id . '|' . {{PREFIX}}_form_client_ip());
    $count = (int) get_transient($key);
    if ($count >= (int) $limit) {
        return false;
    }

    set_transient($key, $count + 1, {{PREFIX_UPPER}}_FORM_RATE_WINDOW);
    return true;
}

/* -------------------------------------------------------------------------
 * Envío del correo
 * ---------------------------------------------------------------------- */

function {{PREFIX}}_form_mail(array $form, array $data)
{
    $lines = [];
    foreach ($form['fields'] as $key => $field) {
        $label = $field['label'] !== '' ? $field['label'] : $key;
        $value = {{PREFIX}}_form_value_text($field, $data[$key]);

        $lines[] = $field['type'] === 'textarea'
            ? $label . ":\n" . $value
            : $label . ': ' . $value;
    }

    $page = esc_url_raw((string) wp_get_raw_referer());
    $body = sprintf("Nuevo envío del formulario \"%s\" en %s.\n\n", $form['title'], wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES))
        . implode("\n\n", $lines)
        . ($page !== '' ? "\n\nPágina: " . $page : '');

    $to = array_filter(array_map('sanitize_email', (array) $form['to']));
    if (!$to) {
        $to = [get_option('admin_email')];
    }

    // El From lo define Fluent SMTP en producción (un correo del dominio del cliente).
    // El correo del usuario va solo en Reply-To; ya viene validado y sin saltos de línea.
    $headers = ['Content-Type: text/plain; charset=UTF-8'];
    $reply_to = $form['reply_to'] !== '' ? (string) ($data[$form['reply_to']] ?? '') : '';
    if ($reply_to !== '' && is_email($reply_to)) {
        $headers[] = 'Reply-To: ' . $reply_to;
    }

    $mail = apply_filters('{{PREFIX}}_form_mail', [
        'to'      => $to,
        'subject' => trim(preg_replace('/[\r\n]+/', ' ', wp_strip_all_tags($form['subject']))),
        'message' => $body,
        'headers' => $headers,
    ], $form, $data);

    return (bool) wp_mail($mail['to'], $mail['subject'], $mail['message'], $mail['headers']);
}

function {{PREFIX}}_form_mail_failed($error)
{
    {{PREFIX}}_form_log('wp_mail falló: ' . $error->get_error_message());
}
add_action('wp_mail_failed', '{{PREFIX}}_form_mail_failed');

/* -------------------------------------------------------------------------
 * Endpoints AJAX
 * ---------------------------------------------------------------------- */

// Nonce y token de tiempo frescos. El JS los pide cuando el form aparece en pantalla,
// así funcionan aunque la página esté en caché.
function {{PREFIX}}_form_token()
{
    nocache_headers();
    $time = time();

    wp_send_json_success([
        'nonce' => wp_create_nonce({{PREFIX_UPPER}}_FORM_NONCE),
        'token' => $time . '.' . {{PREFIX}}_form_sign($time),
    ]);
}
add_action('wp_ajax_{{PREFIX}}_form_token', '{{PREFIX}}_form_token');
add_action('wp_ajax_nopriv_{{PREFIX}}_form_token', '{{PREFIX}}_form_token');

function {{PREFIX}}_form_error($message, $status, array $extra = [])
{
    wp_send_json_error(['message' => $message] + $extra, $status);
}

function {{PREFIX}}_form_submit()
{
    nocache_headers();

    $generic = 'No pudimos enviar tu mensaje. Intenta de nuevo en unos minutos.';
    $form_id = isset($_POST['form']) ? sanitize_key(wp_unslash($_POST['form'])) : '';
    $form = {{PREFIX}}_get_form($form_id);
    if (!$form) {
        {{PREFIX}}_form_error($generic, 400);
    }

    // 1. Nonce (CSRF).
    if (!check_ajax_referer({{PREFIX_UPPER}}_FORM_NONCE, 'nonce', false)) {
        {{PREFIX}}_form_error('El formulario venció. Vuelve a enviarlo.', 403, ['code' => 'expired']);
    }

    // 2. Honeypot: a un bot se le responde éxito para no darle pistas.
    if (!empty($_POST[{{PREFIX_UPPER}}_FORM_HONEYPOT])) {
        {{PREFIX}}_form_log("Honeypot activado en \"$form_id\".");
        wp_send_json_success(['message' => $form['success'], 'redirect' => '']);
    }

    // 3. Tiempo mínimo y vigencia del token.
    $raw_token = isset($_POST['token']) ? sanitize_text_field(wp_unslash($_POST['token'])) : '';
    $token = {{PREFIX}}_form_check_token($raw_token);
    if ($token === 'too_fast') {
        {{PREFIX}}_form_error('Espera unos segundos y vuelve a enviarlo.', 429, ['code' => 'too_fast']);
    }
    if ($token === 'expired') {
        {{PREFIX}}_form_error('El formulario venció. Vuelve a enviarlo.', 403, ['code' => 'expired']);
    }

    // 4. Validación con las mismas reglas que el front.
    [$data, $errors] = {{PREFIX}}_validate_form($form, $_POST);
    if ($errors) {
        {{PREFIX}}_form_error('Revisa los campos marcados.', 422, ['fields' => $errors]);
    }

    // 5. Doble envío: el mismo contenido desde la misma IP en poco tiempo se ignora.
    $duplicate_key = '{{PREFIX}}_dup_' . md5($form_id . '|' . {{PREFIX}}_form_client_ip() . '|' . wp_json_encode($data));
    if (get_transient($duplicate_key)) {
        wp_send_json_success(['message' => $form['success'], 'redirect' => esc_url_raw($form['redirect'])]);
    }

    // 6. Token ya usado en otro envío.
    if (get_transient({{PREFIX}}_form_token_key($raw_token))) {
        {{PREFIX}}_form_error('El formulario venció. Vuelve a enviarlo.', 403, ['code' => 'expired']);
    }

    // 7. Límite de envíos por IP.
    if (!{{PREFIX}}_form_rate_limit($form_id, $form['rate_limit'])) {
        {{PREFIX}}_form_error('Recibimos varios envíos seguidos. Intenta de nuevo más tarde.', 429, ['code' => 'rate_limit']);
    }

    set_transient($duplicate_key, 1, {{PREFIX_UPPER}}_FORM_DUPLICATE_WINDOW);
    set_transient({{PREFIX}}_form_token_key($raw_token), 1, {{PREFIX_UPPER}}_FORM_TOKEN_MAX_AGE);

    // 8. Envío, guardado opcional y gancho para integraciones (CRM, etc.).
    $sent = {{PREFIX}}_form_mail($form, $data);

    $store = $form['store'];
    if (function_exists('{{PREFIX}}_form_store_entry') && ($store === 'all' || ($store === 'failed' && !$sent))) {
        {{PREFIX}}_form_store_entry($form, $data, $sent);
    }

    do_action('{{PREFIX}}_form_submitted', $form_id, $data, $sent, $form);

    if (!$sent) {
        delete_transient($duplicate_key); // Permite reintentar.
        delete_transient({{PREFIX}}_form_token_key($raw_token)); // Y con el mismo token.
        {{PREFIX}}_form_error($generic, 500);
    }

    wp_send_json_success(['message' => $form['success'], 'redirect' => esc_url_raw($form['redirect'])]);
}
add_action('wp_ajax_{{PREFIX}}_form_submit', '{{PREFIX}}_form_submit');
add_action('wp_ajax_nopriv_{{PREFIX}}_form_submit', '{{PREFIX}}_form_submit');

function {{PREFIX}}_form_log($message)
{
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('[{{THEME_SLUG}}:forms] ' . $message);
    }
}
