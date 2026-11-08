#!/bin/sh
# Copy the mod from this repo into the running Herdr app. Herdr hot-reloads mods
# on save but doesn't follow a symlinked mod folder, so development uses a copy.
set -e
here=$(cd "$(dirname "$0")/.." && pwd)
dest="${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/herdr-md"
mkdir -p "$dest"
rsync -a --exclude node_modules --exclude .cache "$here/mods/herdr-md/" "$dest/"
herdr-app check "$dest"
