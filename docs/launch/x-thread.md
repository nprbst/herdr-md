# X thread (4 posts)

Counts are X-weighted (each URL counts 23), measured by script. The `[Attach]`
line is not posted.

## 1/4

[Attach: `~/Movies/herdr-md-launch/herdr-md-short.mp4` as a native upload so it autoplays.]

Finally, markdown and the terminal done right.

herdr-md opens a .md file in a native pane beside your shell in Herdr: real heading sizes in your theme's colors, tables, callouts, code with a copy button, typeset math, Mermaid.

It works.

*238 / 280 weighted characters*

## 2/4

Read it like vim. A block cursor, j/k with counts, smooth glide scrolling. za folds, o opens an outline, / searches. Relative links open in place; Backspace goes back.

Edit the file and every changed block gets a gutter mark. ] and [ step through them.

*253 / 280 weighted characters*

## 3/4

Bonus: it has APIs for AI to interact with and annotate the document.

Your agent runs mdh hl plan.md --note "…" and the pane glides there and shows the note.

Pin blocks with V and p, and mdh sel hands the agent the exact lines.

*229 / 280 weighted characters*

## 4/4

Install: in Herdr, ask your agent to "add the mod github.com/ryanthedev/herdr-md", then
ln -s ~/.config/herdr-app/mods/herdr-md/mdh ~/.local/bin/mdh

macOS. Try it and tell me what breaks.

https://github.com/ryanthedev/herdr-md

*206 / 280 weighted characters*
