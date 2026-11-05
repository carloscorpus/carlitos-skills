#!/usr/bin/env node
// Prueba de wp-vite-theme: la elección del PHP de Local para `php -l`. Sin dependencias: arma un Local falso en una carpeta temporal.
//
// Uso: node skills/wp-vite-theme/tests/check.mjs
// Sale 0 si todo pasa, 1 si algo falla.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findLocalPhp, findSite, securityInfo, securityWarning } from '../scripts/local-php.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'wp-vite-theme-'));
let passed = 0;
const test = (name, fn) => {
    try {
        fn();
        passed++;
        console.log(`ok   ${name}`);
    } catch (e) {
        console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
        process.exitCode = 1;
    }
};

let n = 0;
/** Local falso: `phps` = { 'php-8.2.27+1': ['win32', 'win64'] }, `sites` = { id: { name, path, php } }. */
function fakeLocal({ platform = 'win32', phps = {}, sites = null }) {
    const home = join(tmp, `home${n++}`);
    const appData = join(home, 'AppData', 'Roaming');
    const data = platform === 'win32' ? join(appData, 'Local')
        : platform === 'darwin' ? join(home, 'Library', 'Application Support', 'Local')
            : join(home, '.config', 'Local');
    for (const [folder, bins] of Object.entries(phps)) {
        for (const bin of bins) {
            const file = platform === 'win32' ? join(data, 'lightning-services', folder, 'bin', bin, 'php.exe')
                : join(data, 'lightning-services', folder, 'bin', bin, 'bin', 'php');
            mkdirSync(join(file, '..'), { recursive: true });
            writeFileSync(file, '');
        }
    }
    if (sites) {
        mkdirSync(data, { recursive: true });
        const json = Object.fromEntries(Object.entries(sites).map(([id, s]) => [id, {
            name: s.name, path: s.path, services: s.php ? { php: { name: 'php', version: s.php } } : {},
        }]));
        writeFileSync(join(data, 'sites.json'), JSON.stringify(json));
    }
    const theme = (site) => join(home, 'Local Sites', site, 'app', 'public', 'wp-content', 'themes', 'tema');
    return { home, appData, theme };
}

const noPath = () => null;
const run = (local, opts) => findLocalPhp({
    platform: 'win32', arch: 'x64', home: local.home, appData: local.appData, today: '2026-11-05', pathLookup: noPath, ...opts,
});

const PHPS = { 'php-8.2.27+1': ['win32', 'win64'], 'php-8.2.29+0': ['win64'], 'php-8.3.17+1': ['win64'], 'php-8.4.27+0': ['win64'] };

test('usa el PHP del sitio, aunque haya uno más nuevo', () => {
    const local = fakeLocal({ phps: PHPS, sites: { a: { name: 'Nerd', path: '~\\Local Sites\\nerd', php: '8.2.29' } } });
    const r = run(local, { theme: local.theme('nerd') });
    assert.equal(r.source, 'site');
    assert.equal(r.version, '8.2.29');
    assert.equal(r.site, 'Nerd');
});

test('en Windows encuentra las versiones que solo traen win64', () => {
    const local = fakeLocal({ phps: PHPS, sites: { a: { name: 'Lumenti', path: '~/Local Sites/lumenti', php: '8.4.27' } } });
    const r = run(local, { theme: local.theme('lumenti') });
    assert.equal(r.version, '8.4.27');
    assert.match(r.php, /[\\/]win64[\\/]php\.exe$/);
});

test('en Windows prefiere win64 cuando hay win32 y win64', () => {
    const local = fakeLocal({ phps: PHPS, sites: { a: { name: 'Viejo', path: '~/Local Sites/viejo', php: '8.2.27' } } });
    assert.match(run(local, { theme: local.theme('viejo') }).php, /[\\/]win64[\\/]php\.exe$/);
});

test('avisa si al PHP del sitio le quedan menos de 90 días de parches', () => {
    const local = fakeLocal({ phps: PHPS, sites: { a: { name: 'Nerd', path: '~/Local Sites/nerd', php: '8.2.29' } } });
    const r = run(local, { theme: local.theme('nerd') });
    assert.equal(r.securityUntil, '2026-12-31');
    assert.match(r.warning, /2026-12-31 \(faltan 56 días\)/);
});

test('sin aviso si la versión tiene parches por más tiempo', () => {
    const local = fakeLocal({ phps: PHPS, sites: { a: { name: 'Ese', path: '~/Local Sites/ese', php: '8.3.17' } } });
    assert.equal(run(local, { theme: local.theme('ese') }).warning, null);
});

test('tema fuera de Local: la versión más alta con parches, en su parche más nuevo', () => {
    const local = fakeLocal({ phps: { ...PHPS, 'php-8.4.20+0': ['win64'] }, sites: {} });
    const r = run(local, { theme: join(tmp, 'otro') });
    assert.equal(r.source, 'newest-supported');
    assert.equal(r.version, '8.4.27');
    assert.ok(r.notes.some((x) => /ningún sitio/.test(x)));
});

test('el PHP del sitio no está instalado: usa otro y lo explica', () => {
    const local = fakeLocal({ phps: PHPS, sites: { a: { name: 'Raro', path: '~/Local Sites/raro', php: '8.1.31' } } });
    const r = run(local, { theme: local.theme('raro') });
    assert.equal(r.source, 'newest-supported');
    assert.equal(r.version, '8.4.27');
    assert.ok(r.notes.some((x) => /8\.1\.31.*no está instalado/.test(x)));
});

test('la versión sin parches no gana al elegir sin sitio', () => {
    const local = fakeLocal({ phps: { 'php-8.1.31+0': ['win64'], 'php-8.2.29+0': ['win64'] } });
    assert.equal(run(local, { theme: join(tmp, 'x'), today: '2026-06-01' }).version, '8.2.29');
    assert.equal(run(local, { theme: join(tmp, 'x'), today: '2027-02-01' }).version, '8.2.29'); // ninguna con soporte: la más nueva
});

test('sitios con carpetas parecidas no se confunden', () => {
    const sites = { a: { name: 'Yamaha', path: '~/Local Sites/yamaha', php: '8.2.27' }, b: { name: 'Yamaha Blog', path: '~/Local Sites/yamaha-blog', php: '8.3.17' } };
    const local = fakeLocal({ phps: PHPS, sites });
    assert.equal(run(local, { theme: local.theme('yamaha-blog') }).site, 'Yamaha Blog');
});

test('en Windows el sitio se encuentra sin importar mayúsculas ni barras', () => {
    const site = findSite({ a: { name: 'S', path: 'C:\\Users\\Ana\\Local Sites\\s' } }, 'c:/users/ana/local sites/s/app/public', { platform: 'win32', home: 'C:\\Users\\Ana' });
    assert.equal(site?.name, 'S');
});

test('macOS: elige la carpeta de la arquitectura de la máquina', () => {
    const local = fakeLocal({ platform: 'darwin', phps: { 'php-8.3.17+0': ['darwin', 'darwin-arm64'] }, sites: { a: { name: 'M', path: '~/Local Sites/m', php: '8.3.17' } } });
    const r = findLocalPhp({ platform: 'darwin', arch: 'arm64', home: local.home, today: '2026-11-05', pathLookup: noPath, theme: local.theme('m') });
    assert.match(r.php, /darwin-arm64[\\/]bin[\\/]php$/);
});

test('Linux: encuentra el binario', () => {
    const local = fakeLocal({ platform: 'linux', phps: { 'php-8.3.17+0': ['linux'] }, sites: { a: { name: 'L', path: '~/Local Sites/l', php: '8.3.17' } } });
    const r = findLocalPhp({ platform: 'linux', arch: 'x64', home: local.home, today: '2026-11-05', pathLookup: noPath, theme: local.theme('l') });
    assert.equal(r.source, 'site');
});

test('sin Local: usa el php del PATH, y si no hay, nada', () => {
    const local = fakeLocal({});
    const conPath = run(local, { theme: join(tmp, 'x'), pathLookup: () => ({ php: 'php', version: '8.3.10' }) });
    assert.deepEqual([conPath.source, conPath.php, conPath.version], ['path', 'php', '8.3.10']);
    const sinNada = run(local, { theme: join(tmp, 'x') });
    assert.deepEqual([sinNada.source, sinNada.php], ['none', null]);
});

test('tabla de soporte: versiones viejas, vencidas y más nuevas que la tabla', () => {
    assert.equal(securityInfo('7.4.33', '2026-11-05').supported, false);
    assert.match(securityWarning('8.1.31', '2026-11-05'), /ya no recibe parches de seguridad desde el 2025-12-31/);
    assert.deepEqual(securityInfo('9.0.0', '2026-11-05'), { until: null, supported: true, known: false });
    assert.equal(securityWarning('9.0.0', '2026-11-05'), null);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', hubo fallas' : ''}.`);
