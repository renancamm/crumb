import { describe, it, expect } from "vitest"
import { parse } from "../../src/parser/index"
import type { Place, TransportLeg, Activity, Stay, ActivityGroup } from "../../src/types/resolved"

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

  it("parses a detailed place with sibling fields", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-18"
    duration: "3 nights"
    tags: [city, food]
`)
    const place = doc.itinerary[0] as Place
    expect(place.name).toBe("Paris")
    expect(place.arrives?.date).toEqual({ precision: "absolute", value: "2026-09-18" })
    expect(place.duration?.type).toBe("exact")
    expect(place.tags).toEqual(["city", "food"])
  })

  it("parses a transport leg keyed by `transport`", () => {
    const doc = parse(`
itinerary:
  - Tokyo
  - transport: flight
    to: Seoul
  - Seoul
`)
    const leg = doc.itinerary[1] as TransportLeg
    expect(leg.type).toBe("transport")
    expect(leg.mode).toBe("flight")
    expect(leg.to?.label).toBe("Seoul")
  })

  it("coerces an unknown transport mode to `other`", () => {
    const doc = parse(`
itinerary:
  - Tokyo
  - transport: hovercraft
  - Osaka
`)
    expect((doc.itinerary[1] as TransportLeg).mode).toBe("other")
  })

  it("treats a bare string in the itinerary as a place, even a transport word", () => {
    const doc = parse(`
itinerary:
  - train
`)
    const place = doc.itinerary[0] as Place
    expect(place.type).toBe("place")
    expect(place.name).toBe("train")
  })

  it("unifies stays, activities, and groups into one ordered plan", () => {
    const doc = parse(`
itinerary:
  - place: Kyoto
    plan:
      - Fushimi Inari
      - stay: Gion Ryokan
      - activity: Nishiki Market
        priority: must
      - day: Temple day
        plan:
          - Kinkaku-ji
`)
    const plan = (doc.itinerary[0] as Place).plan
    expect(plan.map((p) => p.type)).toEqual(["activity", "stay", "activity", "group"])
    // order preserved: bare activity, stay, detailed activity, group
    expect((plan[0] as Activity).name).toBe("Fushimi Inari")
    expect((plan[1] as Stay).name).toBe("Gion Ryokan")
    expect((plan[2] as Activity).priority).toBe("must")
    const group = plan[3] as ActivityGroup
    expect(group.kind).toBe("day")
    expect(group.title).toBe("Temple day")
    expect(group.plan[0].name).toBe("Kinkaku-ji")
  })

  it("parses a group with the title omitted", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    plan:
      - day:
        plan:
          - Senso-ji
`)
    const group = (doc.itinerary[0] as Place).plan[0] as ActivityGroup
    expect(group.type).toBe("group")
    expect(group.kind).toBe("day")
    expect(group.title).toBeUndefined()
    expect(group.plan).toHaveLength(1)
  })

  it("parses the three group kinds", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    plan:
      - day: D
        plan: [A]
      - week: W
        plan: [B]
      - group: Ideas
        plan: [C]
`)
    const kinds = (doc.itinerary[0] as Place).plan.map((p) => (p as ActivityGroup).kind)
    expect(kinds).toEqual(["day", "week", "group"])
  })

  it("parses info as a plain map into ordered key/value pairs", () => {
    const doc = parse(`
itinerary:
  - place: Tokyo
    plan:
      - stay: Granbell Hotel
        info:
          reference: SGH-2231
          floor: 12
`)
    const stay = (doc.itinerary[0] as Place).plan[0] as Stay
    expect(stay.info).toEqual([
      { key: "reference", value: "SGH-2231" },
      { key: "floor", value: 12 },
    ])
  })

  it("preserves activity priority", () => {
    const doc = parse(`
itinerary:
  - place: Rome
    plan:
      - activity: Colosseum
        priority: must
`)
    const act = (doc.itinerary[0] as Place).plan[0] as Activity
    expect(act.priority).toBe("must")
  })

  it("infers departs from arrives + duration and fills transport endpoints", () => {
    const doc = parse(`
itinerary:
  - place: Paris
    arrives: "2026-09-01"
    duration: "7 days"
  - transport: train
  - London
`)
    const paris = doc.itinerary[0] as Place
    const leg   = doc.itinerary[1] as TransportLeg

    expect(paris.departs?.date?.precision).toBe("absolute")
    expect(paris.departs?.date?.precision === "absolute" && paris.departs.date.value).toBe("2026-09-08")
    expect(leg.from?.label).toBe("Paris")
    expect(leg.to?.label).toBe("London")
  })

  it("throws on a non-mapping root", () => {
    expect(() => parse("- just a list")).toThrow()
  })
})
