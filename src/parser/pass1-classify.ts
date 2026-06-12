/**
 * Pass 1 — Structure
 *
 * Transforms the raw JavaScript object produced by js-yaml into a
 * RawCrumbDocument. No field values are resolved here — moments, durations,
 * and geolocations remain raw strings or objects.
 *
 * The model is one recursive rule: every list has a default kind, and an item
 * is either a bare string (the default kind, name only) or a mapping whose key
 * names its kind. The kind key's value is the item's name (its mode, for
 * transport; its title, for a group); all other keys are sibling fields.
 *
 *   itinerary  — default `place`; other kind `transport`
 *   plan       — default `activity`; other kinds `stay`, `day`, `week`, `group`
 *
 * Unknown kinds and unknown fields are hard errors, so malformed input is
 * reported rather than silently reshaped.
 */

import {
  GroupKind,
  GROUP_KINDS,
  MetadataItem,
  TransportMode,
  TRANSPORT_MODES,
  TripMeta,
} from "../types/primitives"
import {
  RawActivity,
  RawActivityGroup,
  RawCrumbDocument,
  RawGeolocation,
  RawItineraryItem,
  RawPlace,
  RawPlanItem,
  RawStay,
  RawTransportLeg,
} from "../types/raw"
import {
  ACTIVITY_FIELDS,
  GROUP_FIELDS,
  PLACE_FIELDS,
  STAY_FIELDS,
  TOP_LEVEL_KEYS,
  TRANSPORT_FIELDS,
  TRIP_FIELDS,
} from "./vocab"

// ─── Vocabularies & field sets ───────────────────────────────────────────────

const TRANSPORT_MODE_SET = new Set<string>(TRANSPORT_MODES)
const GROUP_KIND_SET     = new Set<string>(GROUP_KINDS)

const ITINERARY_KINDS = ["place", "transport"]
const PLAN_KINDS      = ["activity", "stay", "day", "week", "group"]

// ─── Entry point ─────────────────────────────────────────────────────────────

export function classify(raw: unknown): RawCrumbDocument {
  const doc = asMapping(raw)
  if (!doc) {
    throw new Error("Invalid crumb document: the root must be a YAML mapping with `trip` and/or `itinerary`.")
  }

  rejectUnknownKeys(doc, TOP_LEVEL_KEYS, "the document root")

  return {
    trip:      doc["trip"] != null ? parseTripMeta(doc["trip"]) : undefined,
    itinerary: parseItinerary(doc["itinerary"]),
  }
}

// ─── Trip metadata ───────────────────────────────────────────────────────────

function parseTripMeta(raw: unknown): TripMeta {
  const r = asMapping(raw)
  if (!r) return {}

  rejectUnknownKeys(r, TRIP_FIELDS, "`trip`")

  return {
    name:     asString(r["name"]),
    author:   asString(r["author"]),
    duration: asString(r["duration"]),
    tags:     asStringArray(r["tags"]),
    info:     parseInfo(r["info"]),
    note:     asString(r["note"]),
  }
}

// ─── Itinerary ───────────────────────────────────────────────────────────────

function parseItinerary(raw: unknown): RawItineraryItem[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw new Error("`itinerary` must be a list of places and transport legs.")
  }
  return raw.map(parseItineraryItem)
}

function parseItineraryItem(item: unknown): RawItineraryItem {
  // Bare string → a place (the itinerary's default kind).
  if (isScalar(item)) {
    return { type: "place", name: scalarToString(item), plan: [] }
  }

  const obj = asMapping(item)
  if (!obj) {
    throw new Error("Each itinerary item must be a place name or a mapping keyed `place` or `transport`.")
  }

  const kind = pickKind(obj, ITINERARY_KINDS, "an itinerary item",
    'Write "- place: Name" for a stop or "- transport: train" for a leg.')

  if (kind === "transport") return parseTransport(obj)
  return parsePlace(requireName(obj["place"], "place"), obj)
}

// ─── Place ───────────────────────────────────────────────────────────────────

function parsePlace(name: string, obj: Record<string, unknown>): RawPlace {
  rejectUnknownFields(obj, "place", PLACE_FIELDS, "place", name)

  return {
    type:     "place",
    name,
    arrives:  asString(obj["arrives"]),
    departs:  asString(obj["departs"]),
    duration: asString(obj["duration"]),
    location: parseGeolocation(obj["location"]),
    tags:     asStringArray(obj["tags"]),
    plan:     parsePlan(obj["plan"]),
    info:     parseInfo(obj["info"]),
    note:     asString(obj["note"]),
  }
}

// ─── Transport leg ───────────────────────────────────────────────────────────

function parseTransport(obj: Record<string, unknown>): RawTransportLeg {
  rejectUnknownFields(obj, "transport", TRANSPORT_FIELDS, "transport leg")

  return {
    type:     "transport",
    mode:     parseMode(obj["transport"]),
    from:     parseGeolocation(obj["from"]),
    to:       parseGeolocation(obj["to"]),
    departs:  asString(obj["departs"]),
    arrives:  asString(obj["arrives"]),
    duration: asString(obj["duration"]),
    info:     parseInfo(obj["info"]),
    note:     asString(obj["note"]),
  }
}

// ─── Plan (a place's list of stays, activities, and groups) ───────────────────

function parsePlan(raw: unknown): RawPlanItem[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw new Error("`plan` must be a list of activities, stays, and groups.")
  }
  return raw.map(parsePlanItem)
}

function parsePlanItem(item: unknown): RawPlanItem {
  // Bare string → an activity (the plan's default kind).
  if (isScalar(item)) {
    return { type: "activity", name: scalarToString(item) }
  }

  const obj = asMapping(item)
  if (!obj) {
    throw new Error("Each plan item must be an activity name or a mapping keyed `activity`, `stay`, `day`, `week`, or `group`.")
  }

  const kind = pickKind(obj, PLAN_KINDS, "a plan item",
    'Write "- activity: Name", "- stay: Hotel", or "- day:" / "- week:" / "- group:".')

  if (kind === "stay")            return parseStay(requireName(obj["stay"], "stay"), obj)
  if (GROUP_KIND_SET.has(kind))   return parseGroup(kind as GroupKind, obj)
  return parseActivity(requireName(obj["activity"], "activity"), obj)
}

function parseActivity(name: string, obj: Record<string, unknown>): RawActivity {
  rejectUnknownFields(obj, "activity", ACTIVITY_FIELDS, "activity", name)

  return {
    type:     "activity",
    name,
    priority: asString(obj["priority"]),
    tags:     asStringArray(obj["tags"]),
    time:     asString(obj["time"]),
    duration: asString(obj["duration"]),
    location: parseGeolocation(obj["location"]),
    info:     parseInfo(obj["info"]),
    note:     asString(obj["note"]),
  }
}

function parseStay(name: string, obj: Record<string, unknown>): RawStay {
  rejectUnknownFields(obj, "stay", STAY_FIELDS, "stay", name)

  return {
    type:     "stay",
    name,
    arrives:  asString(obj["arrives"]),
    departs:  asString(obj["departs"]),
    duration: asString(obj["duration"]),
    location: parseGeolocation(obj["location"]),
    tags:     asStringArray(obj["tags"]),
    info:     parseInfo(obj["info"]),
    note:     asString(obj["note"]),
  }
}

function parseGroup(kind: GroupKind, obj: Record<string, unknown>): RawActivityGroup {
  rejectUnknownFields(obj, kind, GROUP_FIELDS, `${kind} group`)

  return {
    type:     "group",
    kind,
    title:    optionalTitle(obj[kind], kind),
    time:     asString(obj["time"]),
    duration: asString(obj["duration"]),
    plan:     parseGroupPlan(obj["plan"], kind),
  }
}

/** A group's `plan` holds activities only — no nested groups or stays. */
function parseGroupPlan(raw: unknown, kind: GroupKind): RawActivity[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw new Error(`A ${kind} group's \`plan\` must be a list of activities.`)
  }

  return raw.map((item) => {
    if (isScalar(item)) return { type: "activity", name: scalarToString(item) } as RawActivity

    const obj = asMapping(item)
    if (!obj) {
      throw new Error(`A ${kind} group's \`plan\` must contain activities.`)
    }

    const k = pickKind(obj, PLAN_KINDS, `an item in a ${kind} group`,
      "Groups contain only activities — no nested groups or stays.")
    if (k !== "activity") {
      throw new Error(`A ${kind} group's \`plan\` holds only activities, but found "${k}". Groups cannot be nested, and stays belong in a place's plan.`)
    }
    return parseActivity(requireName(obj["activity"], "activity"), obj)
  })
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

function parseGeolocation(raw: unknown): RawGeolocation | undefined {
  if (raw == null) return undefined
  if (typeof raw === "string") return raw

  const r = asMapping(raw)
  if (!r) return undefined

  const geo: { address?: string; lat?: number; lng?: number } = {}
  if (typeof r["address"] === "string") geo.address = r["address"]
  if (typeof r["lat"]     === "number") geo.lat     = r["lat"]
  if (typeof r["lng"]     === "number") geo.lng     = r["lng"]
  return geo
}

// ─── Info (MetadataList — a plain map of custom key-value pairs) ──────────────

function parseInfo(raw: unknown): MetadataItem[] | undefined {
  const r = asMapping(raw)
  if (!r) return undefined

  const items: MetadataItem[] = []
  for (const [k, v] of Object.entries(r)) {
    if (k.trim() === "") continue
    const value = scalarToInfoValue(v)
    if (value != null) items.push({ key: k, value })
  }

  return items.length > 0 ? items : undefined
}

// ─── Kind dispatch & field validation ─────────────────────────────────────────

/** Identify which of the recognized kind keywords this mapping declares. */
function pickKind(
  obj: Record<string, unknown>,
  recognized: string[],
  context: string,
  hint: string,
): string {
  const present = recognized.filter((k) => k in obj)

  if (present.length === 0) {
    const found = Object.keys(obj).map((k) => `"${k}"`).join(", ") || "none"
    throw new Error(`${capitalize(context)} must declare its kind. Expected one of: ${recognized.join(", ")}. Found: ${found}. ${hint}`)
  }
  if (present.length > 1) {
    throw new Error(`${capitalize(context)} declares more than one kind (${present.join(", ")}). Each item is exactly one kind.`)
  }
  return present[0]
}

/** Reject any key that is neither the kind discriminator nor a known field. */
function rejectUnknownFields(
  obj: Record<string, unknown>,
  kindKey: string,
  allowed: readonly string[],
  kindLabel: string,
  name?: string,
): void {
  for (const key of Object.keys(obj)) {
    if (key === kindKey) continue
    if (!allowed.includes(key)) {
      const who = name ? `${kindLabel} "${name}"` : kindLabel
      throw new Error(`Unknown field "${key}" on ${who}. Valid fields: ${allowed.join(", ")}. Put custom details under "info".`)
    }
  }
}

function rejectUnknownKeys(obj: Record<string, unknown>, allowed: readonly string[], context: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      throw new Error(`Unknown key "${key}" in ${context}. Valid keys: ${allowed.join(", ")}.`)
    }
  }
}

// ─── Value coercion ────────────────────────────────────────────────────────────

/** The name/mode/title that follows a kind key must be a scalar, never a block. */
function requireName(value: unknown, kindLabel: string): string {
  if (typeof value === "string") {
    if (value.trim() === "") throw new Error(`A ${kindLabel} requires a name.`)
    return value
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value == null) {
    throw new Error(`A ${kindLabel} requires a name — write "- ${kindLabel}: Name".`)
  }
  throw new Error(`Expected a name after "${kindLabel}:", but found a nested block. ${capitalize(kindLabel)} fields are siblings of the "${kindLabel}" key, not nested under it.`)
}

function optionalTitle(value: unknown, kind: string): string | undefined {
  if (value == null) return undefined
  if (typeof value === "string") return value.trim() === "" ? undefined : value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  throw new Error(`Expected a title (or nothing) after "${kind}:", but found a nested block. Group fields (time, duration, plan) are siblings.`)
}

function parseMode(value: unknown): TransportMode {
  if (value == null) return "other"
  if (typeof value === "object") {
    throw new Error('Expected a transport mode after "transport:", but found a nested block. Transport fields are siblings.')
  }
  const m = String(value).trim().toLowerCase()
  return (TRANSPORT_MODE_SET.has(m) ? m : "other") as TransportMode
}

// ─── Scalar helpers ────────────────────────────────────────────────────────────

function asMapping(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value) || value instanceof Date) {
    return null
  }
  return value as Record<string, unknown>
}

function isScalar(value: unknown): boolean {
  return typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || value instanceof Date
}

function scalarToString(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result = value.filter((v): v is string => typeof v === "string")
  return result.length > 0 ? result : undefined
}

function scalarToInfoValue(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "boolean") return String(value)
  return undefined
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
