# herdr-md

A Herdr desktop-app mod (gpui-kit JavaScript, no DOM) plus the `mdh` CLI.
Herdr's own docs are the truth: `~/.config/herdr-app/AGENTS.md`, `gpui-kit.d.ts`, `herdr.d.ts`.

## Dev loop

1. Edit in `mods/herdr-md/`.
2. `scripts/dev-sync.sh` copies it into `~/.config/herdr-app/mods/herdr-md` and runs `herdr-app check`; Herdr hot-reloads open viewers.
3. Look: `herdr-app shot <png>`; drive: `mdh …`, `herdr-app do …`, theGrid key presses. Never declare a change done from `herdr-app check` alone.

## Gotchas (all hit for real)

- Install a **copy**, never a symlink: Herdr won't hot-reload a symlinked mod, and a symlinked mod can't write files (write roots resolve outside `~/.config/herdr-app`).
- `EditorState.new` throws inside `render`: create it at load.
- Focusing an `InputState` whose `Input` isn't rendered yet drops the keyboard entirely (the view gets no keys until clicked): keep the `Input` mounted.
- `TextView.markdown` inherits size/font but ignores parent `text_color`.
- `image()` only loads files under the Herdr home: images are copied into `.cache/`.
- Build Herdr-home paths from `appHome()`, never `home()/.config/herdr-app`: under `HERDR_APP_HOME` the hardcoded path copies media to the wrong home and videos show black.
- `on_size_change` sizes and wheel deltas are zoomed pixels; `top()`/`h()` take zoom-1 units: divide by `settings().zoom`.
- No programmatic scroll for plain divs: the viewer is its own viewport (`top(-offset)` + `transition("top")`).
- `"focus"` from `nextCommand()` also fires when a popup over the pane closes: re-take the keyboard only if `panes()` still shows this mod focused ~60ms later.
- Don't name a View method `render` for anything else; don't store derived data in a marked token's `text`.
- `pbcopy` needs `LANG=en_US.UTF-8` or non-ASCII is mangled.
- Links come from untrusted docs: only http(s)/mailto go to `open`; local files are `open -R`.
- theGrid's `bfd` hotkey daemon swallows `cmd-h`/`cmd-l` system-wide unless `bfd.yaml` has an `apps: Herdr:` override.
- `thegrid input click|drag|move` read a negative coordinate (a display above the main one) as a flag: put `--` before the numbers. A Herdr started from the CLI is invisible to theGrid; start an isolated one as an app: `open -n -a Herdr --env HERDR_APP_HOME=…`.
- A long-running main window can exhaust its shared mod JS runtime: every mod, built-ins too, then shows "did not load: Null\"null\"" until Herdr restarts. Bound anything that grows with file size (marked.lexer is superlinear in QuickJS); verify in an isolated Herdr (HERDR_APP_HOME=~/.cache/hdt), not by reloading.

## Commits

Conventional style. End messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
Ask before pushing: it's a public repo listed on herdr.dev.
