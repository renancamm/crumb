import { describe, it, expect } from "vitest"
import { addDays } from "../../src/parser/pass3-infer"
import { parse } from "../../src/parser/index"
import type { Place, TransportLeg, ResolvedMoment } from "../../src/types/resolved"

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
  - train
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
  - flight
`)
    const leg = doc.itinerary[1] as TransportLeg
    expect(leg.from?.label).toBe("Tokyo")
    expect(leg.to).toBeUndefined()
  })

  it("infers only 'to' when no preceding place exists", () => {
    const doc = parse(`
itinerary:
  - train
  - Osaka
`)
    const leg = doc.itinerary[0] as TransportLeg
    expect(leg.from).toBeUndefined()
    expect(leg.to?.label).toBe("Osaka")
  })
})

// ─── Intra-item timeline inference ───────────────────────────────────────────

describe("intra-item timeline inference", () => {
  it("derives departs from arrives + duration", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-18"
      duration: "3 days"
`)
    const place = doc.itinerary[0] as Place
    expect(isoDate(place.departs)).toBe("2026-09-21")
  })

  it("derives arrives from departs - duration", () => {
    const doc = parse(`
itinerary:
  - Berlin:
      departs: "2026-10-05"
      duration: "2 days"
`)
    const place = doc.itinerary[0] as Place
    expect(isoDate(place.arrives)).toBe("2026-10-03")
  })
})

// ─── Relative date resolution ─────────────────────────────────────────────────

describe("relative date resolution", () => {
  it("resolves 'Day 2' group to arrives + 1 day", () => {
    const doc = parse(`
itinerary:
  - Tokyo:
      arrives: "2026-10-01"
      activities:
        - day:
            time: "Day 2"
            items:
              - Shibuya crossing
`)
    const place = doc.itinerary[0] as Place
    const group = place.activities[0]
    expect(group.type).toBe("group")
    if (group.type === "group") {
      expect(group.time?.date?.precision).toBe("absolute")
      expect(
        group.time?.date?.precision === "absolute" && group.time.date.value
      ).toBe("2026-10-02")
    }
  })

  it("resolves 'Day 1' to the arrival date itself", () => {
    const doc = parse(`
itinerary:
  - Osaka:
      arrives: "2026-11-15"
      activities:
        - day:
            time: "Day 1"
            items:
              - Dotonbori
`)
    const place = doc.itinerary[0] as Place
    const group = place.activities[0]
    if (group.type === "group") {
      expect(
        group.time?.date?.precision === "absolute" && group.time.date.value
      ).toBe("2026-11-15")
    }
  })
})

// ─── Forward sweep: mid-timeline anchor ───────────────────────────────────────

describe("forward sweep: mid-timeline anchor", () => {
  it("propagates forward from a mid-anchor and leaves pre-anchor place dateless", () => {
    const doc = parse(`
itinerary:
  - Amsterdam
  - Berlin:
      arrives: "2026-09-10"
      duration: "4 days"
  - Prague
`)
    const amsterdam = doc.itinerary[0] as Place
    const berlin    = doc.itinerary[1] as Place
    const prague    = doc.itinerary[2] as Place

    // Phase 1 derives Berlin.departs from arrives + duration
    expect(isoDate(berlin.departs)).toBe("2026-09-14")
    expect(berlin.departs?.anchor?.precedence).toBe("inferred")

    // Forward sweep propagates Berlin's computed departs to Prague
    expect(isoDate(prague.arrives)).toBe("2026-09-14")
    expect(prague.arrives?.anchor?.precedence).toBe("inferred")

    // Amsterdam has no prior date → forward sweep leaves it dateless
    expect(amsterdam.arrives).toBeUndefined()
    // Backward sweep fills Amsterdam.departs from Berlin.arrives
    expect(isoDate(amsterdam.departs)).toBe("2026-09-10")
    expect(amsterdam.departs?.anchor?.precedence).toBe("inferred")
  })
})

// ─── Backward sweep: late fixed anchor ────────────────────────────────────────

describe("backward sweep: late fixed anchor", () => {
  it("chains backwards through durations from explicit departs", () => {
    const doc = parse(`
itinerary:
  - Paris:
      duration: "3 days"
  - Lyon:
      duration: "2 days"
  - Nice:
      departs: "2026-10-15"
`)
    const paris = doc.itinerary[0] as Place
    const lyon  = doc.itinerary[1] as Place
    const nice  = doc.itinerary[2] as Place

    expect(isoDate(lyon.departs)).toBe("2026-10-15")
    expect(lyon.departs?.anchor?.precedence).toBe("inferred")
    expect(isoDate(lyon.arrives)).toBe("2026-10-13")
    expect(lyon.arrives?.anchor?.precedence).toBe("inferred")

    expect(isoDate(paris.departs)).toBe("2026-10-13")
    expect(paris.departs?.anchor?.precedence).toBe("inferred")
    expect(isoDate(paris.arrives)).toBe("2026-10-10")
    expect(paris.arrives?.anchor?.precedence).toBe("inferred")

    // Nice's explicit departs is not marked as inferred
    expect(nice.departs?.anchor?.precedence).not.toBe("inferred")
  })
})

// ─── Phase 4: even distribution ───────────────────────────────────────────────

describe("Phase 4: even distribution", () => {
  it("splits remaining days equally when divisible", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-01"
      duration: "3 days"
  - Lyon
  - Nice
  - Marseille:
      arrives: "2026-09-11"
      duration: "3 days"
`)
    const lyon = doc.itinerary[1] as Place
    const nice = doc.itinerary[2] as Place

    // span=10, committed=6, remaining=4, 2 places → 2 days each
    expect(isoDate(lyon.arrives)).toBe("2026-09-04")
    expect(isoDate(lyon.departs)).toBe("2026-09-06")
    expect(isoDate(nice.arrives)).toBe("2026-09-06")
    expect(isoDate(nice.departs)).toBe("2026-09-08")
  })

  it("gives one extra day to earlier places when remainder is nonzero", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-01"
      duration: "1 day"
  - Lyon
  - Nice
  - Cannes
  - Marseille:
      arrives: "2026-09-11"
      duration: "1 day"
`)
    const lyon   = doc.itinerary[1] as Place
    const nice   = doc.itinerary[2] as Place
    const cannes = doc.itinerary[3] as Place

    // span=10, committed=2, remaining=8, 3 places → perPlace=2, extra=2
    // Lyon gets 3, Nice gets 3, Cannes gets 2
    expect(isoDate(lyon.arrives)).toBe("2026-09-02")
    expect(isoDate(lyon.departs)).toBe("2026-09-05")
    expect(isoDate(nice.arrives)).toBe("2026-09-05")
    expect(isoDate(nice.departs)).toBe("2026-09-08")
    expect(isoDate(cannes.arrives)).toBe("2026-09-08")
    expect(isoDate(cannes.departs)).toBe("2026-09-10")
  })

  it("accounts for mismatched committed durations on either side of a gap", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-01"
      duration: "4 days"
  - Lyon
  - Nice
  - Marseille:
      arrives: "2026-09-15"
      duration: "6 days"
`)
    const lyon = doc.itinerary[1] as Place
    const nice = doc.itinerary[2] as Place

    // span=14, committed=4+6=10, remaining=4, 2 places → 2 days each
    // despite heavy asymmetry (4 vs 6), both durationless places get equal share
    expect(isoDate(lyon.arrives)).toBe("2026-09-05")
    expect(isoDate(lyon.departs)).toBe("2026-09-07")
    expect(isoDate(nice.arrives)).toBe("2026-09-07")
    expect(isoDate(nice.departs)).toBe("2026-09-09")
  })

  it("ignores inferred anchors — only explicit dates bound distribution spans", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-01"
      duration: "3 days"
  - Lyon
  - Berlin:
      arrives: "2026-09-10"
      duration: "2 days"
`)
    const lyon = doc.itinerary[1] as Place

    // Paris.departs is INFERRED by Phase 1 as "2026-09-04" — must NOT be used as anchor.
    // Correct span: "2026-09-01" → "2026-09-10" = 9 days, committed=5, remaining=4.
    // Lyon gets 4 days → departs "2026-09-08".
    // If inferred anchor were used, Lyon would only get 1 day → departs "2026-09-05".
    expect(isoDate(lyon.arrives)).toBe("2026-09-04")
    expect(isoDate(lyon.departs)).toBe("2026-09-08")
  })

  it("durationless place gets both dates after Phase 4 assigns its duration", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-01"
  - London
  - Berlin:
      arrives: "2026-09-07"
`)
    const london = doc.itinerary[1] as Place

    // Phase 4: span=6, all 3 durationless → each gets 2 days
    // Phase 1 re-run: Paris.departs="2026-09-03", Berlin.departs="2026-09-09"
    // Forward sweep: London.arrives="2026-09-03", London.departs="2026-09-05"
    // London only gets a departs if Phase 4 gave it a duration for the sweep to use
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
    const paris  = doc.itinerary[0] as Place
    const london = doc.itinerary[1] as Place
    const berlin = doc.itinerary[2] as Place

    // No explicit dates → anchor list empty → tripDuration fallback fires.
    // 6 days / 3 places = 2 each (synthetic approximate duration).
    expect(paris.duration).toMatchObject({ type: "approximate", value: 2, unit: "nights" })
    expect(london.duration).toMatchObject({ type: "approximate", value: 2, unit: "nights" })
    expect(berlin.duration).toMatchObject({ type: "approximate", value: 2, unit: "nights" })
  })
})
