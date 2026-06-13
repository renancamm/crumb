import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { renderDoc, DOCS } from "../src/renderer/markdown"
import { parse } from "../src/parser"

// Anti-drift guard for the generated docs page (docs.html). The spec/*.md files are
// the single source of truth; build-site.ts renders them with renderDoc(). These
// tests catch the failure mode that source-of-truth generation alone can't: a
// renamed heading that silently breaks an in-page anchor or cross-doc link.

const root = resolve(__dirname, "..")

const rendered = DOCS.map(d => {
  const src = readFileSync(resolve(root, d.file), "utf8")
  return { ...d, src, ...renderDoc(src, d.id) }
})

// Every anchor the combined page exposes: section container ids + heading ids.
const ids = new Set<string>(DOCS.map(d => d.id))
for (const r of rendered)
  for (const m of r.html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1])

describe("docs sources — every registered doc exists and renders", () => {
  for (const d of DOCS) {
    it(`${d.file} exists`, () => {
      expect(existsSync(resolve(root, d.file)), `missing ${d.file}`).toBe(true)
    })
    it(`${d.id} has sidebar/header metadata`, () => {
      // The docs-page chrome (header + grouped sidebar) is driven by these — a doc
      // added without them would render a blank kicker/description.
      expect(d.kicker.trim().length, `${d.id} missing kicker`).toBeGreaterThan(0)
      expect(d.description.trim().length, `${d.id} missing description`).toBeGreaterThan(0)
    })
  }
  for (const r of rendered) {
    it(`${r.id} renders to non-empty HTML with its title H1 stripped`, () => {
      // (Some docs — e.g. the Data Model — are a single section with no H2/H3, so
      // an empty TOC is valid; the sidebar entry simply doesn't expand.)
      expect(r.html.length).toBeGreaterThan(0)
      expect(Array.isArray(r.toc)).toBe(true)
      // The header chrome owns the title, so the source's leading H1 must be gone.
      expect(r.html, `${r.file}: leading H1 should be stripped`).not.toContain("<h1")
    })
  }
})

describe("docs links — every in-page anchor resolves to a real id", () => {
  for (const r of rendered) {
    it(`${r.id}: internal links all point at existing anchors`, () => {
      const targets = [...r.html.matchAll(/href="#([^"]+)"/g)].map(m => m[1])
      const broken  = targets.filter(t => !ids.has(t))
      expect(broken, `dangling anchors in ${r.file}: ${broken.join(", ")}`).toEqual([])
    })
  }

  it("no cross-doc .md link survives un-rewritten", () => {
    const stray = rendered.flatMap(r =>
      [...r.html.matchAll(/href="([^"]*\.md(?:#[^"]*)?)"/g)].map(m => `${r.id} → ${m[1]}`))
    expect(stray, "links to .md files should be rewritten to in-page anchors").toEqual([])
  })
})

// A ```crumb fenced block is a COMPLETE example and must parse — distinct from
// ```yaml, which the spec uses freely for partial fragments. This guards authored
// docs (e.g. overview.md) against invented fields/syntax drifting from the format.
describe("docs examples — every ```crumb block is valid Crumb", () => {
  const blocks = DOCS.flatMap(d => {
    const src = readFileSync(resolve(root, d.file), "utf8")
    return [...src.matchAll(/```crumb\n([\s\S]*?)```/g)].map((m, i) => ({ file: d.file, i, body: m[1] }))
  })
  it("has at least one ```crumb example to validate", () => {
    expect(blocks.length).toBeGreaterThan(0)
  })
  for (const b of blocks) {
    it(`${b.file} crumb block #${b.i + 1} parses`, () => {
      expect(() => parse(b.body)).not.toThrow()
    })
  }
})
