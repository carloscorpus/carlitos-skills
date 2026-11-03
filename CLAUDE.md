# carlitos-skills

Plugin de Claude Code con skills para temas WordPress. Cada skill vive en `skills/<nombre>/`.

## Al cambiar una skill (siempre, en el mismo PR)

1. Sube `metadata.version` en `skills/<nombre>/SKILL.md` (semver: corrección = parche, algo nuevo = menor).
2. Anótalo en `skills/<nombre>/CHANGELOG.md` con el detalle.
3. Anótalo también en el `CHANGELOG.md` de la raíz: una entrada nueva del plugin con una línea por skill (`` `<skill>` x.y.z: qué cambia. Detalle en `skills/<skill>/CHANGELOG.md`. ``).
4. Sube `version` en `.claude-plugin/plugin.json` a la misma versión de esa entrada. Sin esto, los otros proyectos no reciben la actualización.
5. Actualiza la versión de la skill en la tabla del `README.md`.

## Antes del commit

- Corre las pruebas de cada skill que cambió: `node skills/<nombre>/tests/check.mjs`.
- `scripts/lib/` de cada skill es una copia: lo común se edita en `shared/` y se copia con `node scripts/sync-shared.mjs`. `node scripts/sync-shared.mjs --check` debe salir con `0`.

El resto de las reglas para agregar una skill están en "Agregar una skill" del `README.md`.
