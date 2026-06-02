import { describe, it, expect } from "vitest"
import { parse } from "../../src/parser/index"
import type { Place, Activity, ActivityGroup } from "../../src/types/resolved"

// A compact but representative document exercising place dates+duration, a
// location block, a stay with info, a loose timed activity, a day group, a
// transport leg, and a second place whose dates are inferred. It uses only
// absolute dates, so the resolved output is fully deterministic.
const SAMPLE = `
trip:
  name: Sample
  tags: [x]
itinerary:
  - place: A
    arrives: "2026-06-01"
    duration: "2 nights"
    location:
      address: Somewhere
      lat: 1.5
      lng: 2.5
    plan:
      - stay: Hotel
        info:
          ref: ABC
      - activity: Walk
        priority: must
        time: morning
      - day: Day one
        plan:
          - Museum
  - transport: train
    to: B
  - place: B
    duration: "1 night"
`

// ─── Determinism ───────────────────────────────────────────────────────────────

describe("determinism", () => {
  it("produces deep-equal output across two independent parses", () => {
    expect(parse(SAMPLE)).toEqual(parse(SAMPLE))
  })

  it("does not share array references between parses (no leaked state)", () => {
    const a = parse(SAMPLE)
    const b = parse(SAMPLE)
    expect(a.itinerary).not.toBe(b.itinerary)
    expect((a.itinerary[0] as Place).plan).not.toBe((b.itinerary[0] as Place).plan)
  })
})

// ─── Full-output snapshot ──────────────────────────────────────────────────────

describe("resolved output shape", () => {
  it("matches the snapshot of a representative document", () => {
    expect(parse(SAMPLE)).toMatchSnapshot()
  })
})

// ─── Degenerate inputs (crash guards) ──────────────────────────────────────────

describe("degenerate inputs", () => {
  it("parses an empty mapping document", () => {
    const doc = parse("{}")
    expect(doc.itinerary).toEqual([])
    expect(doc.trip).toBeUndefined()
  })

  it("parses an empty itinerary list", () => {
    expect(parse("itinerary: []").itinerary).toEqual([])
  })

  it("parses a trip with no itinerary key", () => {
    const doc = parse(`trip:\n  name: Solo`)
    expect(doc.trip?.name).toBe("Solo")
    expect(doc.itinerary).toEqual([])
  })

  it("gives a place with no plan an empty plan array", () => {
    const p = parse(`itinerary:\n  - place: A`).itinerary[0] as Place
    expect(p.plan).toEqual([])
  })
})

// ─── Duration unit conversion in inference ─────────────────────────────────────

describe("duration unit conversion", () => {
  it("treats a 1-week place as 7 days when inferring departs", () => {
    const p = parse(`
itinerary:
  - place: A
    arrives: "2026-09-01"
    duration: "1 week"
`).itinerary[0] as Place
    expect(p.departs?.date?.precision === "absolute" && p.departs.date.value).toBe("2026-09-08")
  })
})

// ─── Trip-duration inference (when not authored) ───────────────────────────────

describe("trip duration inference", () => {
  it("infers trip duration from the first arrival to the last departure", () => {
    const doc = parse(`
trip:
  name: T
itinerary:
  - place: A
    arrives: "2026-09-01"
    departs: "2026-09-04"
  - place: B
    arrives: "2026-09-04"
    departs: "2026-09-10"
`)
    expect(doc.trip?.duration).toMatchObject({ value: 9, unit: "days" })
  })
})

// ─── Relative resolution: weekday, last day, loose-activity anchoring ──────────

describe("relative date resolution (additional)", () => {
  it("resolves a weekday group to the next matching weekday on/after arrival", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    arrives: "2026-10-01"
    plan:
      - day:
        time: Monday
        plan: [A]
`)
    const group = (doc.itinerary[0] as Place).plan[0] as ActivityGroup
    const date  = group.time?.date?.precision === "absolute" ? group.time.date.value : ""
    expect(date >= "2026-10-01").toBe(true)
    expect(new Date(date + "T00:00:00Z").getUTCDay()).toBe(1) // Monday
  })

  it("resolves a 'last day' group to the place's departure date", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    arrives: "2026-10-01"
    duration: "3 days"
    plan:
      - day:
        time: last day
        plan: [Farewell dinner]
`)
    const group = (doc.itinerary[0] as Place).plan[0] as ActivityGroup
    expect(group.time?.date?.precision === "absolute" && group.time.date.value).toBe("2026-10-04")
  })

  it("anchors a loose activity's time to the place's arrival date", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    arrives: "2026-10-01"
    plan:
      - activity: Breakfast
        time: 9am
`)
    const act = (doc.itinerary[0] as Place).plan[0] as Activity
    expect(act.time?.anchor).toEqual({ date: "2026-10-01", precedence: "place" })
  })
})
