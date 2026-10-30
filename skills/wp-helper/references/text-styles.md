# Text with parts in another color

`inc/helpers/text.php` prints `<prefix>_highlight($text, $only = null)`. The styles (marker + class) live in `inc/helpers/text-styles.php`.

## How a text is written

A marker is one character that encloses the part with the other color: `Negro |naranja| normal *rojo*`. Each style has its own marker, so one text can mix several styles. `$only` limits the call to one style by name.

The output is already escaped HTML (`<span class="…">`). It is for ACF `text` and `textarea` fields, not for WYSIWYG fields (those already carry HTML).

## Line breaks

A line break typed in a `textarea` (Enter) comes out as `<br>`, so the editor writes a title or paragraph of several lines in one field instead of one field per line: `Terminal Portuario` + Enter + `del |Callao|`. Use `<prefix>_highlight()` for every `textarea`, with or without colors. Leave the ACF field with `new_lines` empty: if ACF added the `<br />`, the helper would escape it and the code would show on the page.

## Markers

Allowed: `*  |  ~  ^  =` (one character, same at both ends). Up to 5 styles per project, never two with the same marker.

Not allowed: `& < > " '` (`esc_html` changes them), and `-  _  #  @  +  %  !` (they appear in normal text: hyphens, snake_case, hashtags, emails, prices).

A marker only works when it does not touch a letter or number on the outside, so `a|b|c` and `a=b=c` stay intact. The text inside cannot start or end with a space (`| a |` is not marked), and it stays on one line: a marker never crosses a line break. An unclosed marker is left as written.

## Adding a style

Ask the user: **name** (`naranja`), **marker** (one of the free ones from `install.mjs --list`) and **class** (from the design or the project's Tailwind tokens; never invent a color).

When the color is already in the design's code (another skill such as `wp-acf` or `design-import` finds a part with its own color class), do not ask: the class exactly as in the code, the name from the class without `text-` (`text-anaranjado` → `anaranjado`) and the first free marker of `install.mjs --list`.

```
node <skill>/scripts/install.mjs --add-style --name naranja --marker "|" --class text-anaranjado
```

It exits `1` and lists the free markers if the name or marker is already taken. The script writes one line per style in `text-styles.php` between `// wp-helper:styles:start` and `:end`, in a fixed format; a line it cannot read stops the script instead of being guessed. To change or remove a style, edit that single line, keeping the format.

## Tailwind

`text-styles.php` is PHP, so Tailwind's automatic class detection reads the class names. After adding a style, `pnpm build` and check the class is in the compiled CSS. If it is not (the folder is excluded), add the file to the main CSS: `@source "../../inc/helpers/text-styles.php";` (path relative to that CSS file).

## Colors

The helper marks the text with a class; it cannot check contrast. Confirm with the design that each style color has enough contrast (WCAG AA, 4.5:1 for normal text) on its background, and that the highlight is not the only way the text conveys meaning.


If the design needs a color that is not a Tailwind token, define it once in `@theme` (`--color-…`) and use the generated class (`text-…`). Do not put hex values in the helper.
