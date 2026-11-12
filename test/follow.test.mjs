// node --test test/
// Following another mod's pick (mods/herdr-md/doc.js): a viewer started with
// props {follow: "<shared key>"} shows the file named under that key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { followTarget } from "../mods/herdr-md/doc.js";

test("a new path opens, the same path stays, and no path clears the viewer", () => {
  assert.deepEqual(followTarget("/a.md", "/b.md"), { open: "/b.md" });
  assert.equal(followTarget("/a.md", "/a.md"), null);
  assert.deepEqual(followTarget("/a.md", null), { clear: true });
  assert.equal(followTarget(null, null), null);
  assert.equal(followTarget(null, undefined), null);
});

test("only a markdown path is followed; anything else clears", () => {
  assert.deepEqual(followTarget(null, "/jobs/j/draft.md"), { open: "/jobs/j/draft.md" });
  assert.deepEqual(followTarget("/a.md", "relative.md"), { clear: true });
  assert.deepEqual(followTarget("/a.md", "/etc/passwd"), { clear: true });
  assert.deepEqual(followTarget("/a.md", 42), { clear: true });
});

test("an untrusted document shows only images inside its own folder", async () => {
  const { insideFolder } = await import("../mods/herdr-md/doc.js");
  assert.equal(insideFolder("/jobs/j/shot.png", "/jobs/j"), true);
  assert.equal(insideFolder("/jobs/j/img/a.png", "/jobs/j"), true);
  assert.equal(insideFolder("/Users/n/.ssh/id_rsa", "/jobs/j"), false);
  assert.equal(insideFolder("/jobs/j/../../etc/passwd", "/jobs/j"), false);
  assert.equal(insideFolder("/jobs/j2/a.png", "/jobs/j"), false);
  assert.equal(insideFolder("/jobs/j/./a/../b.png", "/jobs/j"), true);
});
