# Destination: any other project

Use this when the theme is not a wp-vite-theme project. The goal is to place the design where the project already puts such things, not to impose the wp-vite-theme layout.

## Read the project first

1. `package.json` and the lockfile: package manager, framework, CSS tool (Tailwind, Sass, plain CSS), bundler.
2. Top-level folders and the theme's `functions.php`: where views, partials, components, CSS and JS live; how assets are enqueued.
3. Existing naming: file names, function prefix, text domain, CSS class convention (BEM, utility classes).
4. Any `CLAUDE.md`, `README` or contributing notes.

## Decide the mapping

Fill this table from what you found; leave a cell empty if the project has no such place.

| Piece | Where it goes in this project |
|---|---|
| Page templates | |
| Sections of one page | |
| Shared components | |
| Header / footer | |
| Tokens (colors, fonts, sizes) | |
| Images / fonts | |
| JS behavior | |

## Ask once

Show the table to the user in one message (AskUserQuestion when available) with a recommendation for each empty or doubtful cell, and wait for approval. Write the approved table at the top of `specs/_shared.md` under "Destino" so every later step and every subagent reads the same mapping. Do not ask again per page.

## Then

Follow the same flow as `SKILL.md`. The rules in `destino-wp-vite-theme.md` that do not depend on the layout still apply: roles in token names, exact values only, escaped output, one `h1`, no inline styles or handlers. If the project turns out to be a stable layout you will meet again, say so: it deserves its own `destino-<name>.md`.
