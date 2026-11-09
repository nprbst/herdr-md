Proposed top section for README.md: it replaces the current title, intro line,
preview image and feature bullets. Everything from `## Install` down stays.

---

# herdr-md

Finally, markdown and the terminal done right: a native markdown pane for the
[Herdr](https://herdr.dev) desktop app, drawn in your theme next to your shell.

https://github.com/user-attachments/assets/0da11259-cf8d-490e-943c-72fb9807540d

- **Reads like a real document.** Heading sizes and colors from your Herdr
  theme, your terminal font, tables, task lists, `> [!NOTE]` callouts, and code
  blocks with syntax colors and a copy button.
- **Math and diagrams in place.** MathJax typesets `$$…$$`, inline `$…$`
  becomes Unicode (`ŷ = wᵀx + b`), and ` ```mermaid ` fences render in your
  theme's colors.
- **Moves like vim.** A block cursor with counts (`5j`), smooth glide
  scrolling, folding (`za`), an outline (`o`), search (`/`), and `.md` links
  that open in place with `Backspace` to go back.
- **Shows what changed.** Save the file and the pane glides to the first
  edited block and marks each one in the gutter, even across sessions ("3
  changed since you last looked"). `]` / `[` step through them.
- **Bonus: works with AI.** herdr-md has APIs for AI to interact with and
  annotate the document: your agent runs `mdh hl FILE --lines 40-52 --note "…"`
  to highlight and annotate, and `mdh sel` reads the blocks you pinned with `V`
  then `p`.

## Quick install

Ask your agent in Herdr:

> add the mod github.com/ryanthedev/herdr-md

Then link the CLI and open a file:

```sh
ln -s ~/.config/herdr-app/mods/herdr-md/mdh ~/.local/bin/mdh
mdh open README.md
```

Requirements and the manual install are [below](#install).
