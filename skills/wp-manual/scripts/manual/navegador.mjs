// playwright-core y el navegador. No se incluye en la skill: se toma del proyecto o de --playwright-from,
// y usa Edge o Chrome ya instalados (nunca descarga navegadores). Ver references/capturas.md.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Busca playwright-core en las carpetas dadas (en orden). Devuelve { module, from } o null.
export async function findPlaywright(dirs) {
    for (const dir of dirs.filter(Boolean)) {
        if (!existsSync(join(dir, 'package.json')) && !existsSync(join(dir, 'node_modules'))) continue;
        try {
            const require = createRequire(join(dir, 'package.json'));
            const path = require.resolve('playwright-core');
            return { module: await import(pathToFileURL(path).href), from: dir };
        } catch { /* sigue con la próxima carpeta */ }
    }
    return null;
}

// Comando para instalarlo, según el gestor de paquetes de la carpeta.
export function installCommand(dir) {
    if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm add -D playwright-core';
    if (existsSync(join(dir, 'yarn.lock'))) return 'yarn add -D playwright-core';
    return 'npm install --save-dev playwright-core';
}

// Abre Edge o, si no está, Chrome. `headless: false` para el login a mano.
export async function launch(pw, { headless = true } = {}) {
    const errors = [];
    for (const channel of ['msedge', 'chrome']) {
        try {
            return { browser: await pw.chromium.launch({ channel, headless }), channel };
        } catch (e) { errors.push(`${channel}: ${e.message.split('\n')[0]}`); }
    }
    const err = new Error(`No se encontró Edge ni Chrome instalados. ${errors.join(' | ')}`);
    err.code = 'SIN_NAVEGADOR';
    throw err;
}
