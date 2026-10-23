/*
 * Módulo de formularios (skill wp-form).
 * Versión del motor: {{ENGINE_VERSION}}
 *
 * Es genérico: sirve para todos los forms del tema. Cada <form data-form> trae sus
 * reglas en data-rules (generadas en PHP desde inc/forms/<id>.php) y aquí se arma
 * el esquema Zod. Las reglas, el orden y los mensajes son los mismos del servidor;
 * tests/ en la skill lo comprueba con los mismos casos en ambos lados.
 *
 * Este archivo no se edita por proyecto. Un form nuevo solo necesita su definición
 * en inc/forms/ y su vista en template-parts/forms/.
 */
import * as z from 'zod';

const TOKEN_ACTION = '{{PREFIX}}_form_token';
const SUBMIT_ACTION = '{{PREFIX}}_form_submit';
const HONEYPOT = '{{PREFIX}}_hp';

const MSG_INVALID = 'Revisa los campos marcados.';
const MSG_GENERIC = 'No pudimos enviar tu mensaje. Intenta de nuevo en unos minutos.';
const MSG_TIMEOUT = 'El envío tardó demasiado y no sabemos si llegó. Intenta de nuevo en unos minutos.';

// Si el servidor no responde en este tiempo, se corta la espera y el botón vuelve a estar activo.
const TIMEOUT_MS = 25000;

// Mismas expresiones que inc/forms.php. Espacio = solo " " (no \s, que difiere entre JS y PHP).
const NAME_RE = /^[\p{L}\p{M} .'-]+$/u;
const PHONE_RE = /^\+?[0-9 ()-]+$/;
const DIGITS_RE = /^[0-9]+$/;
const FORBIDDEN_SINGLE = /[<>\u0000-\u001F\u007F]/;
const FORBIDDEN_MULTI = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// Filtros mientras se escribe: quitan lo que el campo nunca aceptará.
const TYPING_FILTERS = {
    name: /[^\p{L}\p{M} .'-]/gu,
    phone: /[^0-9 ()+-]/g,
    digits: /[^0-9]/g,
};

// Copia exacta de is_email() de WordPress, para que front y back acepten los mismos correos.
function isEmail(email) {
    if (email.length < 6) return false;
    const at = email.indexOf('@', 1);
    if (at === -1) return false;

    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;
    if (/\.{2,}/.test(domain)) return false;
    if (domain.replace(/^[ \t\n\r\0\x0B.]+|[ \t\n\r\0\x0B.]+$/g, '') !== domain) return false;

    const subs = domain.split('.');
    if (subs.length < 2) return false;
    return subs.every(
        (sub) => sub.replace(/^[ \t\n\r\0\x0B-]+|[ \t\n\r\0\x0B-]+$/g, '') === sub && /^[a-z0-9-]+$/i.test(sub),
    );
}

// Aplica el filtro sin mover el cursor al final cuando se edita a mitad del texto.
function applyTypingFilter(input, filter) {
    const value = input.value;
    const clean = value.replace(filter, '');
    if (clean === value) return;

    const caret = input.selectionStart ?? value.length;
    const removedBefore = value.slice(0, caret).length - value.slice(0, caret).replace(filter, '').length;
    input.value = clean;
    try {
        input.setSelectionRange(caret - removedBefore, caret - removedBefore);
    } catch {
        // Algunos tipos de input (email) no permiten mover el cursor.
    }
}

// Avisa al resto de la página (p. ej. un modal de wp-modal) sin acoplarse a ella: el evento
// burbujea desde el <form>.
const notify = (form, name, detail) => form.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

const isToggle = (rule) => rule.type === 'checkbox' || rule.type === 'consent';

// Cuenta caracteres reales (igual que mb_strlen en PHP).
const length = (value) => [...value].length;

// Esquema Zod de un campo. El orden de los chequeos es el mismo que en PHP:
// obligatorio → largo máximo → formato → largo mínimo. Se muestra el primer error.
export function fieldSchema(rule) {
    const m = rule.messages;

    if (isToggle(rule)) {
        return z.boolean().refine((v) => v || !rule.required, { error: m.required });
    }

    let schema = z
        .string()
        .trim()
        .refine((v) => v !== '' || !rule.required, { error: m.required, abort: true });

    // Los chequeos siguientes no aplican a un campo opcional vacío.
    const check = (fn, error) => {
        schema = schema.refine((v) => v === '' || fn(v), { error });
    };

    if (rule.type === 'select' || rule.type === 'radio') {
        check((v) => rule.options.includes(v), m.invalid);
        return schema;
    }

    check((v) => length(v) <= rule.max, m.max);

    switch (rule.type) {
        case 'name':
            check((v) => NAME_RE.test(v), m.invalid);
            break;
        case 'email':
            check((v) => isEmail(v), m.invalid);
            break;
        case 'phone':
            check((v) => {
                const digits = v.replace(/[^0-9]/g, '').length;
                return PHONE_RE.test(v) && digits >= rule.min_digits && digits <= rule.max_digits;
            }, m.invalid);
            break;
        case 'digits':
            check((v) => DIGITS_RE.test(v), m.invalid);
            break;
        case 'textarea':
            check((v) => !FORBIDDEN_MULTI.test(v), m.invalid);
            break;
        default:
            check((v) => !FORBIDDEN_SINGLE.test(v), m.invalid);
    }

    check((v) => length(v) >= rule.min, m.min);

    return schema;
}

async function post(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        body,
        credentials: 'same-origin',
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await response.json().catch(() => null);

    return {
        status: response.status,
        success: Boolean(json?.success),
        data: json?.data ?? {},
    };
}

function initForm(form) {
    if (form.dataset.formReady) return;

    let rules;
    try {
        rules = JSON.parse(form.dataset.rules || '{}');
    } catch {
        console.error(`[wp-form] data-rules inválido en #${form.id}`);
        return;
    }
    form.dataset.formReady = 'true';

    const keys = Object.keys(rules);
    const schema = z.object(Object.fromEntries(keys.map((key) => [key, fieldSchema(rules[key])])));

    const url = form.dataset.ajaxUrl;
    const status = form.querySelector('[data-form-status]');
    const submit = form.querySelector('[type="submit"]');
    const submitLabel = submit?.querySelector('[data-submit-label]');
    const idleLabel = submitLabel?.textContent;
    let busy = false;
    let tokenRequest = null;

    /* Nonce y token de tiempo: se piden frescos, nunca vienen en el HTML cacheado. */

    const requestToken = () => {
        if (!tokenRequest) {
            const body = new FormData();
            body.append('action', TOKEN_ACTION);
            tokenRequest = post(url, body).then((res) => {
                if (!res.success) throw new Error('token');
                return res.data;
            });
            tokenRequest.catch(() => {
                tokenRequest = null;
            });
        }
        return tokenRequest;
    };

    const renewToken = () => {
        tokenRequest = null;
        requestToken().catch(() => {});
    };

    // Se pide cuando el form aparece en pantalla, o al primer foco si no hay soporte.
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                requestToken().catch(() => {});
            }
        });
        observer.observe(form);
    }
    form.addEventListener('focusin', () => requestToken().catch(() => {}), { once: true });

    /* Campos y errores */

    const inputsOf = (key) => [...form.querySelectorAll(`[name="${CSS.escape(key)}"]`)];

    const valueOf = (key) => {
        const inputs = inputsOf(key);
        if (isToggle(rules[key])) return Boolean(inputs[0]?.checked);
        if (rules[key].type === 'radio') return inputs.find((input) => input.checked)?.value ?? '';
        return inputs[0]?.value ?? '';
    };

    const setError = (key, message) => {
        const box = form.querySelector(`[data-error-for="${CSS.escape(key)}"]`);
        if (box) box.textContent = message;
        inputsOf(key).forEach((input) => {
            if (message) input.setAttribute('aria-invalid', 'true');
            else input.removeAttribute('aria-invalid');
        });
    };

    const validateField = (key) => {
        const result = schema.shape[key].safeParse(valueOf(key));
        setError(key, result.success ? '' : result.error.issues[0].message);
    };

    const showErrors = (errors) => {
        Object.entries(errors).forEach(([key, message]) => setError(key, message));
        const first = form.querySelector('[aria-invalid="true"]');
        first?.focus();
    };

    const setStatus = (message, state) => {
        if (!status) return;
        status.textContent = message;
        if (state) status.dataset.state = state;
        else delete status.dataset.state;
    };

    const setBusy = (value) => {
        busy = value;
        form.setAttribute('aria-busy', String(value));
        if (!submit) return;
        submit.disabled = value;
        submit.toggleAttribute('data-loading', value);
        if (submitLabel && submit.dataset.loadingLabel) {
            submitLabel.textContent = value ? submit.dataset.loadingLabel : idleLabel;
        }
    };

    const onTyping = (event) => {
        const { name } = event.target;
        const rule = rules[name];
        if (!rule) return;

        // Durante una composición (IME, teclados asiáticos o con acentos) no se toca el valor;
        // se filtra al terminar, en compositionend.
        const filter = TYPING_FILTERS[rule.type];
        if (filter && !event.isComposing) applyTypingFilter(event.target, filter);

        // Si el campo ya mostraba un error, se revalida mientras se corrige.
        if (event.target.getAttribute('aria-invalid') === 'true') validateField(name);
    };
    form.addEventListener('input', onTyping);
    form.addEventListener('compositionend', onTyping);

    form.addEventListener('focusout', (event) => {
        const { name } = event.target;
        if (rules[name] && !isToggle(rules[name]) && rules[name].type !== 'radio') validateField(name);
    });

    form.addEventListener('change', (event) => {
        const { name } = event.target;
        if (rules[name] && (isToggle(rules[name]) || rules[name].type === 'radio' || rules[name].type === 'select')) {
            validateField(name);
        }
    });

    /* Envío */

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy) return;

        keys.forEach((key) => setError(key, ''));
        setStatus('', '');

        const result = schema.safeParse(Object.fromEntries(keys.map((key) => [key, valueOf(key)])));
        if (!result.success) {
            const errors = {};
            result.error.issues.forEach((issue) => {
                const key = issue.path[0];
                if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
            });
            showErrors(errors);
            setStatus(MSG_INVALID, 'error');
            return;
        }

        setBusy(true);
        let redirecting = false;

        try {
            const { nonce, token } = await requestToken();

            const body = new FormData();
            body.append('action', SUBMIT_ACTION);
            body.append('form', form.dataset.form);
            body.append('nonce', nonce);
            body.append('token', token);
            body.append(HONEYPOT, form.elements.namedItem(HONEYPOT)?.value ?? '');
            keys.forEach((key) => {
                const value = result.data[key];
                body.append(key, typeof value === 'boolean' ? (value ? '1' : '') : value);
            });

            const res = await post(url, body);

            if (res.success) {
                if (res.data.redirect) {
                    redirecting = true;
                    window.location.assign(res.data.redirect);
                    return;
                }
                form.reset();
                setStatus(res.data.message, 'success');
                renewToken(); // El próximo envío necesita su propio token.
                notify(form, 'wp-form:success', { message: res.data.message });
                return;
            }

            // Error: los datos se mantienen para que el usuario no reescriba nada.
            if (res.status === 422 && res.data.fields) showErrors(res.data.fields);
            // too_fast no renueva: el token actual sigue envejeciendo y el reintento pasa.
            if (res.data.code === 'expired') renewToken();
            setStatus(res.data.message || MSG_GENERIC, 'error');
            notify(form, 'wp-form:error', { status: res.status, code: res.data.code });
        } catch (error) {
            const timedOut = error?.name === 'TimeoutError';
            setStatus(timedOut ? MSG_TIMEOUT : MSG_GENERIC, 'error');
            renewToken();
            notify(form, 'wp-form:error', { status: 0, code: timedOut ? 'timeout' : 'network' });
        } finally {
            if (!redirecting) setBusy(false);
        }
    });
}

export function initForms(root = document) {
    root.querySelectorAll('form[data-form]').forEach(initForm);
}
