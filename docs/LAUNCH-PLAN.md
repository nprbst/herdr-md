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

### Storyboard (master, 60s)

Captions are muted-first: 6 words or fewer, one per beat. No shot runs over 5s
(cut the longer beats into two shots in the edit). The driver's beats and
captions match this table.

| Time | On screen / action | Caption |
|---|---|---|
| 0–3 | Tour top fills the viewer: title, Note callout, Reading, tasks, table | **Markdown and the terminal, done right.** |
| 3–7 | `j` `j` `j`, `ctrl-d` glide, `ctrl-u` | **Vim keys. Smooth scrolling.** |
| 7–12 | `o` outline, `j` ×3, `Enter` → Writing math | **Outline. Jump anywhere.** |
| 12–15 | Hold the typeset loss formula | **Real math, typeset.** |
| 15–19 | `}` → Diagrams, hold Mermaid | **Mermaid, in your theme.** |
| 19–23 | `za`, pause, `za` | **Fold any section.** |
| 23–28 | `/` "changed", `Enter`, `n`, `Esc` | **Search as you read.** |
| 28–33 | `G`, `Enter` on the link → second page, `Backspace` | **Links open in place.** |
| 33–36 | `cp after.md "$F"`: glide up to Reading, three gutter marks, "3 changed" (the one before/after) | **The file changes. See what.** |
| 36–39 | `]`, `]` | **Jump change to change.** |
| 39–43 | Bonus: `mdh hl "$F" --text 'Select a few blocks' --note '…'`: glide, tint, note types in | **Bonus: your agent points.** |
| 43–46 | `V` `j` `p`: "📌 Pinned for Claude" | **You point back.** |
| 46–49 | `mdh sel` in the shell: file, lines, source | **Same file. Exact lines.** |
| 49–60 | End card over a frozen frame, held ≥3s | **herdr-md for Herdr** · `add the mod github.com/ryanthedev/herdr-md` |

### Storyboard (short, ~24s)

| Time | On screen / action | Caption |
|---|---|---|
| 0–2 | Tour top (the hook frame is the first frame) | **Markdown and the terminal, done right.** |
| 2–7 | `o`, `j` ×3, `Enter` → typeset math | **Outline. Typeset math.** |
| 7–10 | `}` → Mermaid | **Mermaid, in your theme.** |
| 10–14 | `cp after.md "$F"`: glide, three marks; `]` | **See exactly what changed.** |
| 14–19 | `mdh hl … --note …`: tint, note types in | **Bonus: your agent points.** |
| 19–24 | End card, held 4s+ | `add the mod github.com/ryanthedev/herdr-md` |

"Since you last looked" (close, edit, reopen) is a separate optional beat.

## Verify before recording

- Mod installed as a copy (`scripts/dev-sync.sh`), `mdh` on PATH, Node/npm, Chrome. **Prewarm** math and Mermaid in the final theme: first-use `npm install` and Chrome startup would stall the footage.
- Rehearse: `scripts/drive-take.sh --dry-run`, then a real run. Unverified until then: theGrid key names (shifted letters and `{ } ] ?` go through `input type`), the outline's starting entry (`j` ×3 should land on Writing math), and `mdh sel` printing the pinned range. Already seen on screen: three changed blocks and the glide to them right after a highlight.
- Captions must say display math is MathJax and inline math is Unicode; remote images are placeholders by design.

## Existing skills looked at (none used as-is)

Browser- or terminal-oriented, so not a fit for a native window, but their post-production ideas transfer: zoom effects, text overlays, staged capture/edit/voiceover.
- `demo-video`: Playwright + ffmpeg + edge-tts ([framecraft](https://github.com/vaddisrinivas/framecraft))
- `walkthrough-video`: Remotion from screenshots/live sites ([jezweb/claude-skills](https://github.com/jezweb/claude-skills))
- `vhs-cli-demos`, `reel`, `terminal-demo-generator`: VHS/asciinema for terminal apps
