# One subagent per page

Use it when the design has more than three pages. With three or fewer, do it in the main thread: the briefing costs more than it saves.

## Order

1. **Main thread, serial:** analyze, `init.mjs`, register every page with `init.mjs --page`, and finish **stage A** (`_shared.md` and `specs/opciones.md` approved by the user). Subagents start only after that: if they run first, each one invents its own button.
2. **Subagents, parallel (stage B):** one per page, 3 or 4 at a time. Each writes **only** `specs/<slug>.md`.
3. **Main thread, serial:** review the specs together (duplicated sections across pages become components, field names do not clash: run `check.mjs`), then the user approves page by page.
4. **Stage C:** tokens and components first, in the main thread. Then each approved page can go to a subagent, which writes only `template-parts/pages/<slug>/` and its page template. The main thread runs `php -l`, `pnpm build` and `check.mjs` at the end.

## Rules for every subagent

- It edits one spec file (stage B) or one page folder and one template (stage C). Never `_index.md`, `_shared.md`, the main CSS or `functions.php`: those are shared and would be overwritten.
- If it finds something that belongs in `_shared.md` (a new color, a block that repeats across pages), it reports it in its answer instead of editing the file. The main thread decides.
- It reads the references itself; the brief below only points to them.

## Brief

> Stage B for the page `<slug>` of the design in `<design folder>`.
> Read `<skill>/references/formato-spec.md`, `campos-acf.md` and `acceptance.md`, the approved `specs/_shared.md` and `<design folder>/<source file>`. The inventory for this page is in `<analysis json>` (page `<source file>`).
> If the page is a list or detail, also read `references/contenido-dinamico.md` and the "Alcance" and "Contenido dinámico" tables of `_shared.md`; its `Tipo` and `Contenido` are already in the spec.
> Fill `specs/<slug>.md` (already created): the summary and one block per section. Use the tokens and components of `_shared.md`; sections that are forms, modals or accordions get `Skill:` and no markup. Edit only that file.
> Answer with: the sections you wrote, anything that should be shared (new tokens, repeated blocks), and anything you could not decide.

Replace the paths. Do not paste the whole inventory: point to the file.
