#!/usr/bin/env node
// Copia shared/*.mjs a skills/<skill>/scripts/lib/ de cada skill que tenga carpeta scripts/.
// Así cada skill es autosuficiente (funciona aunque se copie sola a otro agente) y el código
// común se edita en un solo lugar. Las copias se commitean.
//
// Uso:
//   node scripts/sync-shared.mjs          copia (crea o actualiza)
//   node scripts/sync-shared.mjs --check  no escribe; sale con 1 si alguna copia no coincide
//
// Sin dependencias.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharedDir = join(root, 'shared');
const skillsDir = join(root, 'skills');
const check = process.argv.includes('--check');

const header = (name) =>
    `// GENERADO desde shared/${name} por scripts/sync-shared.mjs. No editar aquí:\n` +
    `// edita el original y corre \`node scripts/sync-shared.mjs\`.\n\n`;

const lf = (text) => text.replace(/\r\n/g, '\n');

const sources = readdirSync(sharedDir).filter((name) => name.endsWith('.mjs'));
const skills = readdirSync(skillsDir).filter((name) => statSync(join(skillsDir, name)).isDirectory()
    && existsSync(join(skillsDir, name, 'scripts')));

const stale = [];
for (const skill of skills) {
    for (const name of sources) {
        const dest = join(skillsDir, skill, 'scripts', 'lib', name);
        const expected = header(name) + lf(readFileSync(join(sharedDir, name), 'utf8'));
        const current = existsSync(dest) ? lf(readFileSync(dest, 'utf8')) : null;
        if (current === expected) continue;
        stale.push(relative(root, dest).split('\\').join('/'));
        if (!check) {
            mkdirSync(dirname(dest), { recursive: true });
            writeFileSync(dest, expected);
        }
    }
}

if (check) {
    console.log(JSON.stringify({ ok: stale.length === 0, stale }, null, 2));
    process.exit(stale.length ? 1 : 0);
}
console.log(JSON.stringify({ ok: true, updated: stale, skills }, null, 2));
