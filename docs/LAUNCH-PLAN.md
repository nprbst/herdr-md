# herdr-md launch plan

Drafted 2026-11-07 by Claude (Opus 5.5) with a second opinion from Codex
(gpt-6-astra), plus a scan of existing Claude Code demo-video skills.

**The pitch (the owner's words):** "Finally, markdown and the terminal done
right. It works. Bonus: works with AI." Sell the viewer first: rendering,
vim-style reading, folding, outline, links, search, math, Mermaid, change
marks. The agent features (`mdh hl`, pins, `mdh sel`) are the bonus beat at
the end of every piece. (Revised 2026-11-08; the first version opened on the
agent, and the owner rejected it.)

## Deliverables

| Artifact | Spec |
|---|---|
| **Master video** | 60s, 16:9, H.264 MP4, 60fps. For the herdr.dev listing, README and launch post. |
| **Short cut** | ~24s, square (or 9:16): render → outline → math → Mermaid → edit marks → bonus highlight → CTA. For X. |
| **Launch post** | `docs/launch/post.md`, ~350 words: what you see → how you read → when the file changes → bonus: works with AI → requirements → install. |
| **X thread** | `docs/launch/x-thread.md`, 4 posts: square short + the owner's line → reading keys and change marks → bonus AI → install + repo (one ask). |
| **README hero** | `docs/launch/readme-hero.md`, applied to README.md without the video link (add it once the video is hosted). |
| **herdr.dev listing** | Comes from the repo (`herdr-mod` topic, `preview.png`). Refresh `preview.png` with a product-first frame (the tour's top: headings, callout, tasks, table). |

**Claims, each backed by footage:**
1. **It reads like a document:** theme colors, real heading sizes, tables, callouts, code with a copy button, typeset math, Mermaid.
2. **It moves like vim:** block cursor, glide scrolling, outline, folding, search, links with `Backspace`.
3. **It shows what changed:** an edit on disk glides to the first changed block, marks each one, `]`/`[` step.
4. **Bonus, it works with AI:** `mdh hl` points, `V`…`p` pins back, `mdh sel` reads it.

Keep competitor comparisons and star counts out of the copy; let the demo make the distinction.

## Recording: fully scripted, re-shootable

- **Capture:** theGrid's recorder (`thegrid` MCP: `grid_record_start`/`grid_record_stop`) on a fixed **1600×900** Herdr window, Retina, 60fps; ~40% Claude pane / 60% viewer; Herdr zoom ~1.25; check legibility at phone size. Hide notifications and unrelated chrome; park the pointer after clicks.
- **Driving:** a shell script issues `mdh` commands and theGrid key presses (`input_key_press`) with fixed pauses; Claude-typed commands are rehearsed, and waits for model latency are trimmed in the edit. Never speed up the glide (560ms), note typing or selection.
- **Take setup (every take):** `scripts/take-setup.sh` (no key presses). It closes the viewer the last take opened, copies `demo/` to `/tmp/herdr-md-take/demo/`, puts the baseline and the edited snapshot (`scripts/take/tour-after.md`) beside it outside the watched folder, deletes the file's highlights, its seen-hashes (or the open says "changed since you last looked") and the pinned selection, then `mdh open`s the file and waits for the render. Focus the left (agent) pane first: the viewer splits to its right.
- **Driving:** `scripts/drive-take.sh [--cut master|short] [--shell TERMINAL]` presses keys through the theGrid CLI (`thegrid input`) with fixed pauses and logs beat start times to `/tmp/herdr-md-take/beats.tsv` for captions. `--shell T` pastes the `mdh`/`cp` commands into a visible shell terminal (`hc send`); without it they run off camera. `--dry-run` prints every step and the simulated beat times (master ends at ~55s of pauses, short at ~24s).
- **The edited snapshot** changes exactly three task-list items: "Render markdown natively" → "Read markdown in Herdr"; "Let the agent highlight passages" → "Follow agent highlights"; "[ ] Take over the world" → "[x] Review only changed blocks". Rehearsed 2026-11-08: "3 changed", three gutter marks, and the view glides there even right after a highlight.
- **Post:** ffmpeg for assembly, keyframed crop/zoom-ins on the active region (the driver logs timestamps and window bounds), lower-third captions per beat, speed ramps only on idle stretches. `/brag` (Hyperframes) for the title and end cards only. Remotion is unnecessary.

- **As recorded (2026-11-08):** the Herdr window here is a 3820x1060pt ultrawide tile, not 1600x900, so the take runs in a Herdr space `demo` laid out shell | viewer | blank filler pane, dividers dragged until shell + viewer fill a 16:9 region, and the edit crops the filler and the Fleet sidebar away. theGrid records the window (`target=window`, mov, 60fps, `cursor=false`; it arrives as 4096x1136 VFR, post forces 60fps). Driver: `TAKE=/private/tmp/herdr-md-take CLICK_FX=0.32 PARK="X Y" scripts/drive-take.sh --shell T` (a physical TAKE path: `mdh` resolves relative paths against the physical cwd; PARK moves the pointer out of frame because the recorder draws it). Working files, post scripts and re-run steps: `~/Movies/herdr-md-launch/README.md`.

### Storyboard v2 (master, ~59s; reshot 2026-11-08)

The first cut skipped images, video, figure zoom, the picker and theming; the
owner asked for them. Same rules: a headline of 6 words or fewer per scene,
footage at 87% of the frame, the /brag register (dark canvas, teal glow, title
and end cards, music: "Happy Beats & Business Moves Vol. 10" by Sascha Ende,
ende.app, CC BY 4.0 with attribution optional; credit it anyway).

| Scene | On screen / action | Headline |
|---|---|---|
| Title | Kicker "a mod for herdr" | **Markdown and the terminal, done right.** |
| Keys | `j` `j` `j`, `ctrl-d` glide, `ctrl-u` | **Vim keys. Smooth scrolling.** |
| Picker | `ctrl-p`, type "med", live preview, `Enter` opens media.md | **Find any doc. Live preview.** |
| Image | `j` ×3 to the chart, `Enter` zooms, `+`, pan `l` `l`, `Esc` | **Images inline. Zoom into any figure.** |
| GIF | `}` `j`: the loss curve animates | **GIFs animate.** |
| Video | `}` `j` `j`, `Enter` plays the fitting clip | **Videos play in place.** |
| Outline | `Backspace` to the tour, `o`, `j` `j`, `Enter` (sped 1.5x) | **Outline. Jump anywhere.** |
| Math | `j` `j`, `Enter` zooms the formula, `+`, `Esc` | **Real math, typeset.** |
| Diagram | `}` `j`, `Enter`, `+`, pan, `Esc` | **Diagrams you can explore.** |
| Theme | Light appearance (paper), then dark Tokyo Night: figures re-render | **Follows your theme.** |
| Change | `cp after.md`: glide, three marks, "3 changed", `]` | **See exactly what changed.** |
| Bonus | `mdh hl … --note …`: tint, note types in | **Bonus: your agent points.** |
| Pin | `n` `V` `p`: "Pinned for Claude" | **You point back.** |
| Sel | `mdh sel` in the shell | **Same file. Exact lines.** |
| End | `add the mod github.com/ryanthedev/herdr-md` | **herdr-md** |

The square short (~24s) is cut from the same take: title, picker, zoom, video,
theme, bonus, end.

**Recording v2:** an isolated Herdr (`open -n -a Herdr --env HERDR_APP_HOME=~/.cache/hdt`)
on the second display, so no key press can reach the person's agents (terminals
are shared through herdr-core: record in a dedicated space with a bare `zsh -f`).
`~/Movies/herdr-md-launch/work/frame-iso.sh` resets and frames each take; the
driver takes `WIN`, `CX`, `CY`, `PARK` and `HERDR_APP_HOME`. Post:
`work/render2.py master|short`.

"Since you last looked" (close, edit, reopen) is a separate optional beat.

## Verify before recording

- Mod installed as a copy (`scripts/dev-sync.sh`), `mdh` on PATH, Node/npm, Chrome. **Prewarm** math and Mermaid in the final theme: first-use `npm install` and Chrome startup would stall the footage.
- Rehearse: `scripts/drive-take.sh --dry-run`, then a real run. Unverified until then: theGrid key names (shifted letters and `{ } ] ?` go through `input type`), the outline's starting entry (`j` ×3 should land on Writing math), `mdh sel` printing the pinned range, and `Backspace` gliding back to Links (heights fix of 2026-11-08, not seen on screen). Already seen on screen: three changed blocks and the glide to them right after a highlight.
- Captions must say display math is MathJax and inline math is Unicode; remote images are placeholders by design.

## Existing skills looked at (none used as-is)

Browser- or terminal-oriented, so not a fit for a native window, but their post-production ideas transfer: zoom effects, text overlays, staged capture/edit/voiceover.
- `demo-video`: Playwright + ffmpeg + edge-tts ([framecraft](https://github.com/vaddisrinivas/framecraft))
- `walkthrough-video`: Remotion from screenshots/live sites ([jezweb/claude-skills](https://github.com/jezweb/claude-skills))
- `vhs-cli-demos`, `reel`, `terminal-demo-generator`: VHS/asciinema for terminal apps
