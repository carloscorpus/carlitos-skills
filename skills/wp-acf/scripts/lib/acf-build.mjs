// Construye los JSON de ACF Pro (grupos de campos, tipos de contenido, taxonomías y páginas de
// opciones) a partir de los specs de design-import. Funciones puras, sin dependencias: las usan
// generate.mjs (escribe) y check.mjs (compara). Nada aquí lee ni escribe archivos.

import { createHash } from 'node:crypto';
import { fieldChoices, slugify, unwrap } from './specs.mjs';

export { slugify };

// Clave estable: depende solo del nombre, así regenerar no cambia las claves ni pierde contenido.
export const keyOf = (kind, name) => `${kind}_${createHash('sha1').update(`wp-acf:${kind}:${name}`).digest('hex').slice(0, 13)}`;

// ---------- Textos en español ----------

const WORDS = {
    alt: 'texto alternativo', titulo: 'título', descripcion: 'descripción', boton: 'botón', direccion: 'dirección',
    telefono: 'teléfono', numero: 'número', pagina: 'página', categoria: 'categoría', informacion: 'información',
    seccion: 'sección', ano: 'año', anio: 'año', ubicacion: 'ubicación', version: 'versión', operacion: 'operación',
    resolucion: 'resolución', navegacion: 'navegación', publicacion: 'publicación', duracion: 'duración',
    codigo: 'código', area: 'área', mas: 'más', pais: 'país', razon: 'razón', imagenes: 'imágenes', fotografia: 'fotografía',
    politica: 'política', mision: 'misión', vision: 'visión', gestion: 'gestión', atencion: 'atención', minimo: 'mínimo',
    maximo: 'máximo', logistica: 'logística', tecnica: 'técnica', tecnico: 'técnico', economico: 'económico',
};

export function humanize(name) {
    const text = name.split('_').filter(Boolean).map((word) => WORDS[word] ?? word).join(' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const pluralWord = (word) => {
    if (/[aeiouáéíóú]$/i.test(word)) return `${word}s`;
    if (/z$/i.test(word)) return `${word.slice(0, -1)}ces`;
    return `${word}es`;
};

// "producto" -> Producto / Productos; "categoria_producto" -> Categoría de producto / Categorías de producto.
export function labelsEs(key) {
    const [first, ...rest] = key.split('_').map((word) => WORDS[word] ?? word);
    const tail = rest.length ? ` de ${rest.join(' ')}` : '';
    const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
    return { singular: cap(`${first}${tail}`), plural: cap(`${pluralWord(first)}${tail}`) };
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// ---------- Campos ----------

export const SUPPORTED_TYPES = new Set([
    'text', 'textarea', 'wysiwyg', 'number', 'email', 'url', 'image', 'file', 'gallery', 'oembed', 'select', 'radio',
    'checkbox', 'button_group', 'true_false', 'link', 'date_picker', 'color_picker', 'group', 'repeater',
]);

const noBindings = { allow_in_bindings: 0 };

const choicesOf = (row) => fieldChoices(row.description);

function typeProps(row, errors) {
    switch (row.type) {
        case 'text': return { default_value: '', maxlength: '', ...noBindings, placeholder: '', prepend: '', append: '' };
        // new_lines vacío a propósito: <prefix>_highlight() de wp-helper convierte los saltos en <br>; si ACF
        // pusiera los <br />, el helper los escaparía y se verían en la web.
        case 'textarea': return { default_value: '', maxlength: '', ...noBindings, placeholder: '', rows: 4, new_lines: '' };
        case 'wysiwyg': return { default_value: '', ...noBindings, tabs: 'all', toolbar: 'full', media_upload: 1, delay: 0 };
        case 'number': return { default_value: '', min: '', max: '', ...noBindings, placeholder: '', step: '', prepend: '', append: '' };
        case 'email': return { default_value: '', ...noBindings, placeholder: '', prepend: '', append: '' };
        case 'url': return { default_value: '', ...noBindings, placeholder: '' };
        case 'image': return { return_format: 'array', library: 'all', min_width: '', min_height: '', min_size: '', max_width: '', max_height: '', max_size: '', mime_types: '', ...noBindings, preview_size: 'medium' };
        case 'file': return { return_format: 'array', library: 'all', min_size: '', max_size: '', mime_types: '', ...noBindings };
        case 'gallery': return { return_format: 'array', library: 'all', min: '', max: '', min_width: '', min_height: '', min_size: '', max_width: '', max_height: '', max_size: '', mime_types: '', insert: 'append', preview_size: 'medium' };
        case 'link': return { return_format: 'array', ...noBindings };
        case 'true_false': return { message: '', default_value: 0, ...noBindings, ui_on_text: '', ui_off_text: '', ui: 1 };
        case 'oembed': return { width: '', height: '', ...noBindings };
        case 'date_picker': return { display_format: 'd/m/Y', return_format: 'd/m/Y', first_day: 1, ...noBindings };
        case 'color_picker': return { default_value: '', enable_opacity: 0, return_format: 'string', ...noBindings };
        case 'select': case 'radio': case 'checkbox': case 'button_group': {
            const choices = choicesOf(row);
            if (!choices) errors.push(`${row.name}: un campo ${row.type} necesita "Opciones: a, b, c" al final de la descripción.`);
            const base = { choices: choices ?? {}, default_value: row.type === 'select' ? false : '', return_format: 'value', ...noBindings };
            if (row.type === 'select') return { ...base, multiple: 0, allow_null: 0, ui: 0, ajax: 0, placeholder: '' };
            if (row.type === 'radio') return { ...base, allow_null: 0, other_choice: 0, layout: 'vertical', save_other_choice: 0 };
            if (row.type === 'checkbox') return { ...base, allow_custom: 0, layout: 'vertical', toggle: 0, save_custom: 0, custom_choice_button_text: 'Añadir opción' };
            return { ...base, allow_null: 0, layout: 'horizontal' };
        }
        default: return {};
    }
}

const ENTER_HINT = 'Usa Enter para pasar a otra línea.';

// Un campo del spec -> un campo de ACF. `children` son las filas hijas (repeater o group).
function buildField(row, name, children, errors) {
    // Un textarea con varias líneas en el diseño (<br> en "valor actual") le dice al editor cómo cortar la línea.
    const multiline = row.type === 'textarea' && row.breaks && !/\benter\b/i.test(row.description);
    const field = {
        key: keyOf('field', row.name),
        label: humanize(name),
        name,
        'aria-label': '',
        type: row.type,
        instructions: multiline ? `${row.description.replace(/\.?$/, '.')} ${ENTER_HINT}` : row.description,
        required: row.required ? 1 : 0,
        conditional_logic: 0,
        wrapper: { width: '', class: '', id: '' },
        ...typeProps(row, errors),
    };
    if (row.type === 'repeater' || row.type === 'group') {
        const subs = children.get(row.name) ?? [];
        if (!subs.length) errors.push(`${row.name}: un ${row.type} necesita subcampos (filas "${row.name}.<campo>").`);
        const subFields = subs.map((sub) => buildField(sub, sub.name.slice(sub.name.lastIndexOf('.') + 1), children, errors));
        if (row.type === 'repeater') Object.assign(field, { layout: 'block', pagination: 0, min: 0, max: 0, collapsed: '', button_label: 'Añadir fila', rows_per_page: 20 });
        else field.layout = 'block';
        field.sub_fields = subFields;
    }
    return field;
}

// Una sección del spec -> un campo `group` con sus subcampos.
function buildSection(section, errors, file) {
    const err = (message) => errors.push({ file, message: `${section.name}: ${message}` });
    const local = [];
    const byName = new Map(section.fields.map((row) => [row.name, row]));
    const children = new Map();
    for (const row of section.fields) {
        if (!SUPPORTED_TYPES.has(row.type)) { local.push(`${row.name}: el tipo "${row.type}" aún no lo genera wp-acf (soporta ${[...SUPPORTED_TYPES].join(', ')}).`); continue; }
        const dot = row.name.lastIndexOf('.');
        const parent = dot === -1 ? '' : row.name.slice(0, dot);
        if (parent) {
            const parentRow = byName.get(parent);
            if (!parentRow) { local.push(`${row.name}: falta la fila del repetidor "${parent}".`); continue; }
            if (!['repeater', 'group'].includes(parentRow.type)) { local.push(`${row.name}: "${parent}" no es un repeater ni un group.`); continue; }
        } else if (!row.name.startsWith(`${section.group}_`)) {
            local.push(`${row.name}: debe empezar con "${section.group}_".`);
            continue;
        }
        if (!children.has(parent)) children.set(parent, []);
        children.get(parent).push(row);
    }
    const top = children.get('') ?? [];
    const subFields = top.map((row) => buildField(row, row.name.slice(section.group.length + 1), children, local));
    for (const message of local) err(message);
    return {
        key: keyOf('field', section.group),
        label: humanize(section.name),
        name: section.group,
        'aria-label': '',
        type: 'group',
        instructions: '',
        required: 0,
        conditional_logic: 0,
        wrapper: { width: '', class: '', id: '' },
        layout: 'block',
        sub_fields: subFields,
    };
}

// ---------- Ubicación ----------

// "página de inicio (front page)", "plantilla pages/template-x.php", "página de opciones: Ajustes del sitio",
// "tipo de contenido = comunicado".
export function locationFor(text, dynamic) {
    const value = unwrap(text ?? '').trim();
    if (/^p[aá]gina de inicio/i.test(value)) return { rule: { param: 'page_type', operator: '==', value: 'front_page' } };
    const template = /^plantilla\s+(\S+)/i.exec(value);
    if (template) return { rule: { param: 'page_template', operator: '==', value: template[1] } };
    const options = /^p[aá]gina de opciones:\s*(.+)$/i.exec(value);
    if (options) {
        const title = capitalize(options[1].trim());
        const slug = slugify(title);
        return { rule: { param: 'options_page', operator: '==', value: slug }, options: { title, slug } };
    }
    const content = /^tipo de contenido\s*=\s*([a-z][a-z0-9_]*)/i.exec(value)?.[1];
    if (content) {
        const row = dynamic.find((r) => r.name === content);
        if (!row) return { error: `La ubicación nombra el contenido "${content}" que no está en "Contenido dinámico" de _shared.md.` };
        return { rule: { param: 'post_type', operator: '==', value: row.origin === 'cpt' ? row.name : 'post' }, content };
    }
    return { error: `Ubicación no reconocida: "${value}". Usa página de inicio, plantilla <archivo>, página de opciones: <nombre> o tipo de contenido = <contenido>.` };
}

// ---------- Todo junto ----------

const OPTIONS_PARENT = 'ajustes-del-sitio';

export function buildAll({ pages, dynamic }) {
    const errors = [];
    const groups = [];
    const options = new Map();
    const used = new Set();

    for (const page of pages) {
        const location = locationFor(page.labels.Ubicación, dynamic);
        if (location.error) { errors.push({ file: page.file, message: location.error }); continue; }
        if (location.options) options.set(location.options.slug, location.options);
        if (location.content) used.add(location.content);
        const content = unwrap(page.labels.Contenido ?? '');
        if (content && content !== 'ninguno') used.add(content);

        const fields = [];
        for (const section of page.sections) {
            if (section.state === 'descartado' || !section.group || section.group === 'ninguno') continue;
            fields.push(buildSection(section, errors, page.file));
        }
        groups.push({
            page: page.slug,
            json: {
                key: keyOf('group', page.slug),
                title: unwrap(page.labels['Grupo ACF'] ?? page.slug),
                fields,
                location: [[location.rule]],
                menu_order: 0,
                position: 'normal',
                style: 'default',
                label_placement: 'top',
                instruction_placement: 'label',
                hide_on_screen: '',
                active: true,
                description: '',
                show_in_rest: 0,
                display_title: '',
                allow_ai_access: false,
                ai_description: '',
            },
        });
    }

    const postTypes = [];
    const taxonomies = [];
    for (const row of dynamic) {
        if (!used.has(row.name) || row.origin === 'woo') continue;
        const objectType = row.origin === 'cpt' ? row.name : 'post';
        const own = row.taxonomies.filter((tax) => !tax.native);
        if (row.origin === 'cpt') {
            if (row.name.length > 20 || !/^[a-z0-9_-]+$/.test(row.name)) {
                errors.push({ file: '_shared.md', message: `Contenido "${row.name}": la clave de un tipo de contenido tiene hasta 20 caracteres en minúsculas, números, guion o guion bajo.` });
                continue;
            }
            const { singular, plural } = labelsEs(row.name);
            postTypes.push({
                content: row.name,
                json: {
                    key: keyOf('post_type', row.name),
                    title: plural,
                    menu_order: 0,
                    active: true,
                    post_type: row.name,
                    advanced_configuration: false,
                    import_source: '',
                    import_date: '',
                    labels: {
                        name: plural, singular_name: singular, menu_name: plural, all_items: `Todos los ${plural.toLowerCase()}`,
                        add_new: 'Añadir nuevo', add_new_item: `Añadir ${singular.toLowerCase()}`, edit_item: `Editar ${singular.toLowerCase()}`,
                        new_item: `Nuevo ${singular.toLowerCase()}`, view_item: `Ver ${singular.toLowerCase()}`,
                        search_items: `Buscar ${plural.toLowerCase()}`, not_found: 'No se encontró ninguno', not_found_in_trash: 'No hay ninguno en la papelera',
                    },
                    description: '',
                    public: true,
                    hierarchical: false,
                    exclude_from_search: false,
                    publicly_queryable: true,
                    show_ui: true,
                    show_in_menu: true,
                    admin_menu_parent: '',
                    show_in_admin_bar: true,
                    show_in_nav_menus: true,
                    show_in_rest: true,
                    rest_base: '',
                    rest_namespace: 'wp/v2',
                    rest_controller_class: 'WP_REST_Posts_Controller',
                    menu_position: '',
                    menu_icon: '',
                    rename_capabilities: false,
                    singular_capability_name: 'post',
                    plural_capability_name: 'posts',
                    supports: ['title', 'editor', 'thumbnail'],
                    taxonomies: own.map((tax) => tax.key),
                    has_archive: true,
                    has_archive_slug: '',
                    rewrite: { permalink_rewrite: 'post_type_key', slug: '', feeds: false, pages: true, with_front: true },
                    query_var: 'post_type_key',
                    query_var_name: '',
                    can_export: true,
                    delete_with_user: false,
                    register_meta_box_cb: '',
                    enter_title_here: '',
                },
            });
        }
        for (const tax of own) {
            if (tax.key.length > 32) { errors.push({ file: '_shared.md', message: `Taxonomía "${tax.key}": la clave tiene hasta 32 caracteres.` }); continue; }
            const { singular, plural } = labelsEs(tax.key);
            taxonomies.push({
                taxonomy: tax.key,
                terms: tax.terms,
                content: row.name,
                json: {
                    key: keyOf('taxonomy', tax.key),
                    title: plural,
                    menu_order: 0,
                    active: true,
                    taxonomy: tax.key,
                    object_type: [objectType],
                    advanced_configuration: 0,
                    import_source: '',
                    import_date: '',
                    labels: {
                        singular_name: singular, name: plural, menu_name: plural, search_items: `Buscar ${plural.toLowerCase()}`,
                        all_items: `Todas: ${plural.toLowerCase()}`, edit_item: `Editar ${singular.toLowerCase()}`, view_item: `Ver ${singular.toLowerCase()}`,
                        update_item: `Actualizar ${singular.toLowerCase()}`, add_new_item: `Añadir ${singular.toLowerCase()}`,
                        new_item_name: `Nombre de la nueva ${singular.toLowerCase()}`, not_found: 'No se encontró ninguna', no_terms: 'Sin elementos',
                    },
                    description: '',
                    capabilities: { manage_terms: 'manage_categories', edit_terms: 'manage_categories', delete_terms: 'manage_categories', assign_terms: 'edit_posts' },
                    public: true,
                    publicly_queryable: true,
                    hierarchical: tax.hierarchical,
                    show_ui: true,
                    show_in_menu: true,
                    show_in_nav_menus: true,
                    show_in_rest: true,
                    rest_base: '',
                    rest_namespace: 'wp/v2',
                    rest_controller_class: 'WP_REST_Terms_Controller',
                    show_tagcloud: false,
                    show_in_quick_edit: true,
                    show_admin_column: true,
                    rewrite: { permalink_rewrite: 'taxonomy_key', slug: '', with_front: true, rewrite_hierarchical: false },
                    query_var: 'taxonomy_key',
                    query_var_name: '',
                    default_term: { default_term_enabled: false, default_term_name: '', default_term_slug: '', default_term_description: '' },
                    sort: null,
                    meta_box: 'default',
                    meta_box_cb: '',
                    meta_box_sanitize_cb: '',
                },
            });
        }
    }

    // La primera página de opciones llamada "Ajustes del sitio" es el menú principal; las demás cuelgan de ella.
    const optionsPages = [...options.values()].map((page) => ({
        slug: page.slug,
        json: {
            key: keyOf('ui_options_page', page.slug),
            title: page.title,
            active: true,
            menu_order: 0,
            page_title: page.title,
            menu_slug: page.slug,
            parent_slug: options.has(OPTIONS_PARENT) && page.slug !== OPTIONS_PARENT ? OPTIONS_PARENT : '',
            advanced_configuration: false,
            icon_url: '',
            menu_title: page.title,
            position: '',
            redirect: false,
            description: '',
            menu_icon: { type: 'dashicons', value: 'dashicons-admin-generic' },
            update_button: 'Guardar cambios',
            updated_message: 'Cambios guardados',
            capability: 'edit_posts',
            data_storage: 'options',
            post_id: '',
            autoload: false,
        },
    }));

    return { groups, postTypes, taxonomies, optionsPages, errors };
}

// Recorre los campos de un grupo de ACF y devuelve { nombre completo del spec -> { type, required } }.
// El nombre completo es el del spec: "<grupo>_<sub>" en el primer nivel y "<padre>.<sub>" debajo.
export function flattenGroup(json) {
    const out = new Map();
    const walk = (fields, prefix, parentPath) => {
        for (const field of fields) {
            const full = parentPath === null ? field.name : parentPath === '' ? `${prefix}_${field.name}` : `${parentPath}.${field.name}`;
            out.set(full, { type: field.type, required: !!field.required });
            if (field.sub_fields) walk(field.sub_fields, field.name, full);
        }
    };
    for (const section of json.fields ?? []) {
        out.set(section.name, { type: section.type, required: false });
        walk(section.sub_fields ?? [], section.name, '');
        // Los hijos de un grupo de sección cuelgan de "<sección>_<campo>", no de "<sección>.<campo>".
    }
    return out;
}
