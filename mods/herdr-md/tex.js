// Inline $…$ math as Unicode text. TextView can't put an image mid-sentence,
// so inline formulas become readable Unicode (x², ŷ, ∑ᵢ, α ≤ β) instead.
const SYM = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ",
  upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠",
  approx: "≈", sim: "∼", equiv: "≡", propto: "∝", infty: "∞", sum: "∑", prod: "∏", int: "∫", partial: "∂",
  nabla: "∇", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅",
  forall: "∀", exists: "∃", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftrightarrow: "⇔",
  mapsto: "↦", top: "ᵀ", ldots: "…", cdots: "⋯", dots: "…", mid: "∣", ell: "ℓ", log: "log", exp: "exp",
  max: "max", min: "min", arg: "arg", lim: "lim", sqrt: "√", quad: " ", qquad: "  ", ",": " ", ";": " ", "!": "",
  mathbb: "", R: "ℝ", N: "ℕ", Z: "ℤ",
};
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", T: "ᵀ", "ᵀ": "ᵀ", t: "ᵗ", k: "ᵏ", d: "ᵈ", j: "ʲ", x: "ˣ", "*": "*", "′": "′",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", e: "ᵉ", h: "ʰ", l: "ˡ", m: "ᵐ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", u: "ᵘ", v: "ᵛ", w: "ʷ", y: "ʸ", z: "ᶻ" };
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", i: "ᵢ", j: "ⱼ", k: "ₖ", n: "ₙ", t: "ₜ", d: "d", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", m: "ₘ", l: "ₗ", s: "ₛ", p: "ₚ", r: "ᵣ" };
const ACCENT = { hat: "̂", bar: "̄", tilde: "̃", vec: "⃗", dot: "̇", overline: "̅" };

// One {…} group or a single token, from position i.
function group(s, i) {
  if (s[i] === "{") { let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } return [s.slice(i + 1, j), j + 1]; }
  if (s[i] === "\\") { const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/); return [m[0], i + m[0].length]; }
  return [s[i] ?? "", i + 1];
}

const script = (t, map, mark) => [...t].every(c => map[c]) ? [...t].map(c => map[c]).join("") : `${mark}(${t})`;

export function texToUnicode(src) {
  let s = src, out = "", i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/), name = m[1]; i += m[0].length;
      if (name === "frac") { const [a, j] = group(s, i); const [b, k] = group(s, j); i = k; out += `${wrap(texToUnicode(a))}/${wrap(texToUnicode(b))}`; continue; }
      if (ACCENT[name]) { const [a, j] = group(s, i); i = j; const t = texToUnicode(a); out += t.length === 1 ? t + ACCENT[name] : `${t}${ACCENT[name]}`; continue; }
      if (/^(mathbf|mathrm|textrm|text|mathit|operatorname|boldsymbol|mathcal|textbf|left|right|big|Big)$/.test(name)) {
        if (/^(left|right|big|Big)$/.test(name)) continue;
        const [a, j] = group(s, i); i = j; out += texToUnicode(a); continue;
      }
      if (name === "sqrt") { const [a, j] = group(s, i); i = j; out += `√${wrap(texToUnicode(a))}`; continue; }
      out += SYM[name] ?? name; continue;
    }
    if (c === "^" || c === "_") { const [a, j] = group(s, i + 1); i = j; out += script(texToUnicode(a), c === "^" ? SUP : SUB, c); continue; }
    if (c === "{" || c === "}") { i++; continue; }
    out += c; i++;
  }
  return out.replace(/\s+/g, " ").trim();
}

const wrap = t => t.length > 1 && /[^\w′]/.test(t) ? `(${t})` : t;

// Replace inline $…$ in a markdown paragraph. Pandoc's rule keeps prices like
// "$5 and $10" as text: no space just inside the dollars, no digit right after.
export function inlineMath(md) {
  return md.replace(/(^|[^\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, pre, tex) => `${pre}*${texToUnicode(tex).replace(/[*_]/g, "\\$&")}*`);
}
