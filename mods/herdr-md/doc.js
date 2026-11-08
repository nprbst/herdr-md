// Document helpers for the viewer: what changed between two versions,
// heading anchors, d2l-book labels and references, GitHub-style callouts.

export function hash(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

// Block-level diff (LCS over block hashes). Returns
// { changed: Set<new index>, removed: Map<new index, count removed just before it> }.
// Blocks with no counterpart in the old version count as changed: new or edited.
export function diffBlocks(oldHashes, newHashes) {
  const n = oldHashes.length, m = newHashes.length;
  const changed = new Set(), removed = new Map();
  if (!n) return { changed, removed };              // nothing seen before: nothing to mark
  if (n * m > 4e6) return { changed, removed };      // huge documents: skip rather than stall
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = oldHashes[i] === newHashes[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, gone = 0;
  while (i < n || j < m) {
    if (i < n && j < m && oldHashes[i] === newHashes[j]) { if (gone) { removed.set(j, gone); gone = 0; } i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { changed.add(j); j++; }
    else { gone++; i++; }
  }
  if (gone) removed.set(m, gone);
  // A removal right where a block changed is an edit, not a separate removal.
  for (const [at, count] of removed) if (changed.has(at) || changed.has(at - 1)) removed.delete(at);
  return { changed, removed };
}

// GitHub's heading anchors: lowercase, drop punctuation, spaces to hyphens.
export function slug(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "-");
}

// d2l-book roles. A paragraph that is only `:label:`x`` or `:eqlabel:`x`` names
// the block before it; returns the name, or null.
export function labelOf(tok) {
  if (tok.type !== "paragraph") return null;
  const m = /^:(eq)?label:`([^`]+)`\s*$/.exec(tok.raw.trim());
  return m ? { name: m[2], eq: Boolean(m[1]) } : null;
}

// Inline roles → markdown links the viewer handles (#label:name), or plain text.
export function inlineRoles(md, labels) {
  return md.replace(/:(eqref|numref|ref|cite|citet|citep):`([^`]+)`/g, (_, role, name) => {
    if (role.startsWith("cit")) return `[${name}]`;
    const l = labels.get(name);
    const text = role === "eqref" ? `(${l?.num ?? "?"})` : l?.title ?? name;
    return `[${text}](#label:${encodeURIComponent(name)})`;
  });
}

// GitHub alerts: a blockquote whose first line is [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION].
export const ALERTS = {
  NOTE: { icon: "ⓘ", title: "Note", color: "ansi4" },
  TIP: { icon: "✦", title: "Tip", color: "ansi2" },
  IMPORTANT: { icon: "❖", title: "Important", color: "ansi5" },
  WARNING: { icon: "⚠", title: "Warning", color: "ansi3" },
  CAUTION: { icon: "⛔", title: "Caution", color: "ansi1" },
};
export function alertOf(tok) {
  if (tok.type !== "blockquote") return null;
  const m = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/i.exec(tok.raw);
  if (!m) return null;
  const body = tok.raw.slice(m[0].length).split("\n").map(l => l.replace(/^>\s?/, "")).join("\n").trim();
  return { kind: m[1].toUpperCase(), body };
}
