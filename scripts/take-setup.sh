#!/bin/sh
# Reset everything for one demo take. Presses no keys, so it is safe to run
# while someone is at the keyboard (it does open a viewer pane).
#
#   scripts/take-setup.sh            fresh copy of demo/, open the viewer
#   scripts/take-setup.sh --no-open  reset files and state only
#   scripts/take-setup.sh --restore  after the last take: put back the person's pinned selection
#
# Focus the pane the viewer should split from (the left, "agent" pane) first:
# `mdh open` splits to the right of the focused pane.
#
# Afterwards: $TAKE/demo/tour.md is the file on screen, $TAKE/after.md the
# edited snapshot (outside the watched folder), $TAKE/viewer.pane the viewer's
# pane id. scripts/drive-take.sh reads all three.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
TAKE=${TAKE:-/tmp/herdr-md-take}
F="$TAKE/demo/tour.md"
NOTES="$HOME/.cache/herdr-md"
key=$(printf %s "$F" | sed 's/[^a-zA-Z0-9][^a-zA-Z0-9]*/_/g').json   # main.js noteKey()

if [ "${1:-}" = "--restore" ]; then
  [ -f "$TAKE/selection.keep" ] && mv "$TAKE/selection.keep" "$NOTES/selection.json" && echo "restored the pinned selection"
  exit 0
fi

# 1. Close the viewer the last take opened (it would keep the old state).
if [ -f "$TAKE/viewer.pane" ]; then
  herdr-app do pane.close "{\"pane\":\"$(cat "$TAKE/viewer.pane")\"}" >/dev/null 2>&1 || true
  rm -f "$TAKE/viewer.pane"
  sleep 0.3
fi

# 2. A disposable copy of demo/ (second.md too, for the link beat), the edited
#    snapshot beside it, never inside the watched folder.
rm -rf "$TAKE/demo"
mkdir -p "$TAKE"
cp -R "$here/demo" "$TAKE/demo"
cp "$here/demo/tour.md" "$TAKE/before.md"
cp "$here/scripts/take/tour-after.md" "$TAKE/after.md"
# A few real docs, so the ctrl-p picker has a list to filter.
cp "$here/README.md" "$TAKE/demo/README.md"
cp "$here/RECIPE.md" "$TAKE/demo/recipe.md"
cp "$here/docs/LAUNCH-PLAN.md" "$TAKE/demo/launch-plan.md"
cp "$here/docs/launch/post.md" "$TAKE/demo/launch-post.md"

# 3. Forget highlights, the "seen" hashes (or the open says "N changed since
#    you last looked") and any pinned selection (so `mdh sel` starts empty).
#    The pinned selection is shared with every Herdr window: keep the person's
#    own pin aside once ($TAKE/selection.keep), and put it back with --restore.
[ -f "$NOTES/selection.json" ] && [ ! -f "$TAKE/selection.keep" ] && cp "$NOTES/selection.json" "$TAKE/selection.keep"
rm -f "$NOTES/$key" "$NOTES/seen-$key" "$NOTES/selection.json"
: > "$TAKE/beats.tsv"

[ "${1:-}" = "--no-open" ] && { echo "reset $TAKE (no viewer opened)"; exit 0; }

# 4. Open the viewer and keep its pane id for the driver and the next take.
out=$(mdh open "$F")
pane=$(printf %s "$out" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pane",""))' 2>/dev/null || true)
[ -n "$pane" ] && printf %s "$pane" > "$TAKE/viewer.pane"

# 5. Wait for the first render: the viewer writes its seen hashes right after
#    it parses the file.
i=0
while [ ! -f "$NOTES/seen-$key" ] && [ $i -lt 50 ]; do sleep 0.2; i=$((i + 1)); done
[ -f "$NOTES/seen-$key" ] || { echo "take-setup: the viewer never rendered $F" >&2; exit 1; }

# 6. Figures render in the background after the text. They are cached by
#    source and theme, so only the first take (or a new theme) waits on them.
sleep 2
echo "ready: $F (viewer pane ${pane:-unknown})"
echo "math and Mermaid cached? check the screen once; a first render takes a few seconds"
