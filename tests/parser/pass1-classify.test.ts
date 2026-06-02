import { describe, it, expect } from "vitest"
import { parse } from "../../src/parser/index"
import type { Place, TransportLeg, Activity, Stay } from "../../src/types/resolved"

const place = (src: string) => parse(src).itinerary[0] as Place

// ─── Kind dispatch & defaults ─────────────────────────────────────────────────

describe("kind dispatch", () => {
  it("treats a bare itinerary string as a place", () => {
    expect(place(`itinerary: [Tokyo]`).name).toBe("Tokyo")
    expect(place(`itinerary: [Tokyo]`).type).toBe("place")
  })

  it("treats a bare plan string as an activity", () => {
    const p = place(`
itinerary:
  - place: Tokyo
    plan: [Senso-ji]
`)
    expect(p.plan[0].type).toBe("activity")
    expect((p.plan[0] as Activity).name).toBe("Senso-ji")
  })

  it("accepts all valid transport modes", () => {
    for (const mode of ["train", "flight", "bus", "car", "ferry", "walk", "bike", "other"]) {
      const doc = parse(`itinerary:\n  - transport: ${mode}`)
      expect((doc.itinerary[0] as TransportLeg).mode).toBe(mode)
    }
  })

  it("coerces a missing transport mode to `other`", () => {
    const doc = parse(`itinerary:\n  - transport:`)
    expect((doc.itinerary[0] as TransportLeg).mode).toBe("other")
  })

  it("quotes are not required — numeric place names coerce to strings", () => {
    const p = place(`itinerary:\n  - place: 2026`)
    expect(p.name).toBe("2026")
  })
})

// ─── Errors: structure ─────────────────────────────────────────────────────────

describe("structural errors", () => {
  it("throws when the root is not a mapping", () => {
    expect(() => parse("- a\n- b")).toThrow(/root must be a YAML mapping/)
  })

  it("throws on an unknown top-level key", () => {
    expect(() => parse(`budget: 1000\nitinerary: [Paris]`)).toThrow(/Unknown key "budget"/)
  })

  it("throws when an itinerary item declares no kind", () => {
    expect(() => parse(`itinerary:\n  - foo: bar`)).toThrow(/declare its kind/)
  })

  it("throws when an itinerary item declares two kinds", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    transport: train
`)).toThrow(/more than one kind/)
  })

  it("throws when a place name is missing", () => {
    expect(() => parse(`itinerary:\n  - place:\n    duration: 3 nights`)).toThrow(/requires a name|nested block/)
  })

  it("throws when fields are nested under the kind key instead of siblings", () => {
    expect(() => parse(`
itinerary:
  - place:
      duration: 3 nights
`)).toThrow(/nested block/)
  })

  it("throws on a plan item with an unknown kind", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    plan:
      - foo: bar
`)).toThrow(/declare its kind/)
  })
})

// ─── Errors: unknown fields (the closed-block rule) ───────────────────────────

describe("unknown-field errors", () => {
  it("rejects an unknown field on a place and points to info", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    color: blue
`)).toThrow(/Unknown field "color" on place "Tokyo".*info/s)
  })

  it("rejects an unknown field on a transport leg", () => {
    expect(() => parse(`
itinerary:
  - transport: train
    seat: 4A
`)).toThrow(/Unknown field "seat" on transport leg/)
  })

  it("rejects an unknown field on an activity", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    plan:
      - activity: Senso-ji
        cost: 500
`)).toThrow(/Unknown field "cost" on activity "Senso-ji"/)
  })

  it("rejects an unknown field on a stay", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    plan:
      - stay: Hotel
        stars: 5
`)).toThrow(/Unknown field "stars" on stay "Hotel"/)
  })

  it("rejects an unknown field on a group", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    plan:
      - day: D
        weather: sunny
        plan: [A]
`)).toThrow(/Unknown field "weather"/)
  })

  it("rejects an unknown trip field", () => {
    expect(() => parse(`
trip:
  name: T
  budget: 1000
itinerary: [Paris]
`)).toThrow(/Unknown key "budget" in `trip`/)
  })
})

// ─── Errors: group nesting ─────────────────────────────────────────────────────

describe("group nesting errors", () => {
  it("rejects a group nested inside a group", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    plan:
      - day: Outer
        plan:
          - day: Inner
            plan: [X]
`)).toThrow(/only activities|cannot be nested/)
  })

  it("rejects a stay inside a group's plan", () => {
    expect(() => parse(`
itinerary:
  - place: Tokyo
    plan:
      - day: D
        plan:
          - stay: Hotel
`)).toThrow(/only activities|stays belong/)
  })
})

// ─── info as a plain map ───────────────────────────────────────────────────────

describe("info (MetadataList) as a map", () => {
  it("parses string and number values, preserving order", () => {
    const p = place(`
itinerary:
  - place: Tokyo
    info:
      operator: JAL
      gate: 114
`)
    expect(p.info).toEqual([
      { key: "operator", value: "JAL" },
      { key: "gate", value: 114 },
    ])
  })

  it("skips non-scalar info values", () => {
    const p = place(`
itinerary:
  - place: Tokyo
    info:
      a: hello
      b: [1, 2]
      c: 3
`)
    expect(p.info).toEqual([
      { key: "a", value: "hello" },
      { key: "c", value: 3 },
    ])
  })
})

// ─── Geolocation ────────────────────────────────────────────────────────────────

describe("geolocation", () => {
  it("accepts a plain string location", () => {
    expect(place(`itinerary:\n  - place: Tokyo\n    location: Shibuya, Tokyo`).location?.label).toBe("Shibuya, Tokyo")
  })

  it("accepts location: none as geocoding-disabled", () => {
    const loc = place(`itinerary:\n  - place: Tokyo\n    location: none`).location
    expect(loc).toEqual({ label: "none", geocodingDisabled: true })
  })

  it("parses an address/lat/lng block and ignores a stray name key", () => {
    const loc = place(`
itinerary:
  - place: Tokyo
    location:
      name: Ignored
      address: 1 Chome, Tokyo
      lat: 35.6
      lng: 139.7
`).location
    expect(loc?.label).toBe("1 Chome, Tokyo")
    expect(loc?.lat).toBe(35.6)
    expect((loc as Record<string, unknown>).name).toBeUndefined()
  })
})

// ─── Stay carries its own dates inside the plan ───────────────────────────────

describe("stay", () => {
  it("resolves a stay's own arrives/departs", () => {
    const p = place(`
itinerary:
  - place: Tokyo
    plan:
      - stay: Granbell Hotel
        arrives: "2026-09-10"
        departs: "2026-09-15"
`)
    const stay = p.plan[0] as Stay
    expect(stay.type).toBe("stay")
    expect(stay.arrives?.date?.precision === "absolute" && stay.arrives.date.value).toBe("2026-09-10")
    expect(stay.departs?.date?.precision === "absolute" && stay.departs.date.value).toBe("2026-09-15")
  })
})
