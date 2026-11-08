#!/bin/bash
# Drive one demo take, beat by beat, with fixed pauses (docs/LAUNCH-PLAN.md has
# the storyboard). Run scripts/take-setup.sh first, then start the recorder.
#
#   scripts/drive-take.sh --dry-run            print every step, touch nothing
#   scripts/drive-take.sh [--cut master|short] [--shell TERMINAL] [--countdown N]
#
#   --cut      master (60s, default) or short (~24s)
#   --shell T  paste the mdh commands into herdr-core terminal T (`hc ls`) so
#              they show on screen; without it they run here, off camera.
#              The shell must sit in $TAKE: it is shown relative paths. Use a
#              physical TAKE (/private/tmp/..., not /tmp/...): mdh resolves
#              relative paths against the physical cwd.
#   CLICK_FX   env: the viewer status bar's x as a fraction of the Herdr
#              window (default 0.505, viewer in the middle column)
#   PARK       env: "X Y" screen point to park the pointer after each click,
#              outside the frame you crop (the recorder draws the pointer)
#
# This script presses keys in the Herdr window (theGrid `input`). Don't run it
# while someone else is typing. Beat start times land in $TAKE/beats.tsv for
# placing captions in the edit.
#
# Rehearsed 2026-11-08: every key goes through `input key` (shift chords for
# V G { } ?); focus_viewer clicks the viewer's status bar to take the keyboard.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
TAKE=${TAKE:-/tmp/herdr-md-take}
F="$TAKE/demo/tour.md"
DRY=0 CUT=master SHELL_T="" COUNTDOWN=3
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) DRY=1 ;;
    --cut) CUT=$2; shift ;;
    --shell) SHELL_T=$2; shift ;;
    --countdown) COUNTDOWN=$2; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "drive-take: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
case $CUT in master|short) ;; *) echo "drive-take: --cut master|short" >&2; exit 2 ;; esac

if [ $DRY = 0 ]; then
  [ -f "$TAKE/viewer.pane" ] || { echo "drive-take: run scripts/take-setup.sh first" >&2; exit 1; }
  PANE=$(cat "$TAKE/viewer.pane")
  WIN=$(thegrid window find --app Herdr --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["windowId"])')
  # Click target: the viewer's status bar, empty middle (viewer is the middle
  # column of the take layout; fractions of the Herdr window frame).
  read -r CX CY < <(thegrid window find --app Herdr --json | FX=${CLICK_FX:-0.505} python3 -c 'import json,os,sys; f=json.load(sys.stdin)["matches"][0]["frame"]; print(int(f["x"]+f["width"]*float(os.environ["FX"])), int(f["y"]+f["height"]*0.945))')
else
  PANE=PANE WIN=WIN CX=X CY=Y
fi
# Paths as typed: relative in the visible shell (it sits in $TAKE), absolute here.
if [ -n "$SHELL_T" ]; then SF=demo/tour.md SA=after.md; else SF=$F SA=$TAKE/after.md; fi
T0=$(python3 -c 'import time; print(time.time())')
SIM=0   # dry run: simulated clock, the sum of the pauses (key presses not counted)

say() { printf '  %s\n' "$*"; }
run() { if [ $DRY = 1 ]; then say "$*"; else "$@" >/dev/null; fi; }
pause() {
  if [ $DRY = 1 ]; then SIM=$(python3 -c "print(round($SIM + $1, 2))"); else sleep "$1"; fi
}

# One beat: log its start (seconds since T0) and caption.
beat() {
  local t
  if [ $DRY = 1 ]; then t=$SIM
  else
    t=$(python3 -c "import time; print(round(time.time() - $T0, 2))")
    printf '%s\t%s\t%s\n' "$t" "$1" "$2" >> "$TAKE/beats.tsv"
  fi
  printf '[%6ss] %-10s %s\n' "$t" "$1" "$2"
}

# Keys go to the viewer: focus its pane, then click its status bar (pane.focus
# alone leaves the keyboard elsewhere), then press. Everything goes through
# `input key`: the viewer ignores `input type` text. Capitals and shifted
# symbols become shift chords (V is shift+v, } is shift+]).
focus_viewer() {
  run herdr-app do pane.focus "{\"pane\":\"$PANE\"}"; pause 0.15
  run thegrid input click "$CX" "$CY"
  [ -n "${PARK:-}" ] && run thegrid input move $PARK
  pause 0.6   # keys sooner than this get lost
}
keyname() {
  case $1 in
    [[:upper:]]) printf 'shift+%s' "$(printf %s "$1" | tr A-Z a-z)" ;;
    '{') printf 'shift+[' ;; '}') printf 'shift+]' ;; '?') printf 'shift+/' ;;
    *) printf %s "$1" ;;
  esac
}
k() {
  for x in "$@"; do
    run thegrid input key "$(keyname "$x")" --window "$WIN"
    pause 0.3
  done
}
# Type a word into the search prompt, one key per letter.
word() { local i; for ((i = 0; i < ${#1}; i++)); do run thegrid input key "${1:i:1}" --window "$WIN"; done; }

# An agent-side command: visible in the --shell terminal, or run here.
agent() {
  if [ -n "$SHELL_T" ]; then run hc send "$SHELL_T" "$*"
  else run sh -c "$*" || true; fi
}

if [ $DRY = 0 ]; then
  echo "window $WIN, viewer $PANE, cut $CUT; window frame:"
  thegrid window find --app Herdr --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["matches"][0]["frame"])'
  echo "starting in $COUNTDOWN s"; sleep "$COUNTDOWN"
else
  echo "dry run: cut $CUT, file $F"
fi
[ $DRY = 1 ] || : > "$TAKE/beats.tsv"

focus_viewer
k escape g g
pause 0.5

if [ $CUT = master ]; then
  beat hook   "Markdown and the terminal, done right."
  pause 3
  beat keys   "Vim keys. Smooth scrolling."
  k j j j; pause 0.4; k ctrl+d; pause 1.2; k ctrl+u; pause 1
  beat outline "Outline. Jump anywhere."
  k o; pause 1.2; k j j; pause 0.9; k enter; pause 1.6          # o opens on the current section (Reading): j j is Writing math
  beat math   "Real math, typeset."
  pause 3
  beat mermaid "Mermaid, in your theme."
  k '}'; pause 3.5
  beat fold   "Fold any section."
  k z a; pause 1.4; k z a; pause 1.4
  beat search "Search as you read."
  k /; pause 0.3; word theme
  pause 0.6; k enter; pause 1.8; k escape; pause 0.4      # typing lands on the Note; Enter steps on (n would be typed)
  beat links  "Links open in place."
  k G; pause 0.9; k enter; pause 1.6; k backspace; pause 1.4
  beat change "The file changes. See what."
  agent "cp $SA $SF"; pause 3                      # glide, three marks, "3 changed"
  beat step   "Jump change to change."
  k ']'; pause 1.2; k ']'; pause 1.4
  beat bonus  "Bonus: your agent points."
  agent "mdh hl $SF --text 'Select a few blocks' --note 'Pin the lines you mean, and I read exactly those.'"
  pause 4
  beat pin    "You point back."
  focus_viewer; k n V p; pause 1.6                              # n: cursor onto the highlight (one block)
  beat sel    "Same file. Exact lines."
  agent "mdh sel"; pause 3
  beat cta    "add the mod github.com/ryanthedev/herdr-md"
  pause 5
else
  beat hook   "Markdown and the terminal, done right."
  pause 2
  beat outline "Outline. Typeset math."
  k o; pause 0.8; k j j j; pause 0.4; k enter; pause 2.4
  beat mermaid "Mermaid, in your theme."
  k '}'; pause 2.7
  beat change "See exactly what changed."
  agent "cp $SA $SF"; pause 2.4; k ']'; pause 1.4
  beat bonus  "Bonus: your agent points."
  agent "mdh hl $SF --text 'Select a few blocks' --note 'Pin the lines you mean, and I read exactly those.'"
  pause 4.6
  beat cta    "add the mod github.com/ryanthedev/herdr-md"
  pause 4
fi
if [ $DRY = 1 ]; then echo "end at ${SIM}s of pauses (plus ~0.1s per key press)"
else echo "done; beats in $TAKE/beats.tsv"; fi
