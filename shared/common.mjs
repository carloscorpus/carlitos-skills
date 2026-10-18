// Código común de las skills. Sin dependencias.
//
// ORIGINAL: shared/common.mjs. Cada skill lleva su copia en skills/<skill>/scripts/lib/common.mjs
// (así funciona aunque se copie sola a otro agente). Edita solo este archivo y corre
// `node scripts/sync-shared.mjs`; `--check` verifica que las copias coincidan.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, relative, sep } from 'node:path';

// ---------- Salida y argumentos ----------

// Escribe un JSON de error y sale. Códigos de las skills: 1 uso/validación, 2 conflictos sin
// resolver, 3 placeholders sin reemplazar (más los propios de cada skill).
export function fail(code, error, extra = {}) {
    console.log(JSON.stringify({ ok: false, error, ...extra }, null, 2));
    process.exit(code);
}

// "a, b\c" -> ['a', 'b/c'] (para --overwrite / --skip).
export function toList(value) {
    return (value ?? '').split(',').map((s) => s.trim().replaceAll('\\', '/')).filter(Boolean);
}

// ---------- Tema: slug y prefijo ----------

// Debe empezar con letra: el prefijo PHP sale del slug y una función no puede empezar con número.
export function assertSlug(slug) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug)) {
        fail(1, `Slug inválido "${slug}": usa minúsculas, números y guiones, y empieza con una letra.`);
    }
}

export function slugFromTarget(target, explicit) {
    const slug = explicit ?? basename(target);
    assertSlug(slug);
    return slug;
}

export const prefixFromSlug = (slug) => slug.replaceAll('-', '_');

// ---------- Versión de la skill ----------

// Lee `metadata.version` del frontmatter de SKILL.md (fuente única de la versión de la skill).
export function skillVersion(skillDir) {
    const path = join(skillDir, 'SKILL.md');
    const front = existsSync(path) ? /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, 'utf8'))?.[1] : null;
    const version = front && /^[ \t]+version:[ \t]*["']?(\d+\.\d+\.\d+)["']?[ \t]*$/m.exec(front)?.[1];
    if (!version) fail(1, `SKILL.md sin metadata.version en ${skillDir}.`);
    return version;
}

// ---------- Plantillas ----------

export function listFiles(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}

const PLACEHOLDER = /\{\{([A-Z_]+)\}\}/g;

export const renderString = (text, values) => text.replace(PLACEHOLDER, (match, key) => values[key] ?? match);

// Render en memoria: nada se escribe hasta validar todo. `filter` (opcional) recibe cada archivo.
export function renderTemplates(templatesDir, values, target, filter = () => true) {
    return listFiles(templatesDir)
        .map((source) => {
            const rel = relative(templatesDir, source).split(sep).join('/').replace(/\.tpl$/, '');
            let content = readFileSync(source, 'utf8');
            if (source.endsWith('.tpl')) content = renderString(content, values);
            return { rel, dest: join(target, rel), content };
        })
        .filter(filter);
}

// `files` puede traer cualquier objeto con { rel, content } (archivos o bloques).
export function assertNoLeftovers(files) {
    const leftovers = files.filter((f) => new RegExp(PLACEHOLDER.source).test(f.content)).map((f) => f.rel);
    if (leftovers.length) fail(3, 'Quedaron placeholders sin reemplazar.', { leftovers });
}

// ---------- Conflictos (--overwrite / --skip) ----------

// `skipIdentical`: un archivo idéntico al que se instalaría no es conflicto (se omite en silencio).
export function planFiles(files, { overwrite, skip }, { skipIdentical = false } = {}) {
    const overwriteSet = new Set(toList(overwrite));
    const skipSet = new Set(toList(skip));
    const existing = files.filter((f) => existsSync(f.dest));
    const unchanged = skipIdentical
        ? existing.filter((f) => readFileSync(f.dest, 'utf8') === f.content).map((f) => f.rel)
        : [];
    const conflicts = existing.map((f) => f.rel).filter((rel) => !unchanged.includes(rel));
    return {
        overwrite: overwriteSet,
        skip: skipSet,
        unchanged,
        conflicts,
        create: files.filter((f) => !existsSync(f.dest)).map((f) => f.rel),
        unknown: [...overwriteSet, ...skipSet].filter((rel) => !conflicts.includes(rel)),
        unresolved: conflicts.filter((rel) => !overwriteSet.has(rel) && !skipSet.has(rel)),
    };
}

// Debe llamarse después del --dry-run: este corte (códigos 1 y 2) solo aplica al escribir.
export function assertResolved(plan, report, message) {
    if (plan.unknown.length) fail(1, 'Archivos en --overwrite/--skip que no son conflictos.', { unknown: plan.unknown });
    if (plan.unresolved.length) fail(2, message, { ...report, unresolved: plan.unresolved });
}

export function writeFiles(files, plan) {
    const written = [];
    for (const file of files) {
        if (plan.skip.has(file.rel) || plan.unchanged.includes(file.rel)) continue;
        mkdirSync(dirname(file.dest), { recursive: true });
        writeFileSync(file.dest, file.content);
        written.push(file.rel);
    }
    return written;
}

// ---------- Editar archivos del tema ----------

// Edición idempotente que respeta el salto de línea del archivo (LF o CRLF).
export function patchFile(path, update) {
    const original = readFileSync(path, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    writeFileSync(path, update(original.replace(/\r\n/g, '\n')).replace(/\n/g, eol));
}

// ---------- Bloque de una skill en CLAUDE.md ----------

// Cada skill mantiene su bloque corto entre marcas `<!-- <id>:start -->` / `<!-- <id>:end -->`.
// Idempotente: si ya existe se reemplaza solo ese bloque; si no, se agrega al final. No toca el resto.
// Devuelve { status: 'added' | 'updated' | 'unchanged' | 'missing', write() }. Si el archivo no existe
// no lo crea ('missing'): CLAUDE.md es del proyecto, no de la skill.
export function claudeBlock(path, id, body) {
    if (!existsSync(path)) return { status: 'missing', write() {} };

    const original = readFileSync(path, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const text = original.replace(/\r\n/g, '\n');
    const start = `<!-- ${id}:start -->`;
    const end = `<!-- ${id}:end -->`;
    const block = `${start}\n${body.trim()}\n${end}`;
    const existing = new RegExp(`${start}[\\s\\S]*?${end}`);

    const next = existing.test(text) ? text.replace(existing, () => block) : text.replace(/\n*$/, '\n\n') + block + '\n';
    const status = next === text ? 'unchanged' : existing.test(text) ? 'updated' : 'added';
    return { status, write: () => writeFileSync(path, next.replace(/\n/g, eol)) };
}

// ---------- Vite: configuración y JS de entrada ----------

const VITE_CONFIGS = ['ts', 'mts', 'js', 'mjs', 'cts', 'cjs'].map((ext) => `vite.config.${ext}`);

export function findViteConfig(target) {
    return VITE_CONFIGS.find((rel) => existsSync(join(target, rel))) ?? null;
}

// Busca el JS principal que Vite empaqueta: las rutas .js/.ts que nombra vite.config.* y existen
// en el tema. Con varias, prefiere main/app/index/theme. Devuelve { entry, candidates }; `entry`
// es null si no hay una sola respuesta clara (entonces se pide la ruta al usuario).
export function detectJsEntry(target) {
    const config = findViteConfig(target);
    const text = config ? readFileSync(join(target, config), 'utf8') : '';
    const found = [...text.matchAll(/['"`]((?:[\w.-]+\/)*[\w.-]+\.(?:[mc]?[jt]sx?))['"`]/g)]
        .map((m) => posix.normalize(m[1]))
        .filter((rel) => rel !== config && !rel.endsWith('.d.ts') && statExists(join(target, rel)));
    const candidates = [...new Set(found)];

    if (candidates.length === 1) return { entry: candidates[0], candidates };
    const named = candidates.filter((rel) => /^(main|app|index|theme)\./.test(posix.basename(rel)));
    if (named.length === 1) return { entry: named[0], candidates };
    if (!candidates.length && statExists(join(target, 'src/js/main.js'))) {
        return { entry: 'src/js/main.js', candidates };
    }
    return { entry: null, candidates };
}

function statExists(path) {
    return existsSync(path) && statSync(path).isFile();
}

// Ruta para `import('...')` desde el archivo `from` hacia `to` (ambas relativas a la raíz del tema).
export function relativeImport(from, to) {
    const rel = posix.relative(posix.dirname(from), to);
    return rel.startsWith('.') ? rel : `./${rel}`;
}
