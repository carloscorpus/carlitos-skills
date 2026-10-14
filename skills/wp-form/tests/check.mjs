#!/usr/bin/env node
/*
 * Paridad front/back, lado JS (skill wp-form).
 * Corre tests/cases.json con el esquema Zod del tema y lo compara con lo esperado
 * y con el resultado de PHP (check.php). Sale con código 1 si algo no coincide.
 *
 * Uso:
 *   node <skill>/tests/check.mjs <carpeta del tema> forms-php.json
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [themeDir, phpFile] = process.argv.slice(2);
if (!themeDir || !phpFile) {
    console.error('Uso: node check.mjs <carpeta del tema> <salida de check.php>');
    process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));
const php = JSON.parse(readFileSync(resolve(phpFile), 'utf8'));
const { fieldSchema } = await import(pathToFileURL(join(resolve(themeDir), 'src/js/modules/form.js')).href);

let failures = 0;

spec.cases.forEach((testCase, i) => {
    const rule = php.rules[testCase.field];
    const value = testCase.repeat ? testCase.repeat[0].repeat(testCase.repeat[1]) : testCase.value;
    const result = fieldSchema(rule).safeParse(value);
    const jsError = result.success ? null : result.error.issues[0].message;
    const phpError = php.results[i];
    const expected = testCase.expect ? rule.messages[testCase.expect] : null;

    const ok = jsError === expected && phpError === expected;
    if (!ok) failures++;

    const shown = JSON.stringify(value).slice(0, 40);
    console.log(
        `${ok ? 'OK  ' : 'FAIL'} ${testCase.field.padEnd(10)} ${shown.padEnd(42)} ` +
            (ok ? (expected ?? 'válido') : `esperado: ${expected ?? 'válido'} | JS: ${jsError ?? 'válido'} | PHP: ${phpError ?? 'válido'}`),
    );
});

console.log(`\n${spec.cases.length - failures}/${spec.cases.length} casos iguales en JS, PHP y lo esperado.`);
process.exit(failures ? 1 : 0);
