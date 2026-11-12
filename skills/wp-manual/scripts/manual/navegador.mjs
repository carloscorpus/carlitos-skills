// playwright-core y el navegador. No se incluye en la skill: se toma del proyecto o de --playwright-from,
// y usa Edge o Chrome ya instalados (nunca descarga navegadores). Ver references/capturas.md.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Busca playwright-core en las carpetas dadas (en orden). Devuelve { module, from } o null.
// playwright-core se resuelve a su index.js (CommonJS): al importarlo desde ESM solo trae `default`,
// así que se normaliza para que `module.chromium` exista siempre.
export async function findPlaywright(dirs) {
    for (const dir of dirs.filter(Boolean)) {
        if (!existsSync(join(dir, 'package.json')) && !existsSync(join(dir, 'node_modules'))) continue;
        try {
            const require = createRequire(join(dir, 'package.json'));
            const path = require.resolve('playwright-core');
            const mod = await import(pathToFileURL(path).href);
            return { module: mod.chromium ? mod : mod.default, from: dir };
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

// Captchas: mantienen la red ocupada (networkidle no llega) y su sello ensucia las capturas.
export const CAPTCHAS = ['google.com/recaptcha', 'gstatic.com/recaptcha', 'recaptcha.net', 'hcaptcha.com', 'challenges.cloudflare.com'];

// Solo lectura: lo que no sea GET (salvo el login) recibe un 403 local, así nunca llega al servidor y
// Playwright lo da por terminado (con abort() algunas esperas de 'networkidle' se quedaban colgadas).
// Los captchas y los patrones de `bloquear` (fragmentos de URL) reciben una respuesta vacía.
export async function soloLectura(context, { bloquear = [] } = {}) {
    const vacios = [...CAPTCHAS, ...bloquear.filter(Boolean)];
    await context.route('**/*', (route) => {
        const req = route.request();
        const url = req.url();
        if (req.method() !== 'GET' && !url.includes('wp-login.php')) return route.fulfill({ status: 403, contentType: 'text/plain', body: 'bloqueado (solo lectura)' });
        if (vacios.some((p) => url.includes(p))) {
            const js = req.resourceType() === 'script';
            return route.fulfill({ status: 200, contentType: js ? 'text/javascript' : 'text/plain', body: '' });
        }
        return route.continue();
    });
}

// Abre una URL y espera a que la red se calme, sin fallar si no se calma (sitios con conexiones abiertas).
export async function ir(page, url, { idle = 10_000 } = {}) {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: idle }).catch(() => {});
}
