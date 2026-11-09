// node test/picker.test.mjs
// The picker's Telescope-style options (picker.json), re-rooting into a folder,
// and the folders-only listing.
import assert from "node:assert/strict";
import { parseConfig, layoutOf, sizeOf, within, shape, foldersOf, readmeOf, shorten, PICK_DEFAULTS } from "../mods/herdr-md/picker.js";

let n = 0;
const t = (name, f) => { f(); n++; console.log("ok  ", name); };

t("no file means today's picker", () => {
  for (const text of [null, "", "  \n"]) {
    const { opts, error } = parseConfig(text);
    assert.equal(error, null);
    assert.equal(opts.layout_strategy, "horizontal");
    assert.equal(opts.files, true);
    assert.equal(opts.previewer, null);
    assert.equal(opts.hidden, true);
    assert.deepEqual(layoutOf(opts), {});
  }
});

t("Telescope names are read", () => {
  const { opts, error } = parseConfig(JSON.stringify({
    layout_strategy: "center", previewer: false, files: false, hidden: false, no_ignore: true,
    file_ignore_patterns: ["^archive/", "\\.draft\\.md$"], path_display: ["tail"], prompt_prefix: "🔍", depth: 6,
    layout_config: { width: 0.5, prompt_position: "bottom", center: { width: 700, height: 0.4 }, horizontal: { preview_width: 0.6 } },
  }));
  assert.equal(error, null);
  assert.equal(opts.layout_strategy, "center");
  assert.equal(opts.files, false);
  assert.equal(opts.ignore.length, 2);
  assert.deepEqual(layoutOf(opts), { width: 700, height: 0.4, prompt_position: "bottom" });
  assert.deepEqual(layoutOf({ ...opts, layout_strategy: "horizontal" }), { width: 0.5, prompt_position: "bottom", preview_width: 0.6 });
});

t("bad JSON keeps every default and says why", () => {
  const { opts, error } = parseConfig("{ layout_strategy: center }");
  assert.match(error, /^picker\.json: /);
  assert.equal(opts.layout_strategy, PICK_DEFAULTS.layout_strategy);
});

t("a bad value keeps that default only", () => {
  const { opts, error } = parseConfig(JSON.stringify({ layout_strategy: "flex", files: false, depth: 99, file_ignore_patterns: ["(", "ok"] }));
  assert.match(error, /layout_strategy/);
  assert.equal(opts.layout_strategy, "horizontal");
  assert.equal(opts.files, false);
  assert.equal(opts.depth, PICK_DEFAULTS.depth);
  assert.equal(opts.ignore.length, 1);
  assert.match(parseConfig('{"layout_config":{"width":"wide"}}').error, /layout_config\.width/);
  assert.match(parseConfig("[1]").error, /object/);
});

t("sizes: fraction, pixels, auto, never past the room", () => {
  assert.equal(sizeOf(0.5, 1000, 9), 500);
  assert.equal(sizeOf(640, 1000, 9), 640);
  assert.equal(sizeOf(5000, 1000, 9), 1000);
  assert.equal(sizeOf(undefined, 1000, 9), 9);
  assert.equal(sizeOf(1, 1000, 9), 1000);
});

const repo = { root: "/r", kind: "git", files: ["README.md", "docs/a.md", "docs/guides/b.md", "docs/guides/README.md", ".github/x.md", "notes/archive/old.md"], total: 6, capped: false };

t("re-rooting into a folder keeps git's listing, relative to it", () => {
  const d = within(repo, "/r/docs");
  assert.equal(d.root, "/r/docs");
  assert.deepEqual(d.files, ["a.md", "guides/b.md", "guides/README.md"]);
  assert.equal(within(repo, "/r"), repo);
  assert.equal(within(repo, "/r/"), repo);
  assert.deepEqual(within(repo, "/elsewhere").files, []);
  assert.deepEqual(within(repo, "/r/doc").files, [], "a prefix of a folder name is not that folder");
});

t("folders only: every folder holding markdown, shallow first", () => {
  assert.deepEqual(foldersOf(repo.files), [".github", "docs", "notes", "docs/guides", "notes/archive"]);
  const v = shape(repo, parseConfig('{"hidden":false}').opts, true);
  assert.deepEqual(v.rows, ["docs", "notes", "docs/guides", "notes/archive"]);
  assert.equal(v.folders, true);
});

t("hidden and file_ignore_patterns drop paths", () => {
  const { opts } = parseConfig(JSON.stringify({ hidden: false, file_ignore_patterns: ["archive/"] }));
  assert.deepEqual(shape(repo, opts, false).rows, ["README.md", "docs/a.md", "docs/guides/b.md", "docs/guides/README.md"]);
});

t("a folder previews its README", () => {
  assert.equal(readmeOf(repo.files, "docs/guides"), "docs/guides/README.md");
  assert.equal(readmeOf(repo.files, "docs"), null, "only the folder's own README, not one deeper");
  assert.equal(readmeOf(repo.files, ""), "README.md");
});

t("folders mode finds each folder's README once", () => {
  const v = shape({ ...repo, files: [...repo.files, "docs/index.md", "docs/guides/readme.markdown"] }, parseConfig(null).opts, true);
  assert.equal(v.readmes.get("docs/guides"), "docs/guides/README.md", "README.md beats readme.markdown");
  assert.equal(v.readmes.get("docs"), "docs/index.md", "index.md when there is no README");
  assert.equal(v.readmes.get("notes"), undefined);
});

t("shorten cuts folders to a letter", () => {
  assert.equal(shorten("docs/guides"), "d/g");
  assert.equal(shorten(".github/workflows"), ".g/w");
  assert.equal(shorten(""), "");
});

console.log(`${n} passed`);
