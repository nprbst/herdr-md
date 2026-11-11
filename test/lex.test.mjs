// node test/lex.test.mjs
// The viewer lexes a file in bounded chunks (mods/herdr-md/lex.js). Chunks must
// never cut a block that can hold a blank line, line numbers must be the file's
// own, and the chunked tokens must match lexing the whole file at once.
import assert from "node:assert/strict";
import { marked, boundaries, splitChunks, capSource, lexAll, blocks, CHUNK, LEX_MAX } from "../mods/herdr-md/lex.js";

let n = 0;
const t = (name, f) => { f(); n++; console.log("ok  ", name); };

// One section of everything that can hold or follow a blank line.
function section(s) {
  return `## Section ${s}: [the spec][spec-${s % 3}] and [site]

A paragraph with **bold**, \`code\`, a [link](https://example.com/${s}) and $x_${s}$ inline math.
It wraps onto a second line.

- tight item one
- tight item two
  - nested item

1. loose ordered one

2. loose ordered two

   continued paragraph inside item two

3. three

| A | B | C |
|---|:-:|--:|
| ${s} | **b** | \`c\` |
| more | cells | here |

\`\`\`js
function f${s}() {

  return ${s};
}
\`\`\`

~~~~
outer fence

~~~
not a closer
~~~

still inside
~~~~

> [!NOTE]
> A callout with **bold**.
>
> Second paragraph of the callout.

> plain quote

$$
a_${s} = b

+ c
$$

$$ e^{i\\pi} + 1 = 0 $$

<!-- a comment

spanning a blank line -->

<pre>
pre block

with a blank line
</pre>

    indented code

    after a blank

Term line
=========

***

`;
}

function fixture(sections = 40) {
  let out = "# Fixture document\n\nIntro text.\n\n";
  for (let s = 0; s < sections; s++) out += section(s);
  out += "[spec-0]: https://example.com/0 \"Zero\"\n[spec-1]: https://example.com/1\n[spec-2]: <https://example.com/2>\n\n[site]: https://example.com\n";
  return out;
}

// The long note shape that broke the preview: ~80 KB of prose, tables and lists.
function longNote() {
  const prose = "Plan for the week: book the $1,200–1,500 option, compare with the **$350–400** one, and check [the site](https://example.com) again. ".repeat(6);
  const table = ["| Option | Price | Where | Active | Notes |", "|---|---|---|---|---|",
    ...Array.from({ length: 6 }, (_, i) => `| **Choice ${i}** | $${1000 + i * 250} | Somewhere, 3 nights | yes | ${prose.slice(0, 160)} |`)].join("\n");
  const out = ["# A long note — draft", ""];
  for (let s = 0; out.join("\n").length < 80000; s++) out.push(`## Section ${s}`, "", prose, "", table, "", "- one item", "- another $50 item", "", prose, "");
  return out.join("\n");
}

const strip = toks => toks.filter(x => x.type !== "space");
const norm = tok => JSON.parse(JSON.stringify(tok, (k, v) => k === "from" || k === "to" ? undefined : k === "raw" && typeof v === "string" ? v.replace(/\s+$/, "") : v));

function sameAsWhole(text, size) {
  const whole = marked.lexer(text), chunked = lexAll(text, size);
  assert.ok(chunked.chunks > 1, "the text was split");
  const a = strip(whole), b = strip(chunked.tokens);
  assert.equal(b.length, a.length, "same number of blocks");
  a.forEach((tok, i) => assert.deepEqual(norm(b[i]), norm(tok), `block ${i} (${tok.type}) differs`));
  const wb = blocks(text, whole);
  assert.deepEqual(chunked.blocks.map(x => [x.type, x.from, x.to]), wb.map(x => [x.type, x.from, x.to]), "same line numbers");
  return chunked;
}

t("chunks join back to the text and start where they say", () => {
  const text = fixture();
  const chunks = splitChunks(text, 500);
  assert.ok(chunks.length > 20, `${chunks.length} chunks`);
  assert.equal(chunks.map(c => c.text).join(""), text);
  const lines = text.split("\n");
  for (const c of chunks) {
    assert.equal(text.slice(0, c.start).split("\n").length, c.line);
    assert.ok(c.text.startsWith(lines[c.line - 1]));
  }
});

t("no boundary inside a fence, math, comment or <pre>, or before an indented or list line", () => {
  const text = fixture(6), lines = text.split("\n");
  // Lines inside multi-line constructs, found independently by scanning the fixture.
  const banned = new Set();
  const mark = (open, close) => { for (let i = 0; i < lines.length; i++) if (open.test(lines[i])) { let j = i + 1; while (j < lines.length && !close.test(lines[j])) banned.add(++j); i = j; } };
  mark(/^```js$/, /^```$/); mark(/^~~~~$/, /^~~~~$/); mark(/^\$\$$/, /^\$\$$/); mark(/^<!--/, /-->$/); mark(/^<pre>$/, /^<\/pre>$/);
  let seen = 0;
  for (const [at, line] of boundaries(text)) {
    seen++;
    assert.ok(!banned.has(line), `boundary inside a block at line ${line}: ${lines[line - 1]}`);
    assert.equal(lines[line - 2].trim(), "", "after a blank line");
    assert.match(lines[line - 1], /^\S/);
    assert.doesNotMatch(lines[line - 1], /^(?:[-*+]|\d+[.)])(?:\s|$)/);
    assert.equal(text.slice(0, at).split("\n").length, line);
  }
  assert.ok(seen > 50, `${seen} boundaries`);
});

t("chunked tokens and line numbers match whole-file lexing (headings, lists, tables, fences, callouts, math, refs)", () => {
  const text = fixture();
  for (const size of [1, 300, 2000, CHUNK]) sameAsWhole(text, size);
  const { tokens } = lexAll(text, 300);
  const links = [];
  marked.walkTokens(tokens, x => { if (x.type === "link") links.push(x.href); });
  assert.ok(links.includes("https://example.com/2") && links.includes("https://example.com"), "references defined at the end resolve in every chunk");
  assert.ok(strip(tokens).some(x => x.type === "math" && x.text.includes("+ c")), "multi-line math kept whole");
});

t("line numbers point at each block's own source line", () => {
  const text = fixture(10), lines = text.split("\n");
  for (const b of lexAll(text, 300).blocks) {
    const first = b.raw.split("\n").find(l => l.trim()).trim();
    assert.ok(lines[b.from - 1].includes(first.slice(0, 20)) || lines.slice(b.from - 1, b.to).join("\n").includes(first.slice(0, 20)), `line ${b.from}: ${first}`);
  }
});

t("the long note: bounded chunks, same blocks as whole-file lexing", () => {
  const text = longNote();
  assert.ok(text.length > 75000);
  const chunks = splitChunks(text);
  assert.ok(chunks.length >= 15, `${chunks.length} chunks`);
  // Every chunk is small (a chunk only runs past CHUNK to the next boundary).
  for (const c of chunks) assert.ok(c.text.length < CHUNK * 2, `chunk of ${c.text.length}`);
  sameAsWhole(text, CHUNK);
});

t("one block with no boundary stays one chunk (an unclosed fence)", () => {
  const text = "# t\n\n```\n" + "code\n\n".repeat(3000);
  assert.equal(splitChunks(text, 100).length, 1);
  assert.equal([...boundaries(text)].length, 1, "only before the fence");
});

t("an unclosed $$ or <!-- doesn't stop splitting", () => {
  const text = ("Costs $$ a lot\n\nNext para\n\n<!-- open\n\nText\n\n").repeat(200);
  assert.ok(splitChunks(text, 200).length > 20);
});

t("capSource: small files whole, huge ones cut at a boundary with line counts", () => {
  assert.deepEqual(capSource("# a\n\nb\n"), { text: "# a\n\nb\n", cut: false, lines: 4, total: 4 });
  const text = fixture(400);
  assert.ok(text.length > 300000);
  const c = capSource(text, 100000);
  assert.equal(c.cut, true);
  assert.ok(c.text.length <= 100000 && c.text.length > 50000);
  assert.ok([...boundaries(text)].some(([at]) => at === c.text.length), "cut at a boundary");
  assert.equal(c.total, text.replace(/\n+$/, "").split("\n").length);
  assert.equal(c.lines, c.text.replace(/\n+$/, "").split("\n").length);
  assert.ok(LEX_MAX >= 500000 && LEX_MAX < 1048576, "under what Herdr reads whole");
});

t("a table is one block per row: the header with its |---| line, then each row on its own line", () => {
  const text = "# T\n\n| a | b \\| c |\n|:--|--:|\n| 1 | 2 |\n| 3 | `x|y` |\n\npara\n";
  const bs = lexAll(text).blocks;
  assert.deepEqual(bs.map(b => [b.type, b.r, b.from, b.to, b.first, b.last]), [
    ["heading", undefined, 1, 1, undefined, undefined],
    ["trow", -1, 3, 4, true, false],
    ["trow", 0, 5, 5, false, false],
    ["trow", 1, 6, 6, false, true],
    ["paragraph", undefined, 8, 8, undefined, undefined]]);
  assert.ok(bs[1].table === bs[3].table, "rows share the table token");
  // An empty header isn't shown, so it isn't a stop.
  const noHead = lexAll("|  |  |\n|--|--|\n| 1 | 2 |\n").blocks;
  assert.deepEqual(noHead.map(b => [b.type, b.r, b.from, b.first, b.last]), [["trow", 0, 3, true, true]]);
});

console.log(`${n} passed`);
