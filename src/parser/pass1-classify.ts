/**
 * Pass 1 — Structure
 *
 * Transforms the raw JavaScript object produced by js-yaml into a
 * RawCrumbDocument. No field values are resolved at this stage — all
 * moments, durations, and geolocations remain as raw strings or objects.
 */

import {
  GroupKind,
  MetadataItem,
  TransportMode,
  TripMeta,
} from "../types/primitives"
import {
  RawActivity,
  RawActivityGroup,
  RawActivityItem,
  RawCrumbDocument,
  RawGeolocation,
  RawItineraryItem,
  RawPlace,
  RawStay,
  RawTransportLeg,
} from "../types/raw"

const TRANSPORT_KEYWORDS = new Set<string>([
  "train", "flight", "bus", "car", "ferry", "walk", "bike", "transport",
])

const ACTIVITY_GROUP_KEYWORDS = new Set<string>(["day", "week", "plan"])

// ─── Entry point ─────────────────────────────────────────────────────────────

export function classify(raw: unknown): RawCrumbDocument {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Invalid crumb document: root must be a YAML mapping")
  }

  const doc = raw as Record<string, unknown>

  return {
    trip:      doc["trip"] != null ? parseTripMeta(doc["trip"]) : undefined,
    itinerary: parseItinerary(doc["itinerary"]),
  }
}

// ─── Trip metadata ───────────────────────────────────────────────────────────

function parseTripMeta(raw: unknown): TripMeta {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {}
  }

  const r = raw as Record<string, unknown>

  return {
    name:   asString(r["name"]),
    author: asString(r["author"]),
    tags:   asStringArray(r["tags"]),
    info:   parseInfo(r["info"]),
    note:   asString(r["note"]),
  }
}

// ─── Itinerary ───────────────────────────────────────────────────────────────

function parseItinerary(raw: unknown): RawItineraryItem[] {
  if (!Array.isArray(raw)) return []

  const items: RawItineraryItem[] = []

  for (const item of raw) {
    const parsed = parseItineraryItem(item)
    if (parsed) items.push(parsed)
  }

  return items
}

function parseItineraryItem(item: unknown): RawItineraryItem | null {
  // Bare string: e.g. `- train` or `- Tokyo`
  if (typeof item === "string") {
    const name = coercePlaceName(item)
    if (TRANSPORT_KEYWORDS.has(name.toLowerCase())) {
      return { type: "transport", mode: name.toLowerCase() as TransportMode }
    }
    return { type: "place", name, activities: [] }
  }

  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return null
  }

  const obj = item as Record<string, unknown>
  const keys = Object.keys(obj)

  if (keys.length === 0) return null

  const key = keys[0]
  const value = obj[key]

  const nameLower = key.toLowerCase()

  if (TRANSPORT_KEYWORDS.has(nameLower)) {
    return parseTransportLeg(nameLower as TransportMode, value)
  }

  return parsePlace(coercePlaceName(key), value)
}

// ─── Place ───────────────────────────────────────────────────────────────────

function parsePlace(name: string, value: unknown): RawPlace {
  if (value === null || value === undefined) {
    return { type: "place", name, activities: [] }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { type: "place", name, activities: [] }
  }

  const r = value as Record<string, unknown>

  return {
    type:      "place",
    name,
    arrives:   asString(r["arrives"]),
    departs:   asString(r["departs"]),
    duration:  asString(r["duration"]),
    timezone:  asString(r["timezone"]),
    location:  parseGeolocation(r["location"]),
    tags:      asStringArray(r["tags"]),
    stay:      parseStays(r["stay"]),
    activities: parseActivities(r["activities"]),
    info:      parseInfo(r["info"]),
    note:      asString(r["note"]),
  }
}

// ─── Transport leg ───────────────────────────────────────────────────────────

function parseTransportLeg(mode: TransportMode, value: unknown): RawTransportLeg {
  if (value === null || value === undefined) {
    return { type: "transport", mode }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { type: "transport", mode }
  }

  const r = value as Record<string, unknown>

  return {
    type:     "transport",
    mode,
    from:     parseGeolocation(r["from"]),
    to:       parseGeolocation(r["to"]),
    departs:  asString(r["departs"]),
    arrives:  asString(r["arrives"]),
    duration: asString(r["duration"]),
    info:     parseInfo(r["info"]),
    note:     asString(r["note"]),
  }
}

// ─── Activities ──────────────────────────────────────────────────────────────

function parseActivities(raw: unknown): RawActivityItem[] {
  if (!Array.isArray(raw)) return []

  const items: RawActivityItem[] = []

  for (const item of raw) {
    const parsed = parseActivityItem(item)
    if (parsed) items.push(parsed)
  }

  return items
}

function parseActivityItem(item: unknown): RawActivityItem | null {
  if (typeof item === "string") {
    return { type: "activity", name: item }
  }

  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return null
  }

  const obj = item as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return null

  const key = keys[0]
  const value = obj[key]

  if (ACTIVITY_GROUP_KEYWORDS.has(key)) {
    return parseActivityGroup(key as GroupKind, value)
  }

  return parseActivity(key, value)
}

function parseActivity(name: string, value: unknown): RawActivity {
  if (value === null || value === undefined) {
    return { type: "activity", name }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { type: "activity", name }
  }

  const r = value as Record<string, unknown>

  return {
    type:     "activity",
    name,
    priority: asString(r["priority"]),
    tags:     asStringArray(r["tags"]),
    time:     asString(r["time"]),
    duration: asString(r["duration"]),
    location: parseGeolocation(r["location"]),
    info:     parseInfo(r["info"]),
    note:     asString(r["note"]),
  }
}

function parseActivityGroup(kind: GroupKind, value: unknown): RawActivityGroup {
  // Two forms:
  // Simple list form: `day:\n  - Item A\n  - Item B`
  // Block form: `day:\n    title: ...\n    items:\n      - ...`

  if (Array.isArray(value)) {
    // Simple list form — items directly
    return {
      type:  "group",
      kind,
      items: parseActivitiesFromList(value),
    }
  }

  if (typeof value !== "object" || value === null) {
    return { type: "group", kind, items: [] }
  }

  const r = value as Record<string, unknown>

  return {
    type:     "group",
    kind,
    title:    asString(r["title"]),
    time:     asString(r["time"]),
    duration: asString(r["duration"]),
    items:    parseActivitiesFromList(r["items"]),
  }
}

function parseActivitiesFromList(raw: unknown): RawActivity[] {
  if (!Array.isArray(raw)) return []

  const items: RawActivity[] = []

  for (const item of raw) {
    if (typeof item === "string") {
      items.push({ type: "activity", name: item })
      continue
    }

    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>
      const keys = Object.keys(obj)
      if (keys.length > 0) {
        const key = keys[0]
        items.push(parseActivity(key, obj[key]))
      }
    }
  }

  return items
}

// ─── Stays ───────────────────────────────────────────────────────────────────

function parseStays(raw: unknown): RawStay[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const stays: RawStay[] = []

  for (const item of raw) {
    if (typeof item === "string") {
      stays.push({ name: item })
      continue
    }

    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>
      const keys = Object.keys(obj)
      if (keys.length > 0) {
        const key = keys[0]
        const value = obj[key]
        stays.push(parseStay(key, value))
      }
    }
  }

  return stays.length > 0 ? stays : undefined
}

function parseStay(name: string, value: unknown): RawStay {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return { name }
  }

  const r = value as Record<string, unknown>

  return {
    name,
    arrives:  asString(r["arrives"]),
    departs:  asString(r["departs"]),
    duration: asString(r["duration"]),
    location: parseGeolocation(r["location"]),
    tags:     asStringArray(r["tags"]),
    info:     parseInfo(r["info"]),
    note:     asString(r["note"]),
  }
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

function parseGeolocation(raw: unknown): RawGeolocation | undefined {
  if (raw === null || raw === undefined) return undefined

  if (typeof raw === "string") return raw

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>
    const geo: { name?: string; address?: string; lat?: number; lng?: number } = {}

    if (typeof r["name"]    === "string") geo.name    = r["name"]
    if (typeof r["address"] === "string") geo.address = r["address"]
    if (typeof r["lat"]     === "number") geo.lat     = r["lat"]
    if (typeof r["lng"]     === "number") geo.lng     = r["lng"]

    return geo
  }

  return undefined
}

// ─── Info (MetadataList) ─────────────────────────────────────────────────────

function parseInfo(raw: unknown): MetadataItem[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const items: MetadataItem[] = []

  for (const item of raw) {
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>
      for (const [k, v] of Object.entries(obj)) {
        if (k.trim() === "") continue
        if (typeof v === "string" || typeof v === "number") {
          items.push({ key: k, value: v })
        }
      }
    }
  }

  return items.length > 0 ? items : undefined
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") return value
  // YAML may parse dates as Date objects or numbers — convert to string
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result = value.filter((v): v is string => typeof v === "string")
  return result.length > 0 ? result : undefined
}

function coercePlaceName(name: unknown): string {
  if (typeof name === "string") return name
  if (name instanceof Date) return name.toISOString().slice(0, 10)
  if (typeof name === "number" || typeof name === "boolean") {
    console.warn(`[crumb] Place name "${name}" is not a string — coercing. Quote it in the source file to be explicit.`)
    return String(name)
  }
  if (name === null || name === undefined) {
    console.warn(`[crumb] Place name is null/undefined — coercing to "null". Quote it in the source file.`)
    return "null"
  }
  return String(name)
}
