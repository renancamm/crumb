/**
 * Tiny, build-time YAML → HTML highlighter for the landing page's "it's just
 * text" block. Deliberately minimal (keys / values / list dashes / comments) and
 * monochrome by design — colour on the landing page comes only from the map.
 * No dependency; see the no-deps rule in LANDING_PAGE.md.
 *
 * Token classes (styled in landing-css.ts): yml-k (key), yml-v (value),
 * yml-c (comment), yml-p (punctuation: dashes/colons).
 */

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function highlightValue(val: string): string {
  // Peel a trailing inline comment ("  # ...") off the value.
  const c = val.match(/^(.*?)(\s+#.*)$/)
  if (c) return highlightValue(c[1]) + `<span class="yml-c">${esc(c[2])}</span>`
  return `<span class="yml-v">${esc(val)}</span>`
}

function highlightLine(line: string): string {
  // Whole-line comment.
  const cm = line.match(/^(\s*)(#.*)$/)
  if (cm) return esc(cm[1]) + `<span class="yml-c">${esc(cm[2])}</span>`

  const lm = line.match(/^(\s*)(- )?(.*)$/)
  if (!lm) return esc(line)
  const [, indent, dash, rest] = lm

  let out = esc(indent)
  if (dash) out += `<span class="yml-p">- </span>`

  // "key:" or "key: value"
  const kv = rest.match(/^([^:#]+):(\s*)(.*)$/)
  if (kv) {
    const [, key, sp, val] = kv
    out += `<span class="yml-k">${esc(key)}</span><span class="yml-p">:</span>${esc(sp)}`
    if (val) out += highlightValue(val)
  } else if (rest) {
    out += highlightValue(rest)
  }
  return out
}

export function highlightYaml(src: string): string {
  const lines = src.replace(/\s+$/, "").split("\n")
  const out: string[] = []
  let blockIndent: number | null = null   // key column of an open block scalar (note: | / >)

  for (const line of lines) {
    const indent = /^[ \t]*/.exec(line)![0].length

    if (blockIndent !== null) {
      // Body of a block scalar: markdown/prose, not YAML — render as a plain string.
      if (line.trim() === "" || indent > blockIndent) {
        out.push(`<span class="yml-s">${esc(line)}</span>`)
        continue
      }
      blockIndent = null   // dedented out of the block; parse this line normally
    }

    out.push(highlightLine(line))

    // Did this line open a block scalar ("key: |" / "key: >", optional chomp/indent)?
    const opener = /^([ \t]*)(- )?[^:#]+:[ \t]*[|>][+-]?\d*[ \t]*$/.exec(line)
    if (opener) blockIndent = opener[1].length + (opener[2] ? opener[2].length : 0)
  }

  return out.join("\n")
}
