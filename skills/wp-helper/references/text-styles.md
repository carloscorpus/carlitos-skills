# Text with parts in another color

`inc/helpers/text.php` prints `<prefix>_highlight($text, $only = null)`. The styles (marker + class) live in `inc/helpers/text-styles.php`.

## How a text is written

A marker is one character that encloses the part with the other color: `Negro |naranja| normal *rojo*`. Each style has its own marker, so one text can mix several styles. `$only` limits the call to one style by name.

The output is already escaped HTML (`<span class="…">`). It is for ACF `text` and `textarea` fields, not for WYSIWYG fields (those already carry HTML).

## Markers

Allowed: `*  |  ~  ^  =` (one character, same at both ends). Up to 5 styles per project, never two with the same marker.

Not allowed: `& < > " '` (`esc_html` changes them), and `-  _  #  @  +  %  !` (they appear in normal text: hyphens, snake_case, hashtags, emails, prices).

A marker only works when it does not touch a letter or number on the outside, so `a|b|c` and `a=b=c` stay intact. The text inside cannot start or end with a space (`| a |` is not marked), and it stays on one line. An unclosed marker is left as written.

## Adding a style

Ask the user: **name** (`naranja`), **marker** (one of the free ones from `install.mjs --list`) and **class** (from the design or the project's Tailwind tokens; never invent a color).

```
node <skill>/scripts/install.mjs --add-style --name naranja --marker "|" --class text-anaranjado
```

It exits `1` and lists the free markers if the name or marker is already taken. The script writes one line per style in `text-styles.php` between `// wp-helper:styles:start` and `:end`, in a fixed format; a line it cannot read stops the script instead of being guessed. To change or remove a style, edit that single line, keeping the format.

## Tailwind

`text-styles.php` is PHP, so Tailwind's automatic class detection reads the class names. After adding a style, `pnpm build` and check the class is in the compiled CSS. If it is not (the folder is excluded), add the file to the main CSS: `@source "../../inc/helpers/text-styles.php";` (path relative to that CSS file).

## Colors

If the design needs a color that is not a Tailwind token, define it once in `@theme` (`--color-…`) and use the generated class (`text-…`). Do not put hex values in the helper.
