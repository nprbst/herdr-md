# Finally, markdown and the terminal done right

Run `mdh open README.md` and the file opens in a pane beside your shell in the
[Herdr](https://herdr.dev) desktop app, drawn natively: real heading sizes in
your theme's colors, body text in your terminal font. It works.

[NEED: video URL, 60s master]

## What you see

Tables render as bordered cards. Task lists get `✓` and `○`. GitHub
`> [!NOTE]` and `> [!WARNING]` callouts become cards. Code blocks get syntax
colors and a copy button. `$$…$$` display math is typeset by MathJax, and
inline `$…$` turns into Unicode (`ŷ = wᵀx + b`). Mermaid fences render as
diagrams in your theme's colors.

## How you read

A block cursor moves with `j` and `k`, takes counts like `5j`, and the view
glides to it. `za` folds a section (or click its heading). `o` pops up an
outline. `/` searches and `n`/`N` step through matches. Relative `.md` links
open in place; `Backspace` brings you back.

## When the file changes

Save the file and the pane reloads, glides to the first changed block and
marks every changed block in the gutter. `]` and `[` step through them; `c`
clears the marks. Close it, open it tomorrow, and the status line
reads "3 changed since you last looked."

## Bonus: works with AI

`mdh` is a small CLI your coding agent can run from its shell:

```sh
mdh hl plan.md --lines 40-52 --note "this step skips the cache"
```

The pane glides to those lines, tints them and puts the note underneath;
`n`/`N` steps through several. Going the other way, select blocks with `V`,
press `p` to pin them, and `mdh sel` gives the agent the file, the line range
and the source text.

## Requirements

- The Herdr desktop app. Built and tested on macOS only.
- Python 3 for `mdh`.
- For math and Mermaid: Node.js with npm. The first figure triggers a one-time
  `npm install` (about 400 MB with Mermaid's tooling), the mod's only network
  access. Mermaid also needs an installed Chrome, Chromium, Brave or Edge.
  Without them, figures show their source. Remote images are never fetched.

## Install

Ask your agent in Herdr:

> add the mod github.com/ryanthedev/herdr-md

Then link the CLI and open a file:

```sh
ln -s ~/.config/herdr-app/mods/herdr-md/mdh ~/.local/bin/mdh
mdh open README.md
```

Code and the manual install: https://github.com/ryanthedev/herdr-md
