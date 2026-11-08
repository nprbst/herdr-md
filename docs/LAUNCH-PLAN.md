# herdr-md launch plan

Drafted 2026-11-07 by Claude (Opus 5.5) with a second opinion from Codex
(gpt-6-astra), plus a scan of existing Claude Code demo-video skills.

**The pitch:** your coding agent can point at a markdown doc, and you can point
back. Show that exchange in the first 15 seconds; rendering quality (math,
Mermaid, theme colors) is the supporting act.

## Deliverables

| Artifact | Spec |
|---|---|
| **Master video** | 60s, 16:9, H.264 MP4, 60fps. For the herdr.dev listing, README and launch post. |
| **Short cut** | ~24s, square (or 9:16), highlight → pin → edit only. For X. |
| **Launch post** | ~350 words: shared-reading problem → three-beat demo → rendering extras → requirements → install. Hook: "I built a markdown pane my coding agent can point at." |
| **X thread** | 4 posts: square video + hook → `mdh hl` → pin/read/edit loop → install + repo. Hook: "Select two paragraphs. Your agent gets exactly those paragraphs." |
| **README hero** | Outcome sentence → linked video poster (PNG) → three claims → install. Hook: "Read with your agent. Point both ways." |
| **herdr.dev listing** | Comes from the repo (`herdr-mod` topic, `preview.png`). Refresh `preview.png` with a frame showing a Claude note + the command that made it. |

**Three claims, each backed by footage:**
1. **Agents direct your attention:** one shell command targets blocks and attaches an explanation.
2. **You return precise context:** pinning gives the agent the file, source lines and text via `mdh sel`.
3. **Edits become review targets:** changed blocks get gutter marks and `]`/`[` navigation.

Keep competitor comparisons and star counts out of the copy; let the demo make the distinction.

## Recording: fully scripted, re-shootable

- **Capture:** theGrid's recorder (`thegrid` MCP: `grid_record_start`/`grid_record_stop`) on a fixed **1600×900** Herdr window, Retina, 60fps; ~40% Claude pane / 60% viewer; Herdr zoom ~1.25; check legibility at phone size. Hide notifications and unrelated chrome; park the pointer after clicks.
- **Driving:** a shell script issues `mdh` commands and theGrid key presses (`input_key_press`) with fixed pauses; Claude-typed commands are rehearsed, and waits for model latency are trimmed in the edit. Never speed up the glide (560ms), note typing or selection.
- **Take setup (every take):** disposable copy of `demo/` at `/tmp/herdr-md-take/demo/` (keep `second.md`), baseline + edited snapshots *outside* the watched folder. Close old viewer → restore baseline → `mdh clear "$F"` → `mdh open "$F"` → wait for render → viewer: `Esc`, `zR`, `gg`, `c`.
- **The edited snapshot** changes exactly three task-list items: "Render markdown natively" → "Read markdown in Herdr"; "Let the agent highlight passages" → "Follow agent highlights"; "Take over the world" → "Review only changed blocks".
- **Post:** ffmpeg for assembly, keyframed crop/zoom-ins on the active region (the driver logs timestamps and window bounds), lower-third captions per beat, speed ramps only on idle stretches. `/brag` (Hyperframes) for the title and end cards only. Remotion is unnecessary.

### Storyboard (master, 60s)

| Time | On screen / action | Caption |
|---|---|---|
| 0–2 | Both panes; command ready in Claude | **Markdown you can point at together.** |
| 2–10 | Claude runs `mdh hl "$F" --lines 52-54 --note "Pin these blocks so I can read exactly what you mean."`: glide, tint, note fades in and types | **Your agent points.** |
| 10–17 | Click "Select a few blocks…"; `V`, `j`, `p` (400ms apart); "📌 Pinned for Claude" appears | **You point back.** |
| 17–24 | Claude runs `mdh sel`; hold file, line range, source | **Same file. Exact lines. Your selection.** |
| 24–29 | `mdh clear "$F"`; viewer `Esc`, `gg`; baseline checklist | **Now the agent edits.** |
| 29–39 | Claude runs `cp /tmp/herdr-md-take/after.md "$F"`: reload, three gutter marks, "3 changed"; `]`, pause, `]` | **Three changed blocks. Jump between them.** |
| 39–47 | `gg`, `o`, `j`, `j`, `Enter` → Writing math (hold); `o`, `j`, `Enter` → Diagrams (hold Mermaid) | **Native reading. Math and diagrams included.** |
| 47–54 | `za`, pause, `za`; `G`, `Enter` on the link → second page; `Backspace` | **Fold sections. Follow links. Come back.** |
| 54–60 | End card over a frozen frame | **herdr-md · built for Herdr** · `add the mod github.com/ryanthedev/herdr-md` |

"Since you last looked" (close, edit, reopen) is a separate optional beat.

## Verify before recording

- Mod installed as a copy (`scripts/dev-sync.sh`), `mdh` on PATH, Node/npm, Chrome. **Prewarm** math and Mermaid in the final theme: first-use `npm install` and Chrome startup would stall the footage.
- Rehearse: focus/click targets, `mdh sel` prints the expected range, the edit yields exactly three changed blocks, and the viewer glides to the edit even right after a highlight (fixed 2026-11-07, not yet seen on screen).
- Captions must say display math is MathJax and inline math is Unicode; remote images are placeholders by design.

## Existing skills looked at (none used as-is)

Browser- or terminal-oriented, so not a fit for a native window, but their post-production ideas transfer: zoom effects, text overlays, staged capture/edit/voiceover.
- `demo-video`: Playwright + ffmpeg + edge-tts ([framecraft](https://github.com/vaddisrinivas/framecraft))
- `walkthrough-video`: Remotion from screenshots/live sites ([jezweb/claude-skills](https://github.com/jezweb/claude-skills))
- `vhs-cli-demos`, `reel`, `terminal-demo-generator`: VHS/asciinema for terminal apps
