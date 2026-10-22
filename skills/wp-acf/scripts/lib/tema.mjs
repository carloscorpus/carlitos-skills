// GENERADO desde shared/tema.mjs por scripts/sync-shared.mjs. No editar aquí:
// edita el original y corre `node scripts/sync-shared.mjs`.

// Estado de un tema WordPress en una sola lectura: qué ya está hecho, para que un agente no lo averigüe
// explorando archivos. Solo lee; sin dependencias.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const text = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

// Archivos .php de inc/ (hasta dos niveles), sin leer vendor ni node_modules.
function incFiles(target) {
    const out = [];
    const walk = (dir, depth) => {
        if (!existsSync(dir)) return;
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) {
                if (depth < 2) walk(path, depth + 1);
            } else if (name.endsWith('.php')) {
                out.push(path);
            }
        }
    };
    walk(join(target, 'inc'), 0);
    return out;
}

// Señales de wp-vite-theme, los helpers de wp-helper y los bloques que cada skill dejó en CLAUDE.md.
export function detectTheme(target) {
    const has = (rel) => existsSync(join(target, rel));
    const vite = {
        frontPage: has('front-page.php'),
        pages: has('pages'),
        templateParts: has('template-parts'),
        enqueue: has('inc/enqueue.php'),
        viteConfig: has('vite.config.ts') || has('vite.config.js'),
    };

    const source = incFiles(target).map((path) => text(path)).join('\n');
    const helperFor = (suffix) => new RegExp(`function\\s+(\\w+?)_${suffix}\\s*\\(`).exec(source)?.[1] ?? null;
    const helpers = { images: helperFor('image'), links: helperFor('link'), text: helperFor('highlight') };
    const prefix = helpers.images ?? helpers.links ?? helpers.text;

    const claude = text(join(target, 'CLAUDE.md'));
    const blocks = [...claude.matchAll(/<!--\s*([\w-]+):start\s*-->/g)].map((m) => m[1]);

    return {
        isTheme: has('style.css') && has('functions.php'),
        viteTheme: Object.values(vite).every(Boolean),
        viteSigns: vite,
        prefix,
        helpers,
        claudeMd: has('CLAUDE.md'),
        blocks,
    };
}

// Estado del motor de wp-acf en el tema.
export function detectEngine(target) {
    const runner = text(join(target, 'inc/acf/runner.php'));
    const seedDir = join(target, 'inc/acf/seed');
    const jsonDir = join(target, 'acf-json');
    return {
        runner: runner !== '',
        version: /Versión del motor:\s*(\d+\.\d+\.\d+)/.exec(runner)?.[1] ?? null,
        requireLine: text(join(target, 'functions.php')).includes("inc/acf/runner.php"),
        sitio: existsSync(join(target, 'inc/acf/sitio.php')),
        paginas: existsSync(join(target, 'inc/acf/paginas.php')),
        seeds: existsSync(seedDir) ? readdirSync(seedDir).filter((f) => f.endsWith('.php')) : [],
        acfJson: existsSync(jsonDir) ? readdirSync(jsonDir).filter((f) => f.endsWith('.json')).length : 0,
    };
}
