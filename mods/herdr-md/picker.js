// The ctrl-p file picker's logic, kept free of Herdr APIs so node can test it:
// which markdown files to offer, the recently-opened list, and fuzzy matching.

// At most this many files are listed; a folder (no git) is searched this deep.
export const MAX_FILES = 5000, FIND_DEPTH = 4, MAX_RECENT = 100;
const MD = /\.(md|markdown)$/i;
// Folders never worth listing, even when git doesn't ignore them.
const SKIP = new Set(["node_modules", ".git", ".cache"]);
const skipped = rel => rel.split("/").some(part => SKIP.has(part));

const depth = p => p.split("/").length;
const byDepth = (a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0);

// "/a/b/c" + "../../x" → "/a/x" (no symlink resolution: keeps the person's spelling).
export function join(dir, rel) {
  const out = [];
  for (const part of `${dir}/${rel}`.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop(); else out.push(part);
  }
  return "/" + out.join("/");
}

// Markdown files under the git work tree holding `dir` (tracked plus untracked,
// not ignored), else under `dir` itself, FIND_DEPTH levels deep. Every path goes
// to git/find as its own argument, never through a shell.
// `exec(cmd, args)` resolves to { code, stdout, stderr } (Herdr's exec).
// Returns { root, kind: "git" | "folder", files: [relative paths], total, capped }.
// A document can live in a cloned repo that isn't trusted. Its .git/config may
// name programs git runs on its own (core.fsmonitor runs on ls-files --others),
// so every call turns those off, and git is used only in a work tree the person
// owns (else the folder listing below). Herdr's exec takes no env, so system
// config (GIT_CONFIG_NOSYSTEM) can't be skipped; that file isn't the repo's.
const GIT_SAFE = ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false"];

async function ownedByMe(exec, path) {
  const me = await exec("id", ["-u"]).catch(() => null);
  let st = await exec("stat", ["-f", "%u", path]).catch(() => null);                        // macOS / BSD
  if (!st || st.code !== 0) st = await exec("stat", ["-c", "%u", path]).catch(() => null);   // GNU
  const uid = me?.code === 0 ? me.stdout.trim() : "";
  return Boolean(uid && st?.code === 0 && st.stdout.trim() === uid);
}

export async function listFiles(exec, dir) {
  const top = await exec("git", [...GIT_SAFE, "-C", dir, "rev-parse", "--show-cdup"]).catch(() => null);
  if (top && top.code === 0) {
    const root = join(dir, top.stdout.trim());
    if (await ownedByMe(exec, root)) {
      const r = await exec("git", [...GIT_SAFE, "-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard",
        "--", ":(icase)*.md", ":(icase)*.markdown"]).catch(() => null);
      if (r && r.code === 0) return finish(root, "git", [...new Set(r.stdout.split("\0"))].filter(p => p && MD.test(p) && !skipped(p)));
    }
  }
  const r = await exec("find", [dir, "-maxdepth", String(FIND_DEPTH),
    "(", "-name", "node_modules", "-o", "-name", ".git", "-o", "-name", ".cache", "-o", "-name", "Library", "-o", "-name", ".Trash", ")", "-prune",
    "-o", "-type", "f", "(", "-iname", "*.md", "-o", "-iname", "*.markdown", ")", "-print"]).catch(() => ({ stdout: "" }));
  const base = dir.replace(/\/+$/, "");
  const files = (r.stdout || "").split("\n").filter(p => p.startsWith(base + "/")).map(p => p.slice(base.length + 1));
  return finish(base || "/", "folder", files.filter(p => !skipped(p)));
}

function finish(root, kind, files) {
  files.sort(byDepth);
  return { root, kind, files: files.slice(0, MAX_FILES), total: files.length, capped: files.length > MAX_FILES };
}

// ---- preview source ----
// The preview lexes only the start of a file. marked's lexer grows faster than
// the text in Herdr's QuickJS (a 78 KB note took ~1 s in qjs, and in Herdr ran
// the shared mod runtime out of memory, killing every mod), and the preview
// draws at most a screenful of blocks anyway. Cut at a blank line (a block
// boundary) at or before `max` characters, else a line end, else hard.
export const PV_CHARS = 12000;
export function previewSource(text, max = PV_CHARS) {
  if (text.length <= max) return { text, cut: false };
  const head = text.slice(0, max);
  let at = head.lastIndexOf("\n\n");
  if (at < max / 2) at = head.lastIndexOf("\n");
  if (at < max / 2) at = max;
  return { text: text.slice(0, at), cut: true };
}

// ---- recently opened (~/.cache/herdr-md/recent.json: absolute paths, newest first) ----
export function parseRecent(text) {
  try { const a = JSON.parse(text ?? "[]"); return Array.isArray(a) ? a.filter(x => typeof x === "string") : []; } catch { return []; }
}
export const pushRecent = (list, file) => [file, ...list.filter(f => f !== file)].slice(0, MAX_RECENT);

// ---- fuzzy matching ----
const SEP = /[/_\-. ]/;

// Is every character of `q` (lowercase) in `s`, in order? Finds the first place
// the whole query fits, then walks back from its end for the tightest window
// (fzf's v1). Returns { score, pos } or null. Scores: every hit counts, more at
// the start, after a separator or at a camelCase hump, more for a run of
// consecutive hits; gaps cost a little.
export function fuzzy(q, s) {
  const n = q.length, l = s.toLowerCase();
  if (!n) return { score: 0, pos: [] };
  let j = 0, end = -1;
  for (let i = 0; i < l.length; i++) if (l[i] === q[j] && ++j === n) { end = i; break; }
  if (end < 0) return null;
  const pos = [];
  for (let i = end, k = n - 1; i >= 0 && k >= 0; i--) if (l[i] === q[k]) { pos.push(i); k--; }
  pos.reverse();
  let score = 0, prev = -2;
  for (const p of pos) {
    let b = 16;
    const c = s[p - 1];
    if (p === 0) b += 14;
    else if (c === "/") b += 13;
    else if (SEP.test(c)) b += 11;
    else if (c === c.toLowerCase() && s[p] !== s[p].toLowerCase()) b += 9;
    if (p === prev + 1) b += 10;
    else if (prev >= 0) score -= Math.min(12, 3 + (p - prev - 1));
    score += b; prev = p;
  }
  return { score: score - s.length * 0.05, pos };
}

// Match a query (space-separated terms, all required) against a relative path.
// Each term tries the file name first, then the whole path. `named` counts the
// terms that matched in the file name: it sorts before the score, so a file
// name match always ranks above a match spread over folders.
export function match(query, rel) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const name = rel.slice(rel.lastIndexOf("/") + 1), at = rel.length - name.length;
  let score = 0, named = 0; const pos = new Set();
  for (const term of terms) {
    let m = fuzzy(term, name);
    if (m) {
      named++; score += m.score + (name.toLowerCase().startsWith(term) ? 24 : 0);
      m.pos.forEach(p => pos.add(p + at));
      continue;
    }
    m = fuzzy(term, rel);
    if (!m) return null;
    score += m.score; m.pos.forEach(p => pos.add(p));
  }
  return { score, named, pos: [...pos].sort((a, b) => a - b) };
}

// The picker's list. Empty query: recently opened files first (newest first,
// leaving out `current`, the file on screen), then the rest in listing order
// (shallow first). Otherwise: matches by file-name hits, score, recency, length.
// Returns [{ rel, abs, pos, recent }] (recent: true for an MRU entry), at most `limit`.
export function rank(query, list, recent, current, limit = 500) {
  const abs = rel => `${list.root}/${rel}`;
  const age = new Map(recent.map((f, i) => [f, i]));
  if (!query.trim()) {
    const top = list.files.filter(r => age.has(abs(r)) && abs(r) !== current).sort((a, b) => age.get(abs(a)) - age.get(abs(b)));
    const seen = new Set(top);
    return [...top.map(rel => ({ rel, abs: abs(rel), pos: [], recent: true })),
      ...list.files.filter(r => !seen.has(r)).map(rel => ({ rel, abs: abs(rel), pos: [], recent: false }))].slice(0, limit);
  }
  const out = [];
  for (const rel of list.files) {
    const m = match(query, rel);
    if (m) out.push({ rel, abs: abs(rel), pos: m.pos, named: m.named, score: m.score, recent: age.has(abs(rel)), age: age.get(abs(rel)) ?? Infinity });
  }
  out.sort((a, b) => b.named - a.named || b.score - a.score || a.age - b.age || a.rel.length - b.rel.length);
  return out.slice(0, limit);
}

// A string cut into runs of matched / unmatched characters, for highlighting.
// `pos` holds indexes into the full string; `from` is where `s` starts in it.
export function runs(s, pos, from = 0) {
  const hit = new Set(pos), out = [];
  for (let i = 0; i < s.length; i++) {
    const h = hit.has(i + from);
    if (out.length && out[out.length - 1].hit === h) out[out.length - 1].text += s[i];
    else out.push({ text: s[i], hit: h });
  }
  return out;
}
