import { describe, it, expect } from "vitest"
import { resolveMoment, resolveDuration, resolveGeolocation } from "../../src/parser/pass2-resolve"

// ─── resolveMoment ────────────────────────────────────────────────────────────

describe("resolveMoment", () => {
  describe("ISO datetime", () => {
    it("parses ISO datetime with positive UTC offset", () => {
      const r = resolveMoment("2026-09-18T17:00+09:00")
      expect(r.date).toEqual({ precision: "absolute", value: "2026-09-18" })
      expect(r.time).toEqual({ precision: "exact", value: "17:00", utcOffset: "+09:00" })
      expect(r.label).toBe("2026-09-18T17:00+09:00")
    })

    it("parses ISO datetime with Z suffix as +00:00", () => {
      const r = resolveMoment("2026-09-18T17:00Z")
      expect(r.date).toEqual({ precision: "absolute", value: "2026-09-18" })
      expect(r.time).toEqual({ precision: "exact", value: "17:00", utcOffset: "+00:00" })
    })

    it("parses ISO datetime without timezone (no utcOffset)", () => {
      const r = resolveMoment("2026-09-18T17:00")
      expect(r.date).toEqual({ precision: "absolute", value: "2026-09-18" })
      expect(r.time).toMatchObject({ precision: "exact", value: "17:00" })
      expect((r.time as { utcOffset?: string }).utcOffset).toBeUndefined()
    })
  })

  describe("ISO date only", () => {
    it("parses ISO date with no time", () => {
      const r = resolveMoment("2026-10-12")
      expect(r.date).toEqual({ precision: "absolute", value: "2026-10-12" })
      expect(r.time).toBeUndefined()
    })
  })

  describe("loose periods", () => {
    it("parses 'morning'", () => {
      const r = resolveMoment("morning")
      expect(r.time).toEqual({ precision: "loose", value: "morning", estimate: "09:00" })
      expect(r.date).toBeUndefined()
    })

    it("parses 'evening'", () => {
      const r = resolveMoment("evening")
      expect(r.time).toEqual({ precision: "loose", value: "evening", estimate: "19:30" })
    })

    it("parses 'early morning'", () => {
      const r = resolveMoment("early morning")
      expect(r.time).toEqual({ precision: "loose", value: "early morning", estimate: "06:00" })
    })
  })

  describe("exact times", () => {
    it("parses 8am", () => {
      const r = resolveMoment("8am")
      expect(r.time).toEqual({ precision: "exact", value: "08:00" })
    })

    it("parses 2:30pm", () => {
      const r = resolveMoment("2:30pm")
      expect(r.time).toEqual({ precision: "exact", value: "14:30" })
    })

    it("parses 12pm as noon", () => {
      const r = resolveMoment("12pm")
      expect(r.time).toEqual({ precision: "exact", value: "12:00" })
    })

    it("parses 12am as midnight", () => {
      const r = resolveMoment("12am")
      expect(r.time).toEqual({ precision: "exact", value: "00:00" })
    })
  })

  describe("relative date references", () => {
    it("parses 'Day 3'", () => {
      const r = resolveMoment("Day 3")
      expect(r.date).toEqual({ precision: "relative", value: "Day 3" })
    })

    it("parses ordinal form '3rd day' as 'Day 3'", () => {
      const r = resolveMoment("3rd day")
      expect(r.date).toEqual({ precision: "relative", value: "Day 3" })
    })

    it("parses '1st day' as 'Day 1'", () => {
      const r = resolveMoment("1st day")
      expect(r.date).toEqual({ precision: "relative", value: "Day 1" })
    })

    it("parses 'next day'", () => {
      const r = resolveMoment("next day")
      expect(r.date).toEqual({ precision: "relative", value: "next day" })
    })

    it("parses weekday names", () => {
      const r = resolveMoment("monday")
      expect(r.date).toEqual({ precision: "relative", value: "monday" })
    })
  })

  describe("fuzzy date expressions", () => {
    it("parses 'early October 2026'", () => {
      const r = resolveMoment("early October 2026")
      expect(r.date).toEqual({ precision: "approximate", estimate: "2026-10-05" })
    })

    it("parses 'mid October 2026'", () => {
      const r = resolveMoment("mid October 2026")
      expect(r.date).toEqual({ precision: "approximate", estimate: "2026-10-15" })
    })

    it("parses 'late October 2026'", () => {
      const r = resolveMoment("late October 2026")
      expect(r.date).toEqual({ precision: "approximate", estimate: "2026-10-25" })
    })

    it("parses 'summer 2026'", () => {
      const r = resolveMoment("summer 2026")
      expect(r.date).toEqual({ precision: "approximate", estimate: "2026-07-01" })
    })

    it("parses 'winter 2026' into following Jan", () => {
      const r = resolveMoment("winter 2026")
      expect(r.date).toEqual({ precision: "approximate", estimate: "2027-01-01" })
    })

    it("parses bare month name as relative", () => {
      const r = resolveMoment("September")
      expect(r.date).toEqual({ precision: "relative", value: "September" })
    })
  })

  describe("fallback", () => {
    it("returns label-only for unrecognized input", () => {
      const r = resolveMoment("whenever")
      expect(r.date).toBeUndefined()
      expect(r.time).toBeUndefined()
      expect(r.label).toBe("whenever")
    })
  })
})

// ─── resolveDuration ──────────────────────────────────────────────────────────

describe("resolveDuration", () => {
  describe("exact durations", () => {
    it("parses shorthand hours: '2h'", () => {
      expect(resolveDuration("2h")).toMatchObject({ type: "exact", value: 2, unit: "hours" })
    })

    it("parses shorthand minutes: '30m'", () => {
      expect(resolveDuration("30m")).toMatchObject({ type: "exact", value: 30, unit: "minutes" })
    })

    it("parses combined hours+minutes '1h30m' as total minutes", () => {
      expect(resolveDuration("1h30m")).toMatchObject({ type: "exact", value: 90, unit: "minutes" })
    })

    it("parses '2h30m' as 150 minutes", () => {
      expect(resolveDuration("2h30m")).toMatchObject({ type: "exact", value: 150, unit: "minutes" })
    })

    it("parses shorthand days: '3d'", () => {
      expect(resolveDuration("3d")).toMatchObject({ type: "exact", value: 3, unit: "days" })
    })

    it("parses shorthand nights: '2n'", () => {
      expect(resolveDuration("2n")).toMatchObject({ type: "exact", value: 2, unit: "nights" })
    })

    it("parses shorthand weeks: '2w'", () => {
      expect(resolveDuration("2w")).toMatchObject({ type: "exact", value: 2, unit: "weeks" })
    })

    it("parses plain English '2 nights'", () => {
      expect(resolveDuration("2 nights")).toMatchObject({ type: "exact", value: 2, unit: "nights" })
    })

    it("parses plain English '45 minutes'", () => {
      expect(resolveDuration("45 minutes")).toMatchObject({ type: "exact", value: 45, unit: "minutes" })
    })

    it("parses plural unit correctly", () => {
      expect(resolveDuration("3 hours")).toMatchObject({ type: "exact", value: 3, unit: "hours" })
    })
  })

  describe("approximate durations", () => {
    it("parses 'around 2 hours'", () => {
      expect(resolveDuration("around 2 hours")).toMatchObject({ type: "approximate", value: 2, unit: "hours" })
    })

    it("parses 'about 3 days'", () => {
      expect(resolveDuration("about 3 days")).toMatchObject({ type: "approximate", value: 3, unit: "days" })
    })

    it("parses 'approximately 1 hour'", () => {
      expect(resolveDuration("approximately 1 hour")).toMatchObject({ type: "approximate", value: 1, unit: "hours" })
    })
  })

  describe("minimum durations", () => {
    it("parses 'at least 3 days'", () => {
      expect(resolveDuration("at least 3 days")).toMatchObject({ type: "minimum", value: 3, unit: "days" })
    })

    it("parses 'minimum 2 hours'", () => {
      expect(resolveDuration("minimum 2 hours")).toMatchObject({ type: "minimum", value: 2, unit: "hours" })
    })
  })

  describe("range durations", () => {
    it("parses '2-3 hours'", () => {
      expect(resolveDuration("2-3 hours")).toMatchObject({ type: "range", min: 2, max: 3, unit: "hours" })
    })

    it("parses '2 to 3 nights'", () => {
      expect(resolveDuration("2 to 3 nights")).toMatchObject({ type: "range", min: 2, max: 3, unit: "nights" })
    })
  })

  describe("named spans", () => {
    it("parses 'all day'", () => {
      const r = resolveDuration("all day")
      expect(r).toMatchObject({ type: "named", span: "all day" })
      if (r.type === "named") expect(r.estimate).toEqual({ value: 10, unit: "hours" })
    })

    it("parses 'half day'", () => {
      const r = resolveDuration("half day")
      expect(r).toMatchObject({ type: "named", span: "half day" })
      if (r.type === "named") expect(r.estimate).toEqual({ value: 5, unit: "hours" })
    })

    it("parses 'overnight'", () => {
      expect(resolveDuration("overnight")).toMatchObject({ type: "named", span: "overnight" })
    })

    it("parses 'half day to all day' as named-range", () => {
      const r = resolveDuration("half day to all day")
      expect(r).toMatchObject({ type: "named-range", min: "half day", max: "all day" })
    })
  })

  describe("unknown fallback", () => {
    it("returns unknown for unrecognized input", () => {
      expect(resolveDuration("a while")).toMatchObject({ type: "unknown", label: "a while" })
    })

    it("returns unknown for empty-like inputs", () => {
      expect(resolveDuration("TBD")).toMatchObject({ type: "unknown" })
    })
  })

  describe("label preservation", () => {
    it("preserves the original label string", () => {
      expect(resolveDuration("around 2 hours").label).toBe("around 2 hours")
      expect(resolveDuration("2h").label).toBe("2h")
      expect(resolveDuration("a while").label).toBe("a while")
    })
  })
})

// ─── resolveGeolocation ───────────────────────────────────────────────────────

describe("resolveGeolocation", () => {
  it("passes a string through as label", () => {
    expect(resolveGeolocation("Lisbon")).toMatchObject({ label: "Lisbon" })
  })

  it("treats 'none' as geocodingDisabled", () => {
    expect(resolveGeolocation("none")).toEqual({ label: "none", geocodingDisabled: true })
  })

  it("parses block form with name and coordinates", () => {
    const r = resolveGeolocation({ name: "Eiffel Tower", lat: 48.858, lng: 2.294 })
    expect(r).toMatchObject({ label: "Eiffel Tower", name: "Eiffel Tower", lat: 48.858, lng: 2.294 })
  })

  it("discards coordinates out of valid range", () => {
    const r = resolveGeolocation({ name: "Bad Coords", lat: 999, lng: 2.0 })
    expect(r.lat).toBeUndefined()
    expect(r.lng).toBeUndefined()
  })

  it("uses coordinates as label when no name or address", () => {
    const r = resolveGeolocation({ lat: 35.6762, lng: 139.6503 })
    expect(r.label).toBe("35.6762, 139.6503")
    expect(r.lat).toBe(35.6762)
    expect(r.lng).toBe(139.6503)
  })
})
