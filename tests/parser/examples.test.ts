import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { parse } from "../../src/parser/index"
import type { Place } from "../../src/types/resolved"

const read = (p: string) => readFileSync(resolve(__dirname, "../../", p), "utf8")

// Every shipped example (and snippet) must parse cleanly — a guard for any
// example added later. The examples/ folder is all v2 by design.
describe("every example file parses", () => {
  const examplesDir = resolve(__dirname, "../../examples")
  const cases = [
    ...readdirSync(examplesDir).filter((f) => f.endsWith(".crumb")).map((f) => `examples/${f}`),
    ...readdirSync(resolve(examplesDir, "snippets")).filter((f) => f.endsWith(".crumb")).map((f) => `examples/snippets/${f}`),
  ]
  for (const file of cases) {
    it(`parses ${file}`, () => {
      expect(() => parse(read(file))).not.toThrow()
    })
  }
})

// The v2 example fixtures the parser must handle end-to-end: the kitchen-sink
// snippet (transcluded into the spec docs), the three progressive-detail hero
// tiers, and the full real-world Japan itinerary.
describe("example files parse", () => {
  it("parses the kitchen-sink snippet", () => {
    const doc = parse(read("examples/snippets/kitchen-sink.crumb"))
    expect(doc.itinerary.length).toBeGreaterThan(0)
  })

  for (const f of ["japan-sketch", "japan-planning", "japan-full"]) {
    it(`parses the hero tier: ${f}`, () => {
      const doc = parse(read(`examples/${f}.crumb`))
      const places = doc.itinerary.filter((i) => i.type === "place") as Place[]
      expect(places.map((p) => p.name)).toEqual(["Tokyo", "Kyoto", "Osaka"])
    })
  }

  for (const f of ["lisbon-guide", "copenhagen-weekend", "southeast-asia"]) {
    it(`parses the gallery example: ${f}`, () => {
      const doc = parse(read(`examples/${f}.crumb`))
      expect(doc.itinerary.length).toBeGreaterThan(0)
    })
  }

  it("hero progression: sketch has no dates, full resolves them", () => {
    const sketch = parse(read("examples/japan-sketch.crumb"))
    const full   = parse(read("examples/japan-full.crumb"))
    const firstSketch = sketch.itinerary[0] as Place
    const firstFull   = full.itinerary[0] as Place
    expect(firstSketch.arrives).toBeUndefined()
    expect(firstFull.arrives?.date?.precision).toBe("absolute")
  })

  it("parses japan-full with well-formed plans", () => {
    const doc = parse(read("examples/japan-full.crumb"))
    const places = doc.itinerary.filter((i) => i.type === "place") as Place[]
    expect(places.length).toBeGreaterThanOrEqual(3)
    // every place's plan is a well-formed array; groups carry their own plan
    for (const p of places) {
      expect(Array.isArray(p.plan)).toBe(true)
      for (const item of p.plan) {
        expect(["activity", "stay", "group"]).toContain(item.type)
        if (item.type === "group") expect(Array.isArray(item.plan)).toBe(true)
      }
    }
  })
})
