// node test/video.test.mjs
// Video playback state (mods/herdr-md/video.js). The viewer's frame clock runs
// only while a video plays, so a paused or finished clip must report so, and
// play / pause / seek must land on the right frame without a clock.
import assert from "node:assert/strict";
import { VIDEO_FPS, stopped, command, tick } from "../mods/herdr-md/video.js";

let n = 0;
const t = (name, f) => { f(); n++; console.log("ok  ", name); };
const N = 50, MS = 1000 / VIDEO_FPS;

t("a paused clip never changes on a tick (no clock needed)", () => {
  const st = stopped();
  assert.equal(st.playing, false);
  assert.equal(tick(st, N, 99999), st);
  const paused = command(command(st, { state: "play" }, N, 0), { state: "pause" }, N, 500);
  assert.equal(paused.playing, false);
  assert.equal(tick(paused, N, 10000), paused);
});

t("playing follows the wall clock and stops on the last frame", () => {
  let st = command(stopped(), { state: "toggle" }, N, 1000);
  assert.equal(st.playing, true);
  assert.equal(tick(st, N, 1000 + MS / 3), st, "same frame: nothing to redraw");
  st = tick(st, N, 1000 + 3.5 * MS);
  assert.equal(st.i, 3);
  st = tick(st, N, 1000 + 1000 * MS);
  assert.deepEqual([st.i, st.playing], [N - 1, false]);
  assert.equal(tick(st, N, 1e9), st);
});

t("seek while paused moves the frame and stays paused; while playing keeps playing from there", () => {
  let st = command(stopped(), { state: "seek", t: 2 }, N, 0);
  assert.deepEqual([st.i, st.playing], [2 * VIDEO_FPS, false]);
  st = command(command(stopped(), { state: "play" }, N, 0), { state: "seek", t: 1 }, N, 5000);
  assert.deepEqual([st.i, st.playing], [VIDEO_FPS, true]);
  assert.equal(tick(st, N, 5000 + 2 * MS).i, VIDEO_FPS + 2);
  assert.equal(command(stopped(), { state: "seek", t: 999 }, N, 0).i, N - 1, "clamped to the clip");
});

t("play from the end starts over, unless a time is given; play/pause need frames", () => {
  const end = { i: N - 1, playing: false, t0: 0 };
  assert.equal(command(end, { state: "play" }, N, 0).i, 0);
  assert.equal(command(end, { state: "toggle" }, N, 0).i, 0);
  assert.equal(command(end, { state: "play", t: 4.9 }, N, 0).i, N - 1);
  assert.equal(command(stopped(), { state: "play" }, 0, 0).playing, false, "no frames yet: nothing plays");
});

console.log(`${n} passed`);
