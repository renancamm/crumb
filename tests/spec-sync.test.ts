import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  TRANSPORT_MODES,
  GROUP_KINDS,
  PRIORITIES,
  NAMED_PERIODS,
  SEASONS,
} from "../src/types/primitives"

const root = resolve(__dirname, "..")
const read = (p: string) => readFileSync(resolve(root, p), "utf8")
const AI   = read("spec/CRUMB_FOR_AI.md")
const SPEC = read("spec/CRUMB_SPEC.md")

// Backticked tokens on the bullet line containing `keyword`, kept to plain
// lowercase vocab words — this drops noise like `transport:` (a colon) or
// `fall 2026` (a digit) that appear in the same line as labels/examples.
function vocabOnLine(doc: string, keyword: string): string[] {
  const line = doc.split("\n").find((l) => l.includes(keyword))
  if (!line) throw new Error(`CRUMB_FOR_AI.md has no line containing "${keyword}"`)
  const tokens = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])
  return [...new Set(tokens.filter((t) => /^[a-z][a-z ]*$/.test(t)))].sort()
}

// keyword that locates the vocabulary bullet in CRUMB_FOR_AI.md → code constant
const VOCABS: Array<[string, readonly string[]]> = [
  ["transport modes",            TRANSPORT_MODES],
  ["group kinds",                GROUP_KINDS],
  ["**priority:**",              PRIORITIES],
  ["named time-of-day periods",  NAMED_PERIODS],
  ["**seasons**",                SEASONS],
]

describe("vocab sync — CRUMB_FOR_AI.md lists exactly the code constants", () => {
  for (const [keyword, code] of VOCABS) {
    it(`"${keyword}" matches the code vocabulary`, () => {
      expect(vocabOnLine(AI, keyword)).toEqual([...code].sort())
    })
  }
})

describe("vocab presence — CRUMB_SPEC.md mentions every value", () => {
  for (const [keyword, code] of VOCABS) {
    it(`spec mentions every value for "${keyword}"`, () => {
      const missing = code.filter((v) => !SPEC.includes(v))
      expect(missing).toEqual([])
    })
  }
})

describe("transclusion — CRUMB_FOR_AI.md embeds the kitchen-sink snippet verbatim", () => {
  it("the embedded example equals examples/snippets/kitchen-sink.crumb", () => {
    const snippet = read("examples/snippets/kitchen-sink.crumb").trim()
    const m = AI.match(
      /<!-- include: examples\/snippets\/kitchen-sink\.crumb -->\n```yaml\n([\s\S]*?)```/,
    )
    expect(m, "include marker + yaml block not found in CRUMB_FOR_AI.md").toBeTruthy()
    expect(m![1].trim()).toBe(snippet)
  })
})
