// node test/preview.test.mjs
// The picker's preview must lex only the start of a long file: marked's lexer
// grows faster than the text in Herdr's QuickJS, and a ~78 KB note ran the
// shared mod runtime out of memory (blank preview, then every mod dead).
import assert from "node:assert/strict";
import { marked } from "../mods/herdr-md/marked.js";
import * as picker from "../mods/herdr-md/picker.js";

const { previewSource, PV_CHARS } = picker;
let n = 0;
const t = (name, f) => { f(); n++; console.log("ok  ", name); };

// A synthetic long note shaped like the one that broke it: ~80 KB, 700+ lines,
// long prose lines with $ prices, bold and links, 5-column tables, headings, lists.
function longNote() {
  const prose = "Plan for the week: book the $1,200–1,500 option, compare with the **$350–400** one, and check [the site](https://example.com) again. ".repeat(6);
  const table = ["| Option | Price | Where | Active | Notes |", "|---|---|---|---|---|",
    ...Array.from({ length: 6 }, (_, i) => `| **Choice ${i}** | $${1000 + i * 250} | Somewhere, 3 nights | yes | ${prose.slice(0, 160)} |`)].join("\n");
  const out = ["# A long note — draft", ""];
  for (let s = 0; out.join("\n").length < 80000; s++) out.push(`## Section ${s}`, "", prose, "", table, "", "- one item", "- another $50 item", "", prose, "");
  return out.join("\n");
}

t("previewSource is exported with a cap well under a long note", () => {
  assert.equal(typeof previewSource, "function", "picker.js must export previewSource");
  assert.ok(PV_CHARS > 0 && PV_CHARS <= 20000);
});

t("a long note is cut to the cap, at a blank line", () => {
  const text = longNote();
  assert.ok(text.length > 75000 && text.split("\n").length > 300);
  const src = previewSource(text);
  assert.equal(src.cut, true);
  assert.ok(src.text.length <= PV_CHARS, `cut to ${src.text.length}`);
  assert.ok(src.text.length > PV_CHARS / 2);
  assert.ok(text.startsWith(src.text));
  assert.ok(text.startsWith("\n\n", src.text.length), "cut lands on a block boundary");
});

t("the cut lexes to the same leading blocks as the whole file", () => {
  const text = longNote(), src = previewSource(text);
  const whole = marked.lexer(text).filter(x => x.type !== "space"), part = marked.lexer(src.text).filter(x => x.type !== "space");
  assert.ok(part.length >= 20, `${part.length} blocks`);
  part.forEach((tok, i) => { assert.equal(tok.type, whole[i].type); assert.equal(tok.raw.trimEnd(), whole[i].raw.trimEnd()); });
});

t("a short file is previewed whole; one giant line is still capped", () => {
  assert.deepEqual(previewSource("# hi\n\ntext\n"), { text: "# hi\n\ntext\n", cut: false });
  const big = "word ".repeat(10000);
  const src = previewSource(big);
  assert.equal(src.cut, true);
  assert.equal(src.text.length, PV_CHARS);
});

console.log(`${n} passed`);
