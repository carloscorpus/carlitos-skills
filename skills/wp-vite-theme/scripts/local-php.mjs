#!/usr/bin/env node
// Elige el PHP para `php -l`: el mismo que usa el sitio de Local donde está el tema. Sin dependencias.
//
// Uso:
//   node local-php.mjs [--theme <dir>]
//
// Sale con JSON en stdout (código 0; 1 solo si los argumentos son inválidos):
//   php            ruta del binario, o null si no hay ninguno (saltar el lint)
//   version        versión de ese PHP (8.2.29)
//   source         "site" (el del sitio), "newest-supported" (no se halló el sitio o su PHP),
//                  "path" (el `php` del PATH, sin Local) o "none"
//   site           nombre del sitio en Local, o null
//   securityUntil  fin de los parches de seguridad de esa versión (AAAA-MM-DD), o null si no se conoce
//   warning        aviso si esa versión ya no tiene parches o le quedan menos de 90 días
//   notes          lo que no salió como se esperaba (sitio no hallado, PHP del sitio no instalado...)

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Fin de los parches de seguridad por versión, según https://www.php.net/supported-versions.php
// (cada versión los recibe hasta el 31 de diciembre de su cuarto año). Al salir una versión nueva, agrégala.
export const SECURITY_UNTIL = {
    '8.0': '2023-11-26',
    '8.1': '2025-12-31',
    '8.2': '2026-12-31',
    '8.3': '2027-12-31',
    '8.4': '2028-12-31',
    '8.5': '2029-12-31',
};

const WARN_DAYS = 90;

/** Carpeta de datos de Local según el sistema. */
export function localDataDir(platform, home, appData) {
    if (platform === 'win32') return join(appData ?? join(home, 'AppData', 'Roaming'), 'Local');
    if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'Local');
    return join(home, '.config', 'Local');
}

const parseVersion = (text) => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(text ?? '');
    return m ? m.slice(1, 4).map(Number) : null;
};

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Cuándo deja de tener parches de seguridad. `known: false` si la tabla no la conoce. */
export function securityInfo(version, today) {
    const v = parseVersion(version);
    if (!v) return { until: null, supported: false, known: false };
    const minor = `${v[0]}.${v[1]}`;
    const until = SECURITY_UNTIL[minor];
    if (until) return { until, supported: until >= today, known: true };
    // Más nueva que la tabla: se asume con soporte. Más vieja: sin soporte.
    const newest = Object.keys(SECURITY_UNTIL).map((k) => k.split('.').map(Number)).sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
    const newer = v[0] > newest[0] || (v[0] === newest[0] && v[1] > newest[1]);
    return { until: null, supported: newer, known: false };
}

export function securityWarning(version, today) {
    const info = securityInfo(version, today);
    if (!info.known) {
        return info.supported
            ? null
            : `PHP ${version} ya no recibe parches de seguridad. Conviene subir la versión del sitio en Local y en el hosting.`;
    }
    if (!info.supported) {
        return `PHP ${version} ya no recibe parches de seguridad desde el ${info.until}. Conviene subir la versión del sitio en Local y en el hosting.`;
    }
    const days = Math.round((Date.parse(info.until) - Date.parse(today)) / 86400000);
    if (days <= WARN_DAYS) {
        return `PHP ${version} deja de recibir parches de seguridad el ${info.until} (faltan ${days} días). Conviene subir la versión del sitio en Local y en el hosting.`;
    }
    return null;
}

const norm = (p, platform) => {
    const s = p.replace(/[\\/]+/g, '/').replace(/\/$/, '');
    return platform === 'win32' ? s.toLowerCase() : s;
};

const expandHome = (p, home) => (/^~(?=$|[\\/])/.test(p) ? join(home, p.slice(1)) : p);

/** El sitio de Local cuya carpeta contiene el tema. */
export function findSite(sites, theme, { platform, home }) {
    const target = norm(theme, platform);
    let best = null;
    for (const site of Object.values(sites ?? {})) {
        if (!site?.path) continue;
        const root = norm(expandHome(site.path, home), platform);
        if (target === root || target.startsWith(`${root}/`)) {
            if (!best || root.length > best.root.length) best = { root, site };
        }
    }
    return best?.site ?? null;
}

/** PHP instalados en Local: [{ version, build, php }], del más nuevo al más viejo. */
export function installedPhps(dataDir, { platform, arch }) {
    const services = join(dataDir, 'lightning-services');
    if (!existsSync(services)) return [];
    const found = [];
    for (const name of readdirSync(services)) {
        const m = /^php-(\d+\.\d+\.\d+)(?:\+(\d+))?$/.exec(name);
        if (!m) continue;
        const php = phpBinary(join(services, name, 'bin'), { platform, arch });
        if (php) found.push({ version: m[1], build: Number(m[2] ?? 0), php });
    }
    return found.sort((a, b) => compare(parseVersion(b.version), parseVersion(a.version)) || b.build - a.build);
}

/** Binario dentro de `bin/`. En Windows, `win64` antes que `win32` (las versiones nuevas solo traen `win64`). */
export function phpBinary(binDir, { platform, arch }) {
    if (!existsSync(binDir)) return null;
    const dirs = readdirSync(binDir);
    let candidates;
    if (platform === 'win32') {
        candidates = ['win64', 'win32'].filter((d) => dirs.includes(d)).map((d) => join(binDir, d, 'php.exe'));
    } else {
        const prefix = platform === 'darwin' ? 'darwin' : 'linux';
        const own = dirs.filter((d) => d.startsWith(prefix));
        // Primero la carpeta de la arquitectura de esta máquina (darwin-arm64), luego las demás.
        own.sort((a, b) => Number(b.includes(arch)) - Number(a.includes(arch)));
        candidates = own.map((d) => join(binDir, d, 'bin', 'php'));
    }
    return candidates.find((p) => existsSync(p)) ?? null;
}

function pathPhp() {
    const r = spawnSync('php', ['-r', 'echo PHP_VERSION;'], { encoding: 'utf8' });
    return r.status === 0 && parseVersion(r.stdout) ? { php: 'php', version: r.stdout.trim() } : null;
}

export function findLocalPhp({
    theme = process.cwd(),
    platform = process.platform,
    arch = process.arch,
    home = homedir(),
    appData = process.env.APPDATA,
    today = new Date().toISOString().slice(0, 10),
    pathLookup = pathPhp,
} = {}) {
    const notes = [];
    const dataDir = localDataDir(platform, home, appData);
    let themePath = resolve(theme);
    try { themePath = realpathSync(themePath); } catch { /* se usa tal cual */ }

    let sites = null;
    const sitesFile = join(dataDir, 'sites.json');
    if (existsSync(sitesFile)) {
        try { sites = JSON.parse(readFileSync(sitesFile, 'utf8')); } catch { notes.push(`No se pudo leer ${sitesFile}.`); }
    }

    const installed = installedPhps(dataDir, { platform, arch });
    const site = sites ? findSite(sites, themePath, { platform, home }) : null;
    const done = (pick, source) => ({
        php: pick?.php ?? null,
        version: pick?.version ?? null,
        source,
        site: site?.name ?? null,
        securityUntil: pick ? securityInfo(pick.version, today).until : null,
        warning: pick ? securityWarning(pick.version, today) : null,
        notes,
    });

    if (site) {
        const wanted = site.services?.php?.version;
        const pick = installed.find((p) => p.version === wanted);
        if (pick) return done(pick, 'site');
        notes.push(wanted
            ? `El sitio "${site.name}" usa PHP ${wanted}, pero no está instalado en Local.`
            : `El sitio "${site.name}" no dice qué PHP usa.`);
    } else if (sites) {
        notes.push('El tema no está dentro de ningún sitio de Local.');
    }

    if (installed.length) {
        // La versión más alta con parches de seguridad, en su parche más nuevo.
        const pick = installed.find((p) => securityInfo(p.version, today).supported) ?? installed[0];
        if (!securityInfo(pick.version, today).supported) notes.push('Ningún PHP instalado en Local recibe parches de seguridad.');
        return done(pick, 'newest-supported');
    }

    const fromPath = pathLookup();
    if (fromPath) return done(fromPath, 'path');
    notes.push('No hay PHP de Local ni `php` en el PATH.');
    return done(null, 'none');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let args;
    try {
        ({ values: args } = parseArgs({ options: { theme: { type: 'string', default: process.cwd() } } }));
    } catch (e) {
        console.log(JSON.stringify({ error: e.message }));
        process.exit(1);
    }
    console.log(JSON.stringify(findLocalPhp({ theme: args.theme }), null, 2));
}
