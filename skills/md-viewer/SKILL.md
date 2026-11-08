---
name: md-viewer
description: Show a markdown file to the user in the Herdr desktop app's native viewer pane and point at parts of it — highlight lines or a quoted passage, attach a short note, scroll there — and read back what the user selected in it. Use when walking the user through a .md file (README, plan, spec, notes, docs), answering "where does it say X", reviewing a markdown doc together, when the user asks to open, show, or highlight markdown, or when they refer to "this" / "what I selected" in the viewer. Not for code files or non-markdown text.
---

# md-viewer

The Herdr desktop app has a native markdown viewer pane (mod `herdr-md`,
`~/.config/herdr-app/mods/herdr-md/`). Drive it with `mdh`:

```sh
mdh open FILE                                   # viewer pane to the right of the focused pane (--down for below)
mdh hl FILE --lines 40-52 --note "why this matters"
mdh hl FILE --text "an exact phrase from the doc" --note "..." --color green
mdh hl FILE --lines 90 --add --color red        # --add keeps earlier highlights; default replaces them
mdh focus FILE 2                                # scroll to highlight 2
mdh clear FILE
mdh show FILE                                   # current highlights as JSON
```

- **Open first** if the user isn't already looking at the file (`mdh open`), then highlight. A viewer
  already showing the file updates live: it tints the matching blocks, puts the note under the last one,
  and scrolls to the newest highlight.
- **Lines** are 1-based source lines; highlights snap to whole blocks (paragraph, heading, list item,
  table, code block). **`--text`** matches the first block containing the phrase (whitespace- and
  case-insensitive) — use it when line numbers may drift.
- **Notes** are markdown, one or two sentences. Colors: yellow (default), green, red, blue, purple, cyan.
- **Several points:** first `hl` without `--add`, the rest with `--add`, so they number 1, 2, 3; the
  user steps through them with `n` / `N` in the viewer.
- Pass FILE as an absolute path, or relative to your current directory; it must be the same file the
  viewer shows.
- **The person can point back.** In the viewer they select blocks (`V`, `j`/`k`) and press `p`;
  the selection turns blue and is labeled "Pinned for Claude". When they say "this", "what I selected", "the part I highlighted" or
  similar, run `mdh sel` first: it prints `{file, lines, text}` of their last selection.
- State lives in `~/.cache/herdr-md/`. The viewer only reads files on this Mac.
