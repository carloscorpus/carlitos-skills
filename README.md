<div align="center">
	<h1>carlitos-skills</h1>
	<p>Colección de skills para proyectos WordPress con Vite, JavaScript, Tailwind CSS y pnpm.</p>
	<p>
		<a href="https://wordpress.org/"><img src="https://img.shields.io/badge/WordPress-Local%20WP-21759B?style=flat-square&logo=wordpress&logoColor=white" alt="WordPress Local WP"></a>
		<a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-latest-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
		<a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind%20CSS-latest-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
		<a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-required-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm"></a>
	</p>
</div>

## Skills

| Skill | Qué hace |
|---|---|
| [`wp-vite-theme`](skills/wp-vite-theme/SKILL.md) | Crea la base de un tema WordPress (Local WP) con Vite, Tailwind y pnpm. |

## Instalación

### Claude Code (recomendado)

Una vez por PC, dentro de Claude Code:

```
/plugin marketplace add carloscorpus/carlitos-skills
/plugin install carlitos-skills@carlitos-skills
```

Para recibir skills nuevas o cambios:

```
/plugin marketplace update carlitos-skills
```

Las skills se invocan con el prefijo del plugin, por ejemplo `/carlitos-skills:wp-vite-theme`, o se activan solas al decir "nuevo tema wp".

### Otros agentes (CLI `skills`)

```bash
pnpm dlx skills@latest add carloscorpus/carlitos-skills -g
```

Usa `pnpm` porque el CLI lo declara en `devEngines`. Con npm/npx 11 puede aparecer `EBADDEVENGINES`.

## wp-vite-theme

Desde la carpeta del tema (`wp-content/themes/<slug>`), pide al agente `inicia tema`, `nuevo tema wp` o `scaffold theme`. Detecta el slug de la carpeta, pregunta los datos que falten y no sobrescribe archivos sin confirmación.

Genera:

```text
style.css, functions.php, header.php, footer.php, index.php
inc/{setup,enqueue,cleanup}.php
src/css/input.css, src/js/main.js
vite.config.ts, pnpm-workspace.yaml, package.json
```

- `pnpm dev`: inicia Vite y crea el indicador `hot`.
- `pnpm build`: genera `dist/manifest.json` y los assets finales.
- WordPress usa Vite en desarrollo y el manifest en producción.

**Despliegue:** ejecuta `pnpm build` con el servidor detenido. Publica `dist/` junto con los PHP modificados. No publiques `hot`, `node_modules/`, `src/` ni los archivos de configuración.

## Agregar una skill

1. Crea `skills/<nombre>/SKILL.md` (con `name` y `description` en el frontmatter).
2. Agrégala a la tabla de este README.
3. Sube `version` en `.claude-plugin/plugin.json`.
4. Haz commit y push; en cada PC, `/plugin marketplace update carlitos-skills`.

## Licencia

La licencia de este repositorio está pendiente de definir. Hasta que se publique un archivo `LICENSE`, no se concede permiso explícito para redistribuirlo.
