// Archivos del manual en el proyecto: .env.manual (credenciales del Local), la carpeta specs/manual/ y
// _manual.md (datos de la portada). Sin dependencias.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const ENV_KEYS = ['MANUAL_URL', 'MANUAL_USER', 'MANUAL_PASS', 'MANUAL_FORMATO', 'MANUAL_BLOQUEAR'];
export const FORMATOS = ['horizontal', 'vertical', 'ambos'];

// Rutas de trabajo. `out` y `env` permiten escribir fuera del tema (un proyecto que no se puede tocar).
export function paths(target, { out, env } = {}) {
    const root = out ? resolve(out) : join(target, 'specs', 'manual');
    return {
        root,
        env: env ? resolve(env) : join(target, '.env.manual'),
        datos: join(root, '_manual.md'),
        capturas: join(root, 'capturas'),
        mapa: join(root, 'capturas', 'mapa.json'),
        salida: join(root, 'salida'),
        borrador: (id) => join(root, `${id}.md`),
    };
}

const ENV_TEMPLATE = `# Credenciales para que wp-manual entre al admin del sitio LOCAL y tome las capturas.
# Usa un usuario del Local con el mismo rol que tendrá el cliente (por ejemplo Editor), nunca uno de producción.
# Este archivo no se sube a git (.gitignore) y conviene borrarlo al terminar el manual.
MANUAL_URL=
MANUAL_USER=
MANUAL_PASS=
# horizontal, vertical o ambos
MANUAL_FORMATO=ambos
# Opcional: partes de URL que no se cargan durante las capturas, separadas por comas (chat, analítica…).
# Los captchas (reCAPTCHA, hCaptcha, Turnstile) ya se reemplazan siempre por una respuesta vacía.
MANUAL_BLOQUEAR=
`;

export function readEnv(path) {
    if (!existsSync(path)) return null;
    const values = {};
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (m) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return values;
}

// Qué falta en .env.manual. Sin usuario o contraseña se puede seguir con el login a mano.
export function envState(path) {
    const values = readEnv(path);
    if (!values) return { exists: false, filled: false, manualLogin: false, missing: ['MANUAL_URL', 'MANUAL_USER', 'MANUAL_PASS'] };
    const missing = ['MANUAL_URL', 'MANUAL_USER', 'MANUAL_PASS'].filter((k) => !values[k]);
    const formato = FORMATOS.includes(values.MANUAL_FORMATO) ? values.MANUAL_FORMATO : 'ambos';
    return { exists: true, filled: missing.length === 0, manualLogin: Boolean(values.MANUAL_URL) && missing.length > 0, missing, url: values.MANUAL_URL || null, formato };
}

// Crea .env.manual vacío (nunca pisa uno existente).
export function createEnv(path) {
    if (existsSync(path)) return false;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, ENV_TEMPLATE);
    return true;
}

// Agrega una línea a .gitignore si no está. Devuelve true si la agregó.
export function ensureGitignore(target, line) {
    const path = join(target, '.gitignore');
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (text.split(/\r?\n/).some((l) => l.trim() === line)) return false;
    writeFileSync(path, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`);
    return true;
}

// _manual.md: datos de la portada y del login. La fecha es opcional: vacía, no se imprime.
const DATOS_LABELS = { cliente: 'Cliente', razon: 'Razón social', panel: 'Dirección del panel', fecha: 'Fecha' };
export function datosTemplate({ cliente = '', razon = '', panel = '', fecha = '' }) {
    return `# Manual de administración\n\nDatos de la portada y del login. Se pueden corregir a mano.\n\n${
        Object.entries(DATOS_LABELS).map(([key, label]) => `- **${label}:** ${{ cliente, razon, panel, fecha }[key]}`).join('\n')}\n`;
}
export function readDatos(path) {
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const out = {};
    for (const [key, label] of Object.entries(DATOS_LABELS)) out[key] = new RegExp(`^- \\*\\*${label}:\\*\\*[ \\t]*(.*)$`, 'm').exec(text)?.[1]?.trim() ?? '';
    return out;
}

// Patrones de URL a bloquear en las capturas: los de --bloquear y los de MANUAL_BLOQUEAR.
export const patronesBloqueo = (...listas) => listas.flatMap((l) => String(l ?? '').split(',')).map((x) => x.trim()).filter(Boolean);
