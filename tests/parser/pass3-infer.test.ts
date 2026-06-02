import { describe, it, expect } from "vitest"
import { addDays } from "../../src/parser/pass3-infer"
import { parse } from "../../src/parser/index"
import type { Place, TransportLeg, ActivityGroup, ResolvedMoment } from "../../src/types/resolved"

function isoDate(m: ResolvedMoment | undefined): string | undefined {
  if (!m) return undefined
  return m.date?.precision === "absolute" ? m.date.value : undefined
}

// ─── addDays ──────────────────────────────────────────────────────────────────

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-09-18", 3)).toBe("2026-09-21")
  })

  it("crosses a month boundary", () => {
    expect(addDays("2026-09-28", 5)).toBe("2026-10-03")
  })

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-29", 4)).toBe("2027-01-02")
  })

  it("handles zero offset", () => {
    expect(addDays("2026-09-18", 0)).toBe("2026-09-18")
  })

  it("handles negative offset", () => {
    expect(addDays("2026-09-18", -1)).toBe("2026-09-17")
  })

  it("crosses February into March on a non-leap year", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
  })

  it("crosses February into March on a leap year", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01")
  })
})

// ─── Transport endpoint inference ─────────────────────────────────────────────

describe("transport endpoint inference", () => {
  it("infers from/to from neighbouring places", () => {
    const doc = parse(`
itinerary:
  - Paris
  - transport: train
  - London
`)
    const leg = doc.itinerary[1] as TransportLeg
    expect(leg.type).toBe("transport")
    expect(leg.from?.label).toBe("Paris")
    expect(leg.to?.label).toBe("London")
  })

  it("infers only 'from' when no following place exists", () => {
    const doc = parse(`
itinerary:
  - Tokyo
  - transport: flight
`)
    const leg = doc.itinerary[1] as TransportLeg
    expect(leg.from?.label).toBe("Tokyo")
    expect(leg.to).toBeUndefined()
  })

  it("infers only 'to' when no preceding place exists", () => {
    const doc = parse(`
itinerary:
  - transport: train
  - Osaka
`)
    const leg = doc.itinerary[0] as TransportLeg
    expect(leg.from).toBeUndefined()
    expect(leg.to?.label).toBe("Osaka")
  })

  it("computes duration from departs/arrives carrying UTC offsets", () => {
    const doc = parse(`
itinerary:
  - Tokyo
  - transport: flight
    departs: "2026-09-18T23:00+09:00"
    arrives: "2026-09-19T06:00+01:00"
  - London
`)
    const leg = doc.itinerary[1] as TransportLeg
    // 23:00 JST = 14:00 UTC; 06:00 BST = 05:00 UTC next day → 15h
    expect(leg.duration).toMatchObject({ type: "exact", unit: "minutes", value: 15 * 60 })
  })
})

// ─── Intra-item timeline inference ───────────────────────────────────────────

describe("intra-item timeline inference", () => {
  it("derives departs from arrives + duration", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-18"
    duration: "3 days"
`)
    expect(isoDate((doc.itinerary[0] as Place).departs)).toBe("2026-09-21")
  })

  it("derives arrives from departs - duration", () => {
    const doc = parse(`
itinerary:
  - place: Berlin
    departs: "2026-10-05"
    duration: "2 days"
`)
    expect(isoDate((doc.itinerary[0] as Place).arrives)).toBe("2026-10-03")
  })
})

// ─── Relative date resolution ─────────────────────────────────────────────────

describe("relative date resolution", () => {
  it("resolves 'Day 2' group to arrives + 1 day", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    arrives: "2026-10-01"
    plan:
      - day:
        time: "Day 2"
        plan:
          - Shibuya crossing
`)
    const group = (doc.itinerary[0] as Place).plan[0] as ActivityGroup
    expect(group.type).toBe("group")
    expect(group.time?.date?.precision === "absolute" && group.time.date.value).toBe("2026-10-02")
  })

  it("resolves 'Day 1' to the arrival date itself", () => {
    const doc = parse(`
itinerary:
  - place: Osaka
    arrives: "2026-11-15"
    plan:
      - day:
        time: "Day 1"
        plan:
          - Dotonbori
`)
    const group = (doc.itinerary[0] as Place).plan[0] as ActivityGroup
    expect(group.time?.date?.precision === "absolute" && group.time.date.value).toBe("2026-11-15")
  })

  it("sequences title-less day groups with 'next day' starting from arrival", () => {
    const doc = parse(`
itinerary:
  - place: Kyoto
    arrives: "2026-10-01"
    plan:
      - day:
        plan: [A]
      - day:
        plan: [B]
      - day:
        plan: [C]
`)
    const groups = (doc.itinerary[0] as Place).plan as ActivityGroup[]
    expect(groups.map((g) => g.time?.date?.precision === "absolute" && g.time.date.value))
      .toEqual(["2026-10-01", "2026-10-02", "2026-10-03"])
  })

  it("leaves an unscheduled `group` out of the day sequence", () => {
    const doc = parse(`
itinerary:
  - place: Kyoto
    arrives: "2026-10-01"
    plan:
      - group: Rainy day ideas
        plan: [Museum]
      - day:
        plan: [Temple]
`)
    const plan = (doc.itinerary[0] as Place).plan as ActivityGroup[]
    // unscheduled group gets no injected time
    expect(plan[0].kind).toBe("group")
    expect(plan[0].time).toBeUndefined()
    // the day still sequences from arrival (group did not consume an index)
    expect(plan[1].time?.date?.precision === "absolute" && plan[1].time.date.value).toBe("2026-10-01")
  })
})

// ─── Forward sweep: mid-timeline anchor ───────────────────────────────────────

describe("forward sweep: mid-timeline anchor", () => {
  it("propagates forward from a mid-anchor and leaves pre-anchor place dateless", () => {
    const doc = parse(`
itinerary:
  - Amsterdam
  - place: Berlin
    arrives: "2026-09-10"
    duration: "4 days"
  - Prague
`)
    const amsterdam = doc.itinerary[0] as Place
    const berlin    = doc.itinerary[1] as Place
    const prague    = doc.itinerary[2] as Place

    expect(isoDate(berlin.departs)).toBe("2026-09-14")
    expect(berlin.departs?.anchor?.precedence).toBe("inferred")

    expect(isoDate(prague.arrives)).toBe("2026-09-14")
    expect(prague.arrives?.anchor?.precedence).toBe("inferred")

    expect(amsterdam.arrives).toBeUndefined()
    expect(isoDate(amsterdam.departs)).toBe("2026-09-10")
    expect(amsterdam.departs?.anchor?.precedence).toBe("inferred")
  })
})

// ─── Backward sweep: late fixed anchor ────────────────────────────────────────

describe("backward sweep: late fixed anchor", () => {
  it("chains backwards through durations from explicit departs", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    duration: "3 days"
  - place: Lyon
    duration: "2 days"
  - place: Nice
    departs: "2026-10-15"
`)
    const paris = doc.itinerary[0] as Place
    const lyon  = doc.itinerary[1] as Place
    const nice  = doc.itinerary[2] as Place

    expect(isoDate(lyon.departs)).toBe("2026-10-15")
    expect(isoDate(lyon.arrives)).toBe("2026-10-13")
    expect(isoDate(paris.departs)).toBe("2026-10-13")
    expect(isoDate(paris.arrives)).toBe("2026-10-10")
    expect(nice.departs?.anchor?.precedence).not.toBe("inferred")
  })
})

// ─── Phase 4: even distribution ───────────────────────────────────────────────

describe("Phase 4: even distribution", () => {
  it("splits remaining days equally when divisible", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-01"
    duration: "3 days"
  - Lyon
  - Nice
  - place: Marseille
    arrives: "2026-09-11"
    duration: "3 days"
`)
    const lyon = doc.itinerary[1] as Place
    const nice = doc.itinerary[2] as Place
    expect(isoDate(lyon.arrives)).toBe("2026-09-04")
    expect(isoDate(lyon.departs)).toBe("2026-09-06")
    expect(isoDate(nice.arrives)).toBe("2026-09-06")
    expect(isoDate(nice.departs)).toBe("2026-09-08")
  })

  it("gives one extra day to earlier places when remainder is nonzero", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-01"
    duration: "1 day"
  - Lyon
  - Nice
  - Cannes
  - place: Marseille
    arrives: "2026-09-11"
    duration: "1 day"
`)
    const lyon   = doc.itinerary[1] as Place
    const nice   = doc.itinerary[2] as Place
    const cannes = doc.itinerary[3] as Place
    expect(isoDate(lyon.arrives)).toBe("2026-09-02")
    expect(isoDate(lyon.departs)).toBe("2026-09-05")
    expect(isoDate(nice.arrives)).toBe("2026-09-05")
    expect(isoDate(nice.departs)).toBe("2026-09-08")
    expect(isoDate(cannes.arrives)).toBe("2026-09-08")
    expect(isoDate(cannes.departs)).toBe("2026-09-10")
  })

  it("ignores inferred anchors — only explicit dates bound distribution spans", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-01"
    duration: "3 days"
  - Lyon
  - place: Berlin
    arrives: "2026-09-10"
    duration: "2 days"
`)
    const lyon = doc.itinerary[1] as Place
    expect(isoDate(lyon.arrives)).toBe("2026-09-04")
    expect(isoDate(lyon.departs)).toBe("2026-09-08")
  })

  it("durationless place gets both dates after Phase 4 assigns its duration", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-01"
  - London
  - place: Berlin
    arrives: "2026-09-07"
`)
    const london = doc.itinerary[1] as Place
    expect(isoDate(london.arrives)).toBe("2026-09-03")
    expect(isoDate(london.departs)).toBe("2026-09-05")
    expect(london.arrives?.anchor?.precedence).toBe("inferred")
    expect(london.departs?.anchor?.precedence).toBe("inferred")
  })

  it("distributes trip duration evenly when no calendar anchors exist", () => {
    const doc = parse(`
trip:
  duration: "6 days"
itinerary:
  - Paris
  - London
  - Berlin
`)
    expect((doc.itinerary[0] as Place).duration).toMatchObject({ type: "approximate", value: 2, unit: "nights" })
    expect((doc.itinerary[1] as Place).duration).toMatchObject({ type: "approximate", value: 2, unit: "nights" })
    expect((doc.itinerary[2] as Place).duration).toMatchObject({ type: "approximate", value: 2, unit: "nights" })
  })
})
