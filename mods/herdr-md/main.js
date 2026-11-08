// md: a native markdown viewer pane. Open with
//   pane.split {direction: "right", mod: "herdr-md", props: {file: "/abs/path.md"}}
// Blocks are native elements (real font sizes and colors); inline runs go
// through TextView.markdown, which inherits size and font from its parent.
//
// Annotations: the `mdh` script (next to this file) writes
// ~/.cache/herdr-md/<file-key>.json = { seq, focus, highlights: [{lines:[a,b]} | {text}, note?, color?] }.
// The viewer watches that folder, tints the matching blocks, shows notes under
// them and scrolls to `focus` whenever `seq` changes.
import { View, div, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, TextView, InputState, Input } from "gpui-base";
import { props, readTextFile, watchFolder, exec, theme, settings, home, nextCommand, panes, run } from "herdr";
import { marked } from "./marked.js";
import { inlineMath } from "./tex.js";
import { hash as bhash, diffBlocks, slug, labelOf, inlineRoles, alertOf, ALERTS } from "./doc.js";

// $$…$$ display math as its own block (single- or multi-line).
marked.use({ extensions: [{
  name: "math", level: "block",
  start(src) { const i = src.indexOf("$$"); return i < 0 ? undefined : i; },
  tokenizer(src) { const m = /^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/.exec(src); if (m) return { type: "math", raw: m[0], text: m[1].trim() }; },
}] });

// Figures (display math, Mermaid) are rendered by render/render.mjs into
// .cache/r/<hash>.{svg,png}; the hash covers the source and the colors used.
const MOD = "herdr-md";
const FIG = `mods/${MOD}/.cache/r`;
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
const isMermaid = tok => tok.type === "code" && /^mermaid\b/i.test(tok.lang || "");
const isMath = tok => tok.type === "math" || (tok.type === "code" && /^(math|latex|tex)$/i.test(tok.lang || ""));

// Body text in the person's terminal font (BerkeleyMono), falling back to Geist.
const BODY = () => settings().font_family || "Geist";
const SIZE = { body: 15, h1: 34, h2: 26, h3: 21, h4: 18, h5: 16, h6: 15 };
const MAX_W = 960, PAD = 64, TOP = 28;
// Scroll animation, done natively by GPUI's transition on the content's `top`:
// a long glide for jumps (highlights, search, headings, gg/G), short for j/k and the wheel.
// A new agent note waits for the glide, fades in, then types itself out.
const GLIDE = 560, STEP = 140, NUDGE = 60;
// The help overlay's list, in the order of the key handler (keys()).
// Two columns of sections.
const HELP = [[
  ["MOVE", [["j k", "next / previous block (5j)"], ["gg G", "top / bottom"], ["{ }", "previous / next heading"],
    ["ctrl-d ctrl-u", "half page down / up"], ["ctrl-f ctrl-b", "page down / up"], ["space", "page down"], ["ctrl-e ctrl-y", "scroll a line, cursor stays"], ["zz", "center the cursor"]]],
  ["SHARE", [["V", "select blocks"], ["y", "copy the markdown source"], ["p", "pin the selection for Claude"], ["Esc", "unselect, close search, unpin"]]],
], [
  ["READ", [["o", "outline"], ["Enter", "fold a heading or follow a link"], ["Backspace", "back after a link"],
    ["za zc zo", "toggle / close / open fold"], ["zM zR", "fold / unfold all"], ["] [", "next / previous change"], ["c", "clear change marks"],
    ["/", "search"], ["n N", "next / previous match or note"], ["#", "line numbers"]]],
  ["VIEWER", [["? h", "this help"], ["q", "close the viewer"]]],
]];
const MODIFIER_KEYS = ["shift", "control", "alt", "platform", "function", "capslock"];
// The app only loads images from its own folder, so local images are copied
// here first. Hidden folder: saving into it doesn't hot-reload the mod.
const CACHE = `mods/${MOD}/.cache`;
const NOTES = () => `${home()}/.cache/herdr-md`;
const noteKey = file => file.replace(/[^a-zA-Z0-9]+/g, "_") + ".json";
const LANG = { sh: "bash", shell: "bash", zsh: "bash", console: "bash", ts: "typescript", js: "javascript", py: "python", rs: "rust", yml: "yaml", toml: "yaml", jsonc: "json" };

// on_size_change and wheel deltas report zoomed pixels; layout sizes (top, h)
// are written at zoom 1 and scaled by the app. Convert measurements back.
const Z = () => Number(settings().zoom) || 1;
// A note's text without markdown marks, for the typing animation.
const plainNote = md => md.replace(/\*\*|__|[*_`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
const dirname = p => p.slice(0, p.lastIndexOf("/")) || "/";
const plain = tokens => (tokens ?? []).map(t => t.tokens ? plain(t.tokens) : t.text ?? t.raw ?? "").join("");
const squash = s => s.replace(/\s+/g, " ").trim().toLowerCase();

// Top-level blocks, with lists split into one block per item so a highlight or
// a scroll target can land on a single bullet. Each gets its source lines.
function blocks(src, tokens) {
  const out = [];
  for (const tok of tokens) {
    if (tok.type === "list") tok.items.forEach((item, j) => out.push({ type: "listitem", item, list: tok, n: (tok.start || 1) + j, raw: item.raw }));
    else if (tok.type !== "space") out.push(tok);
  }
  let cursor = 0;
  for (const b of out) {
    const at = src.indexOf(b.raw, cursor), start = at < 0 ? cursor : at;
    const end = start + b.raw.replace(/\s+$/, "").length;
    b.from = src.slice(0, start).split("\n").length;
    b.to = src.slice(0, end).split("\n").length;
    if (at >= 0) cursor = end;
  }
  return out;
}

export default class Md extends View {
  init(_props, cx) {
    this.file = props()?.file ?? null;
    this.blocks = []; this.error = null; this.codes = []; this.images = {}; this.figs = {};
    this.noteAlpha = 1; this.typed = Infinity;
    this.offset = 0; this.motion = 0; this.heights = []; this.viewH = 0; this.contentH = 0; this.colW = MAX_W - PAD * 2;
    this.notes = { highlights: [] }; this.seq = null; this.pendingFocus = null; this.aim = null;
    this.folded = new Set(); this.hidden = [];
    this.labels = new Map(); this.anchors = new Map(); this.changed = new Set(); this.removed = new Map(); this.lastHashes = null;
    this.history = []; this.pendingAnchor = null; this.restore = null; this.outline = false; this.oi = 0; this.watchGen = 0;
    this.help = false; this.helpIn = 0;
    this.query = ""; this.matches = []; this.mi = 0; this.searching = false; this.typing = false;
    // Vim-ish cursor: one rendered block is one "line". anchor !== null means visual mode.
    this.cursor = 0; this.anchor = null; this.pending = ""; this.count = ""; this.numbers = true; this.picked = null; this.src = "";
    this.handle = cx.focus_handle();
    this.input = InputState.new({ value: "", placeholder: "Search" });
    this.input.on("change", (_e, cx) => { this.search(this.input.value()); this.aimAt(this.matches[this.mi = 0]); cx.notify(); });
    this.input.on("submit", (e, cx) => { this.step(e?.shift ? -1 : 1); cx.notify(); });
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.load(cx);
    this.watch(cx);
    this.watchNotes(cx);
    // "focus" also arrives when a popup over this pane closes, e.g. the leader
    // panel just before it runs pane.go. Take the keyboard only if this is still
    // the focused pane a moment later, or the keyboard stays here while focus moves on.
    cx.spawn(async cx => {
      for (;;) {
        if (await nextCommand() !== "focus") continue;
        cx.timer.after(60, () => { if (panes().find(p => p.focused)?.mod === MOD) this.handle.focus(); });
      }
    });
  }

  load(cx) {
    if (!this.file) { this.error = "No file given"; return; }
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(this.file);
        if (text === null) this.error = "File not found";
        else {
          this.codes.forEach(c => c.release?.()); this.codes = [];
          const tokens = marked.lexer(text); this.src = text;
          this.prepare(tokens);
          this.blocks = this.index(blocks(text, tokens)); this.heights = []; this.error = null;
          this.blocks.forEach(b => { b.find = squash(b.type === "heading" ? plain(b.tokens) : b.raw.replace(/[*_`#>|~]+/g, " ")); });
          if ([...this.folded].some(i => this.blocks[i]?.type !== "heading")) this.folded.clear();
          this.refold(); this.search(this.query);
          this.cursor = Math.min(this.cursor, Math.max(0, this.blocks.length - 1)); this.anchor = null;
          this.highlightAimed = false; this.resolve(); this.applyFocus();
          await this.markChanges();
          if (this.pendingAnchor !== null) { this.jumpAnchor(this.pendingAnchor); this.pendingAnchor = null; }
          else if (this.restore) { this.cursor = Math.min(this.restore.cursor, this.blocks.length - 1); this.aimAt(this.cursor); this.restore = null; }
          this.reaim();
          cx.notify();
          await this.loadImages(tokens);
          cx.notify();
          await this.renderFigures(tokens);
        }
      } catch (e) { this.error = String(e); }
      cx.notify();
    });
  }

  // Reload when the file changes on disk.
  watch(cx) {
    if (!this.file) return;
    const gen = ++this.watchGen, dir = dirname(this.file);
    cx.spawn(async cx => {
      while (gen === this.watchGen) {
        const changed = await watchFolder(dir);
        if (gen !== this.watchGen) return;   // navigated to another file
        if (changed.some(p => p === this.file || p === dir)) this.load(cx);
      }
    });
  }

  // Drop d2l label paragraphs (they name the block before them), number labeled
  // equations, and index heading anchors for #links.
  index(list) {
    const out = [], labels = new Map(), anchors = new Map(); let eq = 0;
    for (const b of list) {
      const l = labelOf(b);
      if (l) {
        const target = out.length - 1;
        if (target >= 0) {
          const t = out[target];
          if (l.eq) t.eqNum = ++eq;
          labels.set(l.name, { block: target, num: t.eqNum, title: t.type === "heading" ? plain(t.tokens) : l.name.replace(/^(fig|sec|tab|eq)_/, "").replace(/_/g, " ") });
        }
        continue;
      }
      if (b.type === "heading") { let a = slug(plain(b.tokens)), k = a, n = 1; while (anchors.has(k)) k = `${a}-${n++}`; anchors.set(k, out.length); }
      out.push(b);
    }
    this.labels = labels; this.anchors = anchors;
    return out;
  }

  // Mark blocks that are new or edited since this file was last shown (in this
  // pane, or in any viewer before: hashes are kept in ~/.cache/herdr-md/seen-*).
  async markChanges() {
    const hashes = this.blocks.map(b => bhash(b.raw.trim()));
    const seen = `${NOTES()}/seen-${noteKey(this.file)}`;
    let prev = this.lastHashes;
    if (!prev) { try { prev = JSON.parse(await readTextFile(seen) ?? "null"); } catch { prev = null; } }
    const { changed, removed } = diffBlocks(prev ?? [], hashes);
    const fresh = this.lastHashes !== null;
    this.changed = changed; this.removed = removed; this.lastHashes = hashes; this.ci = -1;
    exec("sh", ["-c", 'mkdir -p "$1" && printf %s "$2" > "$3"', "seen", NOTES(), JSON.stringify(hashes), seen]);
    // Glide to the first change, unless an agent highlight is taking the view.
    // (aim alone isn't enough: it stays set after any glide until the person scrolls.)
    const busy = this.highlightAimed; this.highlightAimed = false;
    if (changed.size && !busy && this.pendingAnchor === null && !this.restore) {
      const first = Math.min(...changed); this.cursor = first; this.aimAt(first);
      this.flash = `${changed.size} changed${fresh ? "" : " since you last looked"} · ] next · c clear`;
    }
  }

  stepChange(dir, cx) {
    const list = [...this.changed].sort((a, b) => a - b); if (!list.length) return;
    const after = list.filter(i => dir > 0 ? i > this.cursor : i < this.cursor);
    const i = after.length ? (dir > 0 ? after[0] : after[after.length - 1]) : (dir > 0 ? list[0] : list[list.length - 1]);
    this.cursor = i; this.aimAt(i); cx.notify();
  }

  // ---- links ----
  jumpAnchor(frag) {
    const f = decodeURIComponent(frag);
    const i = f.startsWith("label:") ? this.labels.get(f.slice(6))?.block : this.anchors.get(f) ?? this.anchors.get(slug(f));
    if (i !== undefined) { this.cursor = i; this.aimAt(i); }
  }

  follow(url, cx) {
    if (url.startsWith("#")) {
      this.history.push({ file: this.file, cursor: this.cursor });
      this.jumpAnchor(url.slice(1)); return cx.notify();
    }
    // Links come from untrusted documents: never hand `open` anything it could
    // run. Web and mail links go to the browser or mail app; local non-markdown
    // files are only revealed in Finder; other schemes are refused.
    if (/^(https?|mailto):/i.test(url)) { exec("open", [url]); return; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("file:")) { this.flash = `not opening ${url.split(":")[0]}: links`; return cx.notify(); }
    const [path, frag = null] = url.replace(/^file:\/\//, "").split("#");
    const abs = path.startsWith("/") ? path : `${dirname(this.file)}/${decodeURIComponent(path)}`.replace(/\/\.\//g, "/");
    if (/\.(md|markdown|mdx)$/i.test(abs)) this.navigate(abs, frag, cx, true);
    else { exec("open", ["-R", abs]); this.flash = "shown in Finder"; cx.notify(); }
  }

  navigate(file, frag, cx, push) {
    if (push) this.history.push({ file: this.file, cursor: this.cursor });
    if (file === this.file) { if (frag) this.jumpAnchor(frag); return cx.notify(); }
    this.file = file.replace(/\/[^/]+\/\.\.\//g, "/");
    this.folded.clear(); this.offset = 0; this.motion = 0; this.cursor = 0; this.anchor = null; this.heights = [];
    this.lastHashes = null; this.changed = new Set(); this.removed = new Map(); this.seq = null; this.aim = null;
    this.pendingAnchor = frag;
    this.load(cx); this.watch(cx); this.readNotes(cx);
  }

  back(cx) {
    const h = this.history.pop(); if (!h) return;
    if (h.file === this.file) { this.cursor = h.cursor; this.aimAt(h.cursor); return cx.notify(); }
    this.navigate(h.file, null, cx, false); this.restore = { cursor: h.cursor };
  }

  watchNotes(cx) {
    if (!this.file) return;
    cx.spawn(async cx => {
      await exec("mkdir", ["-p", NOTES()]);
      for (;;) {
        await this.readNotes(cx);
        await watchFolder(NOTES());
      }
    });
  }

  async readNotes(cx) {
    let n = null;
    try { n = JSON.parse(await readTextFile(`${NOTES()}/${noteKey(this.file)}`) ?? "null"); } catch {}
    this.notes = n && Array.isArray(n.highlights) ? n : { highlights: [] };
    if (n && n.seq !== this.seq) { this.seq = n.seq; this.pendingFocus = n.focus ?? (n.highlights.length ? 0 : null); this.animateNotes(cx); }
    this.resolve();
    this.applyFocus();
    cx.notify();
  }

  // Hide new notes until the glide is mostly done, fade them in, then type the
  // text out (plain while typing, markdown once complete).
  animateNotes(cx) {
    this.typingTask?.cancel(); this.noteAlpha = 0; this.typed = 0;
    const longest = Math.max(0, ...this.notes.highlights.map(h => plainNote(h.note ?? "").length));
    const step = Math.max(1, Math.ceil(longest / 50));
    cx.timer.after(GLIDE * 0.7, cx => {
      this.noteAlpha = 1; cx.notify();
      this.typingTask = cx.timer.every(22, cx => {
        this.typed += step;
        if (this.typed >= longest) { this.typed = Infinity; this.typingTask?.cancel(); }
        cx.notify();
      });
    });
  }

  // Jump to the highlight the last `mdh` call asked for, once the document is loaded.
  applyFocus() {
    if (this.pendingFocus === null || !this.blocks.length) return;
    this.aimAt(this.notes.highlights[this.pendingFocus]?.blocks?.[0]); this.pendingFocus = null; this.highlightAimed = true;
  }

  // Map each highlight to the blocks it covers: by source lines, or by quoted text.
  resolve() {
    this.marks = new Map();
    this.notes.highlights.forEach((h, k) => {
      let hit = [];
      if (Array.isArray(h.lines)) { const [a, b = a] = h.lines; hit = this.blocks.map((x, i) => x.to >= a && x.from <= b ? i : -1).filter(i => i >= 0); }
      else if (h.text) { const q = squash(h.text); const i = this.blocks.findIndex(x => squash(x.raw).includes(q)); if (i >= 0) hit = [i]; }
      h.blocks = hit;
      hit.forEach((i, j) => this.marks.set(i, { ...h, k, last: j === hit.length - 1 }));
    });
  }

  // Scroll so block `i` sits a little below the top, unfolding what hides it.
  // Keeps aiming while blocks settle (wrapping, images) until the person scrolls.
  aimAt(i) {
    if (i === undefined || i === null || !this.blocks[i]) return;
    if (this.hidden[i]) { for (let h = i - 1; h >= 0; h--) if (this.folded.has(h) && this.covers(h, i)) this.folded.delete(h); this.refold(); }
    this.aim = i; this.reaim();
  }

  reaim() {
    const i = this.aim;
    if (i === null || i === undefined) return;
    let y = TOP;
    for (let j = 0; j < i; j++) { if (this.hidden[j]) continue; if (this.heights[j] === undefined) return; y += this.heights[j]; }
    const to = this.clamp(y - Math.min(120, this.viewH / 4));
    if (Math.abs(to - this.offset) > 2) this.motion = GLIDE;
    this.offset = to;
  }

  // Folding: a folded heading hides everything up to the next heading of the same or higher level.
  covers(h, i) {
    const d = this.blocks[h].depth;
    for (let j = h + 1; j <= i; j++) if (this.blocks[j].type === "heading" && this.blocks[j].depth <= d) return false;
    return i > h;
  }

  refold() {
    this.hidden = []; let depth = null;
    this.blocks.forEach((b, i) => {
      if (b.type === "heading" && depth !== null && b.depth <= depth) depth = null;
      this.hidden[i] = depth !== null;
      if (depth === null && b.type === "heading" && this.folded.has(i)) depth = b.depth;
    });
  }

  sectionSize(h) { let n = 0; for (let j = h + 1; j < this.blocks.length && this.covers(h, j); j++) n++; return n; }

  toggleFold(i) { this.folded.has(i) ? this.folded.delete(i) : this.folded.add(i); this.refold(); }

  // The heading of the section at the top of the view.
  currentHeading() {
    let y = TOP, last = null;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.hidden[i]) continue;
      if (y > this.offset + 40) break;
      if (this.blocks[i].type === "heading") last = i;
      y += this.heights[i] ?? 0;
    }
    return last;
  }

  // Search: whole blocks whose text contains the query (case-insensitive).
  search(q) {
    this.query = q; const s = squash(q);
    this.matches = s ? this.blocks.map((b, i) => b.find.includes(s) ? i : -1).filter(i => i >= 0) : [];
    this.mi = Math.min(this.mi, Math.max(0, this.matches.length - 1));
  }

  step(dir) {
    const n = this.matches.length; if (!n) return;
    this.mi = (this.mi + dir + n) % n; this.aimAt(this.matches[this.mi]);
  }

  openSearch(cx) { this.searching = true; this.input.focus(); cx.notify(); }

  closeSearch(cx) { this.searching = false; this.input.set_value(""); this.search(""); this.handle.focus(); cx.notify(); }

  clamp(y) { return Math.max(0, Math.min(y, Math.max(0, this.contentH - this.viewH))); }

  scrollBy(dy, cx) { this.aim = null; this.motion = NUDGE; const o = this.clamp(this.offset + dy); if (o !== this.offset) { this.offset = o; cx.notify(); } }

  // Editor states must be made outside render: build one per code block at load.
  prepare(tokens) {
    const t = theme();
    marked.walkTokens(tokens, tok => {
      if (tok.type !== "code") return;
      const lang = (tok.lang || "").split(/\s/)[0].toLowerCase();
      tok.state = EditorState.new({ language: LANG[lang] ?? (lang || "text"), readonly: true, value: tok.text,
        font_family: settings().font_family, font_size: 13,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      this.codes.push(tok.state);
    });
  }

  async loadImages(tokens) {
    const srcs = [];
    marked.walkTokens(tokens, tok => { if (tok.type === "image" && !this.images[tok.href]) srcs.push(tok.href); });
    await exec("mkdir", ["-p", `${home()}/.config/herdr-app/${CACHE}`]);
    for (const href of [...new Set(srcs)]) {
      if (/^[a-z]+:\/\//i.test(href)) { this.images[href] = { remote: true }; continue; }
      const abs = href.startsWith("/") ? href : `${dirname(this.file)}/${decodeURIComponent(href)}`;
      const ext = (abs.split(".").pop() || "png").toLowerCase();
      const name = abs.replace(/[^a-zA-Z0-9]+/g, "_").slice(-120) + "." + ext;
      const cp = await exec("cp", ["-p", abs, `${home()}/.config/herdr-app/${CACHE}/${name}`]);
      if (cp.code !== 0) { this.images[href] = { missing: true }; continue; }
      let w = 800, h = 450;
      const s = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", abs]);
      const mw = s.stdout.match(/pixelWidth: (\d+)/), mh = s.stdout.match(/pixelHeight: (\d+)/);
      if (mw && mh) { w = +mw[1]; h = +mh[1]; }
      this.images[href] = { path: `${CACHE}/${name}`, w, h };
    }
  }

  figKey(tok) {
    const t = theme();
    return fnv(JSON.stringify([isMath(tok) ? "m" : "d", tok.text, t.foreground, t.surface, settings().font_family, 1]));
  }

  // Render every display formula and Mermaid diagram not already cached, in one
  // batch (one Chrome launch for all diagrams).
  async renderFigures(tokens) {
    const t = theme(), font = settings().font_family || "sans-serif", jobs = [];
    const root = `${home()}/.config/herdr-app/${FIG}`;
    marked.walkTokens(tokens, tok => {
      if (!isMath(tok) && !isMermaid(tok)) return;
      const key = this.figKey(tok); tok.fig = key;
      if (this.figs[key]?.path || this.figs[key]?.error) return;
      this.figs[key] = { pending: true };
      jobs.push({ kind: isMath(tok) ? "math" : "mermaid", src: tok.text, out: `${root}/${key}.${isMath(tok) ? "svg" : "png"}`, color: t.foreground, exPx: 11, font,
        colors: { fg: t.foreground, surface: t.surface, raised: t.raised, bg: t.background, blue: t.ansi4, purple: t.ansi5, dim: t.dim } });
    });
    if (!jobs.length) return;
    try {
      await exec("mkdir", ["-p", root]);
      const r = await this.runRenderer(JSON.stringify(jobs));
      if (r.code !== 0 || !r.stdout) throw new Error((r.stderr || `renderer exited ${r.code}`).trim().split("\n").pop().slice(0, 200));
      const out = JSON.parse(r.stdout);
      for (const res of out) {
        const key = res.out.split("/").pop().replace(/\.\w+$/, "");
        this.figs[key] = res.error ? { error: res.error } : { path: `${FIG}/${key}.${res.out.split(".").pop()}`, w: res.w, h: res.h };
      }
    } catch (e) { for (const j of jobs) this.figs[j.out.split("/").pop().replace(/\.\w+$/, "")] = { error: String(e) }; }
  }

  // Run the batch renderer, installing its npm packages on first use
  // (MathJax and mermaid-cli; Chrome itself is not downloaded).
  async runRenderer(jobs) {
    const dir = `${home()}/.config/herdr-app/mods/${MOD}/render`;
    if (!this.deps) {
      const has = await exec("test", ["-d", `${dir}/node_modules/mathjax-full`]);
      if (has.code !== 0) {
        const i = await exec("sh", ["-c", 'cd "$1" && PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-audit --no-fund --silent', "install", dir]);
        if (i.code !== 0) throw new Error(`npm install failed (Node.js and npm are needed): ${(i.stderr || "").slice(0, 160)}`);
      }
      this.deps = true;
    }
    return exec("node", [`${dir}/render.mjs`, jobs]);
  }

  figure(tok, id, t) {
    const f = this.figs[tok.fig] ?? { pending: true }, math = isMath(tok);
    if (f.path) {
      const max = this.colW - (math ? 0 : 34);
      let w = f.w, h = f.h; if (w > max) { h = Math.round(h * max / w); w = max; }
      return math
        ? h_flex().w_full().items_center().py(10)
            .child(div().flex_1()).child(image(f.path).w(w).h(h))
            .child(div().flex_1().text_right().text_size(13).text_color(t.dim).child(tok.eqNum ? `(${tok.eqNum})` : ""))
        : h_flex().w_full().justify_center().my(8).p(16).rounded(8).bg(t.surface).border_1().border_color(t.border).child(image(f.path).w(w).h(h));
    }
    const label = f.error ? `${math ? "math" : "mermaid"} · couldn't render: ${f.error}` : `${math ? "math" : "mermaid"} · rendering…`;
    return v_flex().my(8).rounded(8).overflow_hidden().border_1().border_color(f.error ? t.blocked : t.border).bg(t.surface)
      .child(div().px(12).py(4).text_size(12).text_color(f.error ? t.blocked : t.dim).child(label))
      .child(div().px(12).pb(8).text_size(13).text_color(t.muted).child(tok.text));
  }

  inline(id, md) {
    return TextView.markdown(id, inlineMath(inlineRoles(md, this.labels))).selectable(true)
      .on_link_click((url, cx) => this.follow(url, cx));
  }

  picture(tok, id, t) {
    const img = this.images[tok.href];
    if (!img?.path) return div().my(6).px(12).py(8).rounded(6).bg(t.surface).text_color(t.dim).text_size(13)
      .child(`🖼  ${tok.text || tok.href}${img?.remote ? " (remote image not fetched)" : img?.missing ? " (not found)" : ""}`);
    // Fit the column width, but never taller than 560px.
    let w = Math.min(img.w, this.colW), h = Math.round(img.h * w / img.w);
    if (h > 560) { w = Math.round(w * 560 / h); h = 560; }
    return v_flex().my(8).gap(6).items_center()
      .child(image(img.path).w(w).h(h).rounded(8))
      .when(Boolean(tok.text), el => el.child(div().text_size(13).text_color(t.dim).italic().child(tok.text)));
  }

  bullet(item, ordered, n, id, i, t) {
    return h_flex().items_start().gap(10).py(2)
      .child(div().w(22).flex_none().text_right().text_color(item.task ? (item.checked ? t.ansi2 : t.dim) : t.accent)
        .child(item.task ? (item.checked ? "✓" : "○") : ordered ? `${n}.` : "•"))
      .child(v_flex().flex_1().min_w(0).when(item.task && item.checked, el => el.text_color(t.dim))
        .children(item.tokens.filter(c => c.type !== "checkbox").map((c, k) => c.type === "text"
          ? this.inline(`${id}-${k}`, c.raw.replace(/^\[[ xX]\]\s*/, "").trim())
          : this.block(c, `${i}-${k}`, t))));
  }

  block(tok, i, t) {
    const id = `b${i}`;
    switch (tok.type) {
      case "heading": {
        const color = [t.ansi4, t.ansi5, t.ansi6, t.ansi2, t.ansi3, t.muted][tok.depth - 1];
        const folded = this.folded.has(i), n = folded ? this.sectionSize(i) : 0;
        return h_flex().id(`fold-${i}`).items_center().gap(10).cursor_pointer().pt(tok.depth <= 2 ? 22 : 14).pb(tok.depth <= 2 ? 10 : 4)
          .text_size(SIZE[`h${tok.depth}`]).font_weight(tok.depth <= 2 ? 700 : 600).text_color(color)
          .when(tok.depth <= 2, el => el.border_b(1).border_color(t.border).mb(6))
          .on_click((_e, cx) => { this.toggleFold(i); cx.notify(); })
          .child(div().w(14).ml(-24).flex_none().text_size(13).text_color(folded ? color : t.border).child(folded ? "▸" : "▾"))
          .child(div().flex_1().min_w(0).child(plain(tok.tokens)))
          .when(folded, el => el.child(div().flex_none().text_size(13).font_weight(400).text_color(t.dim).child(`${n} block${n === 1 ? "" : "s"} folded`)));
      }
      case "paragraph": {
        const imgs = tok.tokens.filter(x => x.type === "image");
        const onlyImages = imgs.length && tok.tokens.every(x => x.type === "image" || (x.type === "text" && !x.text.trim()) || x.type === "br");
        if (onlyImages) return v_flex().children(imgs.map((im, j) => this.picture(im, `${id}-${j}`, t)));
        return div().py(5).child(this.inline(id, tok.raw.trim()));
      }
      case "math":
        return this.figure(tok, id, t);
      case "code": {
        if (isMath(tok) || isMermaid(tok)) return this.figure(tok, id, t);
        const lines = tok.text.split("\n").length;
        return v_flex().my(8).rounded(8).overflow_hidden().border_1().border_color(t.border).bg(t.surface)
          .child(h_flex().h(28).px(12).items_center().justify_between().border_b(1).border_color(t.border).text_size(12).text_color(t.dim)
            .child(div().child(tok.lang || "text"))
            .child(div().id(`${id}-copy`).px(8).rounded(4).cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground))
              .on_click(() => exec("sh", ["-c", 'printf %s "$1" | LANG=en_US.UTF-8 pbcopy', "copy", tok.text])).child("copy")))
          .child(div().h(Math.min(lines, 40) * 20 + 4).child(Editor.new(tok.state).size_full()));
      }
      case "blockquote": {
        const al = alertOf(tok);
        if (al) {
          const a = ALERTS[al.kind], c = t[a.color];
          return v_flex().my(8).px(16).py(10).gap(4).rounded(8).bg(c + "14").border_l(3).border_color(c)
            .child(h_flex().gap(8).items_center().text_color(c).font_semibold().child(div().child(a.icon)).child(div().child(a.title)))
            .child(this.inline(`${id}-al`, al.body));
        }
        return v_flex().my(8).pl(16).py(2).border_l(3).border_color(t.ansi5).text_color(t.muted)
          .children(tok.tokens.map((c, j) => this.block(c, `${i}-${j}`, t)));
      }
      case "listitem":
        return this.bullet(tok.item, tok.list.ordered, tok.n, id, i, t);
      case "list":
        return v_flex().py(4).children(tok.items.map((item, j) => this.bullet(item, tok.ordered, (tok.start || 1) + j, `${id}-${j}`, `${i}-${j}`, t)));
      case "hr":
        return div().my(16).h(1).bg(t.border);
      case "table": {
        // Auto layout, like a browser's: every column gets at least its longest
        // word (min) and shares the rest by content length (max). If even the
        // mins don't fit, only the widest columns give way. No text measuring
        // here, so widths are estimated from a monospace advance (0.6em) and padded.
        const ch = SIZE.body * 0.62, padX = 24 + 6, cells = c => [tok.header[c], ...tok.rows.map(r => r[c])].map(x => plain(x?.tokens) || x?.text || "");
        const cols = tok.header.map((_h, c) => cells(c));
        const min = cols.map(xs => padX + ch * Math.max(1, ...xs.flatMap(s => s.split(/\s+/).map(w => [...w].length))));
        const max = cols.map((xs, c) => Math.max(min[c], padX + ch * Math.max(...xs.map(s => [...s.trim()].length))));
        const avail = this.colW - 2, sum = a => a.reduce((x, y) => x + y, 0);
        let weight;
        if (sum(max) <= avail) weight = max;
        else if (sum(min) <= avail) weight = min.map((m, c) => m + (max[c] - m) * (avail - sum(min)) / (sum(max) - sum(min)));
        else {
          // Cap the widest columns at the level where the total just fits.
          const sorted = [...min].sort((a, b) => a - b);
          let cap = avail / min.length;
          for (let k = 0, rest = avail; k < sorted.length; k++) {
            if (sorted[k] * (sorted.length - k) > rest) { cap = rest / (sorted.length - k); break; }
            rest -= sorted[k];
          }
          weight = min.map(m => Math.min(m, cap));
        }
        const cell = (c, j, key) => div().w(0).flex_grow(weight[j]).min_w(0).px(12).py(7)
          .when(tok.align[j] === "right", el => el.text_right()).when(tok.align[j] === "center", el => el.text_center())
          .child(this.inline(key, c.text));
        const hasHeader = tok.header.some(h => h.text.trim());
        return v_flex().my(8).rounded(8).overflow_hidden().border_1().border_color(t.border)
          .when(hasHeader, el => el.child(h_flex().bg(t.surface).font_semibold().text_color(t.ansi4).children(tok.header.map((h, j) => cell(h, j, `${id}-h${j}`)))))
          .children(tok.rows.map((row, r) => h_flex().when(r > 0 || hasHeader, el => el.border_t(1).border_color(t.border))
            .when(r % 2 === 1, el => el.bg(t.canvas))
            .children(row.map((c, j) => cell(c, j, `${id}-${r}-${j}`)))));
      }
      case "html":
        return div().py(2).text_size(13).text_color(t.dim).child(tok.raw.trim());
      case "space":
        return div();
      default:
        return div().py(4).text_color(t.dim).child(this.inline(id, tok.raw?.trim() ?? ""));
    }
  }

  // One top-level block, measured, with its highlight tint and note.
  row(tok, i, t) {
    if (this.hidden[i]) return div();
    const m = this.marks?.get(i);
    const hit = this.matches.includes(i), current = hit && this.matches[this.mi] === i;
    const color = m ? ({ green: t.ansi2, red: t.ansi1, blue: t.ansi4, purple: t.ansi5, cyan: t.ansi6 }[m.color] ?? t.ansi3) : null;
    const [a, b] = this.range(), sel = this.anchor !== null && i >= a && i <= b, cur = i === this.cursor;
    const picked = this.picked && i >= this.picked[0] && i <= this.picked[1];
    // Line number lined up with the block's first line of text.
    const fs = tok.type === "heading" ? SIZE[`h${tok.depth}`] : SIZE.body;
    const pad = tok.type === "heading" ? (tok.depth <= 2 ? 22 : 14) : { paragraph: 5, listitem: 2, code: 8, table: 8, blockquote: 8 }[tok.type] ?? 4;
    const numTop = pad + (tok.type === "code" ? 2 : (fs * 1.65 - 19) / 2);
    const changed = this.changed.has(i), gone = this.removed.get(i);
    return v_flex().id(`row-${i}`).relative()
      .on_mouse_down("left", (_e, cx) => { this.cursor = i; this.handle.focus(); cx.notify(); })
      .when(Boolean(gone), el => el.child(this.removedMark(gone, t)))
      .when(Boolean(picked) && i === this.picked[0], el => el.child(h_flex().mb(2).gap(6).items_center().text_size(11).text_color(t.ansi4)
        .child(div().child("📌 Pinned for Claude")).child(div().text_color(t.dim).child("· Esc unpins"))))
      .when(changed, el => el.child(div().absolute().left(-12).top(gone ? 26 : 4).bottom(4).w(3).rounded(2).bg(t.ansi2)))
      .when(this.numbers, el => el.child(div().absolute().left(-PAD - 4).top(numTop).w(PAD - 14).text_right().font_family(BODY()).text_size(12).line_height(1.6)
        .text_color(cur ? t.accent : t.dim).when(cur, el => el.font_semibold()).child(String(tok.from))))
      .on_size_change((size, cx) => { if (this.heights[i] !== size.height / Z()) { this.heights[i] = size.height / Z(); this.reaim(); cx.notify(); } })
      .child(div().px(14).mx(-14).rounded(6)
        .when(Boolean(m), el => el.bg(color + "1f").border_l(3).border_color(color))
        .when(Boolean(picked) && !m, el => el.bg(t.ansi4 + "1c").border_l(3).border_color(t.ansi4))
        .when(sel, el => el.bg(t.selection))
        .when(cur && !sel, el => el.bg(t.hover).border_l(3).border_color(t.accent))
        .when(!m && hit, el => el.bg(t.accent + (current ? "2e" : "12")).when(current, el => el.border_l(3).border_color(t.accent)))
        .child(this.block(tok, i, t)))
      .when(Boolean(m?.note) && m?.last, el => el.child(
        h_flex().mt(6).mb(10).gap(10).items_start().px(14).py(10).rounded(8).bg(t.surface).border_1().border_color(color)
          .opacity(this.noteAlpha).transition("opacity", { duration: 280, easing: "ease-out" })
          .child(div().flex_none().text_size(12).font_semibold().text_color(color).child(`✦ Claude${this.notes.highlights.length > 1 ? ` ${m.k + 1}` : ""}`))
          .child(div().flex_1().min_w(0).text_size(14).child(this.typed === Infinity
            ? this.inline(`note-${i}`, m.note)
            : div().child(plainNote(m.note).slice(0, this.typed) + "▍")))));
  }

  removedMark(n, t) {
    return h_flex().gap(8).items_center().py(2).text_size(11).text_color(t.ansi1)
      .child(div().w(10).h(1).bg(t.ansi1)).child(div().child(`${n} block${n === 1 ? "" : "s"} removed`)).child(div().flex_1().h(1).bg(t.ansi1 + "55"));
  }

  // Enter: fold a heading, or follow the first link in the block.
  activate(cx) {
    const b = this.blocks[this.cursor]; if (!b) return;
    if (b.type === "heading") { this.toggleFold(this.cursor); return cx.notify(); }
    const m = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/.exec(b.raw);
    if (m) return this.follow(m[1], cx);
    this.flash = "Enter: fold a heading or follow a link · p pins for Claude"; cx.notify();
  }

  // ---- outline ----
  headings() { return this.blocks.map((b, i) => b.type === "heading" ? i : -1).filter(i => i >= 0); }

  outlinePanel(t) {
    const hs = this.headings(), cur = this.sectionOf(this.cursor);
    return v_flex().id("md-outline").absolute().top(10).left(10).w(340).max_h(Math.max(160, this.viewH - 20)).overflow_y_scrollbar()
      .py(8).rounded(10).bg(t.popover).border_1().border_color(t.input).shadow_md().text_size(13).font_family(BODY())
      .child(div().px(14).pb(6).text_size(11).text_color(t.dim).child("OUTLINE · j/k · Enter · Esc"))
      .children(hs.map((h, k) => {
        const b = this.blocks[h], sel = k === this.oi;
        return div().id(`ol-${h}`).pl(14 + (b.depth - 1) * 14).pr(12).py(3).truncate().cursor_pointer()
          .text_color(sel ? t.foreground : b.depth <= 2 ? t.muted : t.dim).when(b.depth <= 2, el => el.font_semibold())
          .when(sel, el => el.bg(t.selected)).when(h === cur && !sel, el => el.text_color(t.accent))
          .hover(s => s.bg(t.hover))
          .on_click((_e, cx) => { this.outline = false; this.cursor = h; this.aimAt(h); this.handle.focus(); cx.notify(); })
          .child(plain(b.tokens));
      }));
  }

  // ---- key help (? or h) ----
  // Fades and drifts in; any key fades it out, then it unmounts.
  openHelp(cx) {
    this.help = true; this.helpIn = 0; cx.notify();
    cx.timer.after(16, cx => { this.helpIn = 1; cx.notify(); });
  }

  closeHelp(cx) {
    this.helpIn = 0; cx.notify();
    cx.timer.after(180, cx => { if (!this.helpIn) { this.help = false; cx.notify(); } });
  }

  helpPanel(t) {
    const key = k => div().px(6).rounded(4).bg(t.surface).border_1().border_color(t.border).text_color(t.foreground).child(k);
    const w = Math.min(720, Math.max(280, this.colW + PAD * 2 - 40));
    return h_flex().id("md-help-wrap").absolute().left(0).w_full().justify_center().top(this.helpIn ? 18 : 30)
      .opacity(this.helpIn).transition("opacity", { duration: 180, easing: "ease-out" }).transition("top", { duration: 220, easing: "ease-out" })
      .child(v_flex().id("md-help").w(w).max_h(Math.max(160, this.viewH - 36)).overflow_y_scrollbar()
        .py(10).rounded(10).bg(t.popover).border_1().border_color(t.input).shadow_md().text_size(13).font_family(BODY())
        .child(div().px(16).pb(8).text_size(11).text_color(t.dim).child("KEYS · any key closes"))
        .child(h_flex().flex_wrap().items_start().children(HELP.map(col => v_flex().flex_1().min_w(320)
          .children(col.map(([section, rows]) => v_flex().px(16).pb(8)
            .child(div().pb(2).text_size(11).font_semibold().text_color(t.accent).child(section))
            .children(rows.map(([keys, what]) => h_flex().gap(10).items_center().py(1)
              .child(h_flex().w(118).flex_none().gap(4).text_size(12).children(keys.split(" ").map(key)))
              .child(div().flex_1().min_w(0).text_color(t.muted).child(what))))))))));
  }

  // ---- cursor ----
  yOf(i) { let y = TOP; for (let j = 0; j < i; j++) if (!this.hidden[j]) y += this.heights[j] ?? 0; return y; }

  move(i, d) { let j = i; for (;;) { const n = j + d; if (n < 0 || n >= this.blocks.length) return j; j = n; if (!this.hidden[j]) return j; } }

  // The first block on screen, for when the cursor was scrolled away from.
  firstOnScreen() {
    let y = TOP;
    for (let i = 0; i < this.blocks.length; i++) { if (this.hidden[i]) continue; const h = this.heights[i] ?? 0; if (y + h > this.offset + 10) return i; y += h; }
    return 0;
  }

  onScreen(i) { const y = this.yOf(i), h = this.heights[i] ?? 0; return y + h > this.offset && y < this.offset + this.viewH; }

  setCursor(i, cx, center) {
    this.cursor = Math.max(0, Math.min(i, this.blocks.length - 1)); this.aim = null;
    const y = this.yOf(this.cursor), h = this.heights[this.cursor] ?? 0, m = 60, from = this.offset;
    if (center) this.offset = this.clamp(y + h / 2 - this.viewH / 2);
    else if (y < this.offset + m || h > this.viewH - 2 * m) this.offset = this.clamp(y - m);
    else if (y + h > this.offset + this.viewH - m) this.offset = this.clamp(y + h - this.viewH + m);
    this.motion = Math.abs(this.offset - from) > this.viewH / 2 ? GLIDE : STEP;
    cx.notify();
  }

  // Move by about `px` pixels of content, block by block.
  moveBy(px, cx) {
    let i = this.cursor, gone = 0; const d = Math.sign(px);
    while (gone < Math.abs(px)) { const n = this.move(i, d); if (n === i) break; gone += this.heights[d > 0 ? i : n] ?? 40; i = n; }
    this.offset = this.clamp(this.offset + px); this.setCursor(i, cx); this.motion = 200;
  }

  heading(d) { let i = this.cursor; for (;;) { const n = this.move(i, d); if (n === i) return i; i = n; if (this.blocks[i].type === "heading") return i; } }

  range() { const a = this.anchor ?? this.cursor; return [Math.min(a, this.cursor), Math.max(a, this.cursor)]; }

  // Source lines and text of the current selection (or the cursor block).
  selection() {
    const [a, b] = this.range(), from = this.blocks[a].from, to = this.blocks[b].to;
    return { file: this.file, lines: [from, to], text: this.src.split("\n").slice(from - 1, to).join("\n") };
  }

  yank() { const { text } = this.selection(); exec("sh", ["-c", 'printf %s "$1" | LANG=en_US.UTF-8 pbcopy', "yank", text]); this.flash = "copied"; }

  // Pin the selection for Claude: `mdh sel` prints it.
  share() {
    const sel = this.selection();
    this.picked = this.range();
    exec("sh", ["-c", 'mkdir -p "$1" && printf %s "$2" > "$1/selection.json"', "share", NOTES(), JSON.stringify({ ...sel, at: new Date().toISOString() })]);
    this.flash = `📌 pinned lines ${sel.lines[0]}–${sel.lines[1]} for Claude · ask it about "this" · Esc unpins`;
  }

  keys(e, cx) {
    if (this.typing) {
      if (e.key === "escape") { this.closeSearch(cx); cx.stop_propagation(); }
      return;
    }
    const mod = e.modifiers ?? {};
    if (mod.platform || mod.alt) return;
    if (this.help) { if (!MODIFIER_KEYS.includes(e.key)) this.closeHelp(cx); return cx.stop_propagation(); }
    const k = mod.shift && e.key.length === 1 ? (e.key_char ?? e.key.toUpperCase()) : e.key;
    const half = Math.max(80, this.viewH / 2), page = Math.max(100, this.viewH - 80);
    if (this.outline) {
      const hs = this.headings();
      if (e.key === "j" || e.key === "down") this.oi = Math.min(this.oi + 1, hs.length - 1);
      else if (e.key === "k" || e.key === "up") this.oi = Math.max(this.oi - 1, 0);
      else if (e.key === "enter") { this.outline = false; if (hs[this.oi] !== undefined) { this.cursor = hs[this.oi]; this.aimAt(hs[this.oi]); } }
      else if (e.key === "escape" || e.key === "o") this.outline = false;
      return cx.notify();
    }
    this.flash = null;
    if (mod.control) {
      // ctrl-e / ctrl-y: scroll the view a line (40px) without moving the cursor, as in vim.
      if (e.key === "e" || e.key === "y") { this.scrollBy(e.key === "e" ? 40 : -40, cx); this.motion = STEP; return cx.stop_propagation(); }
      const c = { d: half, u: -half, f: page, b: -page }[e.key];
      if (c) { this.moveBy(c, cx); cx.stop_propagation(); }
      return;
    }
    // Pull the cursor back on screen if the wheel scrolled it away.
    if (!this.onScreen(this.cursor) && ["j", "k", "down", "up", "V", "v", "y", "enter"].includes(k)) this.cursor = this.firstOnScreen();
    if (/^[0-9]$/.test(k) && (this.count || k !== "0")) { this.count += k; return; }
    const n = Math.max(1, parseInt(this.count || "1", 10)); this.count = "";
    const p = this.pending; this.pending = "";
    if (p === "g") { if (k === "g") this.setCursor(this.move(-1, 1), cx); return; }
    if (p === "z") {
      const h = this.blocks[this.cursor]?.type === "heading" ? this.cursor : this.sectionOf(this.cursor);
      if (k === "z") this.setCursor(this.cursor, cx, true);
      if (k === "a" && h !== null) { this.toggleFold(h); this.setCursor(h, cx); }
      if (k === "c" && h !== null) { this.folded.add(h); this.refold(); this.setCursor(h, cx); }
      if (k === "o" && h !== null) { this.folded.delete(h); this.refold(); cx.notify(); }
      if (k === "M") { this.blocks.forEach((b, i) => { if (b.type === "heading" && b.depth >= 2) this.folded.add(i); }); this.refold(); this.setCursor(this.hidden[this.cursor] ? this.sectionOf(this.cursor) ?? 0 : this.cursor, cx); }
      if (k === "R") { this.folded.clear(); this.refold(); cx.notify(); }
      return;
    }
    let to = null;
    switch (k) {
      case "j": case "down": to = this.cursor; for (let x = 0; x < n; x++) to = this.move(to, 1); break;
      case "k": case "up": to = this.cursor; for (let x = 0; x < n; x++) to = this.move(to, -1); break;
      case "d": return this.moveBy(half, cx);
      case "u": return this.moveBy(-half, cx);
      case "space": case "pagedown": return this.moveBy(page, cx);
      case "pageup": return this.moveBy(-page, cx);
      case "G": to = this.move(this.blocks.length, -1); break;
      case "}": to = this.heading(1); break;
      case "{": to = this.heading(-1); break;
      case "]": return this.stepChange(1, cx);
      case "[": return this.stepChange(-1, cx);
      case "c": this.changed = new Set(); this.removed = new Map(); return cx.notify();
      case "o": { const hs = this.headings(), cur = this.sectionOf(this.cursor); this.oi = Math.max(0, hs.indexOf(cur)); this.outline = true; return cx.notify(); }
      case "backspace": return this.back(cx);
      case "g": case "z": this.pending = k; return;
      case "V": case "v": this.anchor = this.anchor === null ? this.cursor : null; return cx.notify();
      case "y": this.yank(); this.anchor = null; return cx.notify();
      case "p": this.share(); this.anchor = null; return cx.notify();
      case "enter": return this.activate(cx);
      case "escape":
        if (this.anchor !== null) this.anchor = null;
        else if (this.searching) return this.closeSearch(cx);
        else { this.picked = null; exec("rm", ["-f", `${NOTES()}/selection.json`]); }
        return cx.notify();
      case "#": this.numbers = !this.numbers; return cx.notify();
      case "/": return this.openSearch(cx);
      case "?": case "h": return this.openHelp(cx);
      case "q": { const me = panes().find(p => p.focused && p.mod === MOD); if (me) run("pane.close", { pane: me.pane }); return; }
      case "n": case "N": {
        if (this.matches.length) { this.step(k === "n" ? 1 : -1); this.cursor = this.matches[this.mi]; return cx.notify(); }
        const c = this.notes.highlights.length; if (!c) return;
        this.cur = ((this.cur ?? -1) + (k === "n" ? 1 : c - 1)) % c;
        const i = this.notes.highlights[this.cur]?.blocks?.[0]; if (i !== undefined) { this.aimAt(i); this.cursor = i; }
        return cx.notify();
      }
    }
    if (to !== null) this.setCursor(to, cx);
  }

  // The heading whose section holds block i.
  sectionOf(i) { for (let j = Math.min(i, this.blocks.length - 1); j >= 0; j--) if (this.blocks[j]?.type === "heading") return j; return null; }

  render(cx) {
    const t = theme();
    const thumbH = this.contentH > this.viewH ? Math.max(30, this.viewH * this.viewH / this.contentH) : 0;
    const thumbY = thumbH ? (this.viewH - thumbH) * this.offset / (this.contentH - this.viewH) : 0;
    return v_flex().id("md").size_full().min_h(0).bg(t.background).text_color(t.foreground)
      .track_focus(this.handle).on_key_down((e, cx) => this.keys(e, cx))
      .child(this.headerBar(t))
      .child(div().id("md-view").flex_1().min_h(0).relative().overflow_hidden()
        .on_size_change((size, cx) => { this.viewH = size.height / Z(); this.offset = this.clamp(this.offset); this.reaim(); cx.notify(); })
        .on_scroll_wheel((e, cx) => this.scrollBy(-e.delta.y / Z(), cx))
        .child(div().id("md-content").absolute().left(0).w_full().top(-this.offset)
          .transition("top", { duration: this.motion, easing: this.motion === GLIDE ? "ease-in-out" : "ease-out" })
          .on_size_change((size, cx) => { this.contentH = size.height / Z(); this.reaim(); cx.notify(); })
          .child(h_flex().w_full().justify_center()
            .child(v_flex().id("md-col").w_full().max_w(MAX_W).px(PAD).pt(TOP).pb(80)
              .on_size_change((size, cx) => { const w = Math.max(120, size.width / Z() - PAD * 2); if (Math.abs(w - this.colW) > 1) { this.colW = w; cx.notify(); } }).font_family(BODY()).text_size(SIZE.body).line_height(1.65)
              .when(Boolean(this.error), el => el.child(div().text_color(t.blocked).child(this.error)))
              .children(this.blocks.map((tok, i) => this.row(tok, i, t)))
              .when(this.removed.has(this.blocks.length), el => el.child(this.removedMark(this.removed.get(this.blocks.length), t))))))
        .when(thumbH > 0, el => el.child(div().absolute().right(3).w(6).rounded(3).bg(t.border).top(thumbY).h(thumbH).transition("top", { duration: this.motion, easing: "ease-out" })))
        .when(this.outline, el => el.child(this.outlinePanel(t)))
        .when(this.help, el => el.child(this.helpPanel(t)))
        .when(this.searching, el => el.child(h_flex().absolute().top(10).right(20).w(340).h(38).px(10).gap(8).items_center()
          .rounded(10).bg(t.popover).border_1().border_color(this.typing ? t.accent : t.input).shadow_md()
          .child(div().text_color(t.dim).text_size(14).child("⌕"))
          .child(Input.new(this.input).flex_1().h(30).text_size(14).text_color(t.foreground).font_family(BODY()))
          .child(div().text_size(12).text_color(this.query && !this.matches.length ? t.blocked : t.dim)
            .child(this.query ? (this.matches.length ? `${this.mi + 1}/${this.matches.length}` : "none") : ""))
          .child(div().id("md-search-close").px(4).cursor_pointer().text_color(t.dim).hover(s => s.text_color(t.foreground))
            .on_click((_e, cx) => this.closeSearch(cx)).child("✕")))))
      .child(this.statusBar(t));
  }

  // Top: where you are. The file (home shortened), and a crumb back after a link.
  headerBar(t) {
    const path = (this.file ?? "").replace(home(), "~"), name = path.split("/").pop(), dir = path.slice(0, path.length - name.length);
    const prev = this.history.length ? this.history[this.history.length - 1].file.split("/").pop() : null;
    return h_flex().h(30).flex_none().px(14).gap(10).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(12)
      .when(Boolean(prev), el => el.child(div().id("md-back").px(6).rounded(4).cursor_pointer().text_color(t.accent).hover(s => s.bg(t.hover))
        .on_click((_e, cx) => this.back(cx)).child(`← ${prev}`)))
      .child(h_flex().flex_1().min_w(0).items_center().child(div().truncate().text_color(t.dim).child(dir)).child(div().flex_none().text_color(t.foreground).font_semibold().child(name)))
      .when(this.changed.size > 0, el => el.child(div().px(8).rounded(4).bg(t.ansi2 + "22").text_color(t.ansi2).child(`${this.changed.size} changed`)));
  }

  // Bottom: a vim-style status line. Mode and messages left; section, line and progress right.
  statusBar(t) {
    const b = this.blocks[this.cursor], lines = (this.src.match(/\n/g)?.length ?? 0) + 1;
    const pct = this.contentH <= this.viewH ? 100 : Math.round(100 * this.offset / (this.contentH - this.viewH));
    const sec = this.sectionOf(this.cursor), secName = sec !== null ? plain(this.blocks[sec].tokens) : "";
    const mode = this.anchor !== null ? "VISUAL" : this.searching ? "SEARCH" : this.outline ? "OUTLINE" : "NORMAL";
    return h_flex().h(24).flex_none().px(10).gap(10).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.5).font_family(BODY())
      .child(div().px(6).rounded(3).font_semibold().bg(mode === "NORMAL" ? t.surface : t.accent).text_color(mode === "NORMAL" ? t.muted : t.accent_foreground).child(mode))
      .when(Boolean(this.pending || this.count), el => el.child(div().text_color(t.dim).child(this.count + this.pending)))
      .child(div().flex_1().min_w(0).truncate().text_color(t.ansi2).child(this.flash ?? ""))
      .when(Boolean(secName), el => el.child(div().max_w(220).truncate().text_color(t.dim).child(`§ ${secName}`)))
      .when(Boolean(b), el => el.child(div().text_color(t.muted).child(`L${b.from}/${lines}`)))
      .child(div().w(36).text_right().text_color(t.muted).child(pct <= 0 ? "Top" : pct >= 100 ? "Bot" : `${pct}%`));
  }
}
