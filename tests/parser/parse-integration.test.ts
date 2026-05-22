import { describe, it, expect } from "vitest"
import { parse } from "../../src/parser/index"
import type { Place, TransportLeg } from "../../src/types/resolved"

describe("parse() integration", () => {
  it("parses a bare place list", () => {
    const doc = parse(`
itinerary:
  - Paris
  - London
`)
    expect(doc.itinerary).toHaveLength(2)
    expect((doc.itinerary[0] as Place).type).toBe("place")
    expect((doc.itinerary[0] as Place).name).toBe("Paris")
    expect((doc.itinerary[1] as Place).name).toBe("London")
  })

  it("parses trip metadata", () => {
    const doc = parse(`
trip:
  name: Test Trip
  author: Alice
itinerary:
  - Paris
`)
    expect(doc.trip?.name).toBe("Test Trip")
    expect(doc.trip?.author).toBe("Alice")
  })

  it("parses a detailed place with an absolute arrives date", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-18"
`)
    const place = doc.itinerary[0] as Place
    expect(place.name).toBe("Paris")
    expect(place.arrives?.date).toEqual({ precision: "absolute", value: "2026-09-18" })
  })

  it("parses transport legs with correct mode", () => {
    const doc = parse(`
itinerary:
  - Tokyo
  - flight
  - Seoul
`)
    const leg = doc.itinerary[1] as TransportLeg
    expect(leg.type).toBe("transport")
    expect(leg.mode).toBe("flight")
  })

  it("parses activities under a place", () => {
    const doc = parse(`
itinerary:
  - Tokyo:
      activities:
        - Shibuya crossing
        - Harajuku
`)
    const place = doc.itinerary[0] as Place
    const ungrouped = place.activities[0]
    expect(ungrouped.type).toBe("ungrouped")
    if (ungrouped.type === "ungrouped") {
      expect(ungrouped.items).toHaveLength(2)
      expect(ungrouped.items[0].name).toBe("Shibuya crossing")
    }
  })

  it("throws on invalid YAML root", () => {
    expect(() => parse("- just a list")).toThrow()
  })

  it("parses a place with duration as a typed duration", () => {
    const doc = parse(`
itinerary:
  - Lisbon:
      duration: "3 nights"
`)
    const place = doc.itinerary[0] as Place
    expect(place.duration?.type).toBe("exact")
    if (place.duration?.type === "exact") {
      expect(place.duration.value).toBe(3)
      expect(place.duration.unit).toBe("nights")
    }
  })

  it("preserves activity priority", () => {
    const doc = parse(`
itinerary:
  - Rome:
      activities:
        - Colosseum:
            priority: must
`)
    const place = doc.itinerary[0] as Place
    const ungrouped = place.activities[0]
    if (ungrouped.type === "ungrouped") {
      expect(ungrouped.items[0].priority).toBe("must")
    }
  })

  it("infers departs from arrives + duration via Phase 1", () => {
    const doc = parse(`
itinerary:
  - Paris:
      arrives: "2026-09-01"
      duration: "7 days"
  - train
  - London
`)
    const paris = doc.itinerary[0] as Place
    const leg   = doc.itinerary[1] as TransportLeg

    expect(paris.departs?.date?.precision).toBe("absolute")
    expect(paris.departs?.date?.precision === "absolute" && paris.departs.date.value).toBe("2026-09-08")

    expect(leg.from?.label).toBe("Paris")
  })
})
