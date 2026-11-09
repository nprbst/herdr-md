// node --test test/
// Relative line numbers (mods/herdr-md/doc.js): every block shows how many j/k
// steps it is from the cursor, so `5j` lands on the block marked 5, with folded
// (hidden) blocks skipped exactly as the viewer's move() skips them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NUMBER_MODES, nextNumberMode, ordinals, gutterLabel } from "../mods/herdr-md/doc.js";

// The viewer's move() (main.js): one j/k step, skipping hidden blocks. Nj is N of them.
const move = (hidden, n, i, d) => { let j = i; for (;;) { const x = j + d; if (x < 0 || x >= n) return j; j = x; if (!hidden[j]) return j; } };
const steps = (hidden, n, i, k) => { let j = i; for (let x = 0; x < Math.abs(k); x++) j = move(hidden, n, j, Math.sign(k)); return j; };

test("# cycles absolute → relative → off → absolute", () => {
  assert.deepEqual(NUMBER_MODES, ["absolute", "relative", "off"]);
  assert.equal(nextNumberMode("absolute"), "relative");
  assert.equal(nextNumberMode("relative"), "off");
  assert.equal(nextNumberMode("off"), "absolute");
});

test("ordinals count visible blocks only", () => {
  assert.deepEqual(ordinals([], 4), [0, 1, 2, 3]);
  assert.deepEqual(ordinals([false, true, true, false, false], 5), [0, 1, 1, 1, 2]);
  assert.deepEqual(ordinals([], 0), []);
});

test("absolute shows the source line everywhere; off shows nothing", () => {
  const ord = ordinals([], 3);
  assert.equal(gutterLabel("absolute", 2, 0, 17, ord), "17");
  assert.equal(gutterLabel("absolute", 0, 0, 1, ord), "1");
  assert.equal(gutterLabel("off", 0, 0, 1, ord), null);
});

test("relative: the cursor shows its line, the rest their distance", () => {
  const ord = ordinals([], 8), lines = [1, 3, 5, 9, 10, 14, 20, 21];
  assert.deepEqual(lines.map((l, i) => gutterLabel("relative", i, 3, l, ord)), ["3", "2", "1", "9", "1", "2", "3", "4"]);
  assert.equal(gutterLabel("relative", 0, 0, 1, ord), "1");
  assert.equal(gutterLabel("relative", 7, 0, 21, ord), "7");
});

test("Nj / Nk land on the block marked N, folded blocks skipped", () => {
  // Block 2 is a folded heading hiding 3..5; block 9 hides 10.
  const n = 12, hidden = [false, false, false, true, true, true, false, false, false, false, true, false];
  const ord = ordinals(hidden, n);
  const visible = [...Array(n).keys()].filter(i => !hidden[i]);
  for (const [a, cur] of visible.entries()) for (const [b, to] of visible.entries()) {
    if (a === b) continue;
    assert.equal(steps(hidden, n, cur, b - a), to, `${b - a} steps from ${cur}`);
    assert.equal(gutterLabel("relative", to, cur, 0, ord), String(Math.abs(b - a)), `cursor ${cur}, block ${to}`);
  }
  // Concretely: from block 1, 2j skips the fold and lands on block 6, which reads 2.
  assert.equal(steps(hidden, n, 1, 2), 6);
  assert.equal(gutterLabel("relative", 6, 1, 0, ord), "2");
});
