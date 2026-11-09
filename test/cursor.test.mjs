// node --test test/
// The cursor's look and motion (mods/herdr-md/doc.js): C and B cycle them, the
// saved choice survives junk, and the cursor never vanishes with numbers off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CURSOR_LOOKS, CURSOR_MOTIONS, nextLook, nextMotion, parseCursorPref, cursorParts } from "../mods/herdr-md/doc.js";

test("C and B cycle through every option and wrap", () => {
  let l = CURSOR_LOOKS[0]; for (let i = 0; i < CURSOR_LOOKS.length; i++) l = nextLook(l);
  assert.equal(l, CURSOR_LOOKS[0]);
  let m = CURSOR_MOTIONS[0]; for (let i = 0; i < CURSOR_MOTIONS.length; i++) m = nextMotion(m);
  assert.equal(m, CURSOR_MOTIONS[0]);
});

test("a missing or bad saved choice falls back to the defaults", () => {
  assert.deepEqual(parseCursorPref(null), { look: "bar", motion: "steady" });
  assert.deepEqual(parseCursorPref("{nope"), { look: "bar", motion: "steady" });
  assert.deepEqual(parseCursorPref('{"look":"zap","motion":"blink both"}'), { look: "bar", motion: "blink both" });
});

test("every look still shows a cursor with numbers off", () => {
  for (const look of CURSOR_LOOKS) assert.ok(cursorParts(look, "steady", false).row, look);
  assert.equal(cursorParts("badge", "steady", false).badge, false);
});

test("the motion animates only the part it names, and only if it's drawn", () => {
  assert.deepEqual(cursorParts("badge+highlight", "pulse number", true), { row: "tint", badge: true, numAnim: "pulse", rowAnim: null });
  assert.deepEqual(cursorParts("badge+highlight", "blink highlight", true), { row: "tint", badge: true, numAnim: null, rowAnim: "blink" });
  assert.equal(cursorParts("badge", "pulse highlight", true).rowAnim, null);       // no layer to pulse
  assert.equal(cursorParts("lift", "blink both", false).numAnim, null);            // no number shown
  assert.equal(cursorParts("lift", "blink both", false).rowAnim, "blink");
});
