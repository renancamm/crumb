/**
 * Pass 2 — Field Resolution
 *
 * Resolves raw string values into typed structures:
 *   RawMoment     → ResolvedMoment
 *   RawDuration   → ResolvedDuration
 *   RawGeolocation → ResolvedGeolocation
 *
 * All other fields (priority, tags, info, note, timezone) are validated
 * and passed through. The output is structurally identical to the final
 * CrumbDocument except that inference (Pass 3) has not yet run.
 */

import {
  DurationUnit,
  LoosePeriod,
  NamedSpan,
  Priority,
  TripMeta,
} from "../types/primitives"
import {
  RawActivity,
  RawActivityGroup,
  RawActivityItem,
  RawCrumbDocument,
  RawDuration,
  RawGeolocation,
  RawItineraryItem,
  RawMoment,
  RawPlace,
  RawStay,
  RawTransportLeg,
} from "../types/raw"
import {
  Activity,
  ActivityGroup,
  ActivityItem,
  CrumbDocument,
  DateRef,
  DurationEstimate,
  Place,
  ResolvedDuration,
  ResolvedGeolocation,
  ResolvedMoment,
  Stay,
  TimeOfDay,
  TransportLeg,
  UngroupedActivities,
} from "../types/resolved"

// ─── Entry point ─────────────────────────────────────────────────────────────

export function resolve(raw: RawCrumbDocument): CrumbDocument {
  return {
    trip:      raw.trip ? resolveTripMeta(raw.trip) : undefined,
    itinerary: raw.itinerary.map(resolveItineraryItem),
  }
}

// ─── Trip meta ───────────────────────────────────────────────────────────────

function resolveTripMeta(meta: TripMeta): TripMeta {
  // TripMeta has no moment/duration/geo fields — pass through as-is
  return meta
}

// ─── Itinerary items ─────────────────────────────────────────────────────────

function resolveItineraryItem(item: RawItineraryItem): Place | TransportLeg {
  if (item.type === "place") return resolvePlace(item)
  return resolveTransportLeg(item)
}

function resolvePlace(raw: RawPlace): Place {
  return {
    type:       "place",
    name:       raw.name,
    arrives:    raw.arrives  != null ? resolveMoment(raw.arrives)  : undefined,
    departs:    raw.departs  != null ? resolveMoment(raw.departs)  : undefined,
    duration:   raw.duration != null ? resolveDuration(raw.duration) : undefined,
    timezone:   raw.timezone,
    location:   raw.location != null ? resolveGeolocation(raw.location) : undefined,
    tags:       raw.tags,
    stay:       raw.stay?.map(resolveStay),
    activities: resolveActivities(raw.activities),
    info:       raw.info,
    note:       raw.note,
  }
}

function resolveTransportLeg(raw: RawTransportLeg): TransportLeg {
  return {
    type:     "transport",
    mode:     raw.mode,
    from:     raw.from    != null ? resolveGeolocation(raw.from)    : undefined,
    to:       raw.to      != null ? resolveGeolocation(raw.to)      : undefined,
    departs:  raw.departs != null ? resolveMoment(raw.departs)      : undefined,
    arrives:  raw.arrives != null ? resolveMoment(raw.arrives)      : undefined,
    duration: raw.duration != null ? resolveDuration(raw.duration)  : undefined,
    info:     raw.info,
    note:     raw.note,
  }
}

function resolveStay(raw: RawStay): Stay {
  return {
    name:     raw.name,
    arrives:  raw.arrives  != null ? resolveMoment(raw.arrives)   : undefined,
    departs:  raw.departs  != null ? resolveMoment(raw.departs)   : undefined,
    duration: raw.duration != null ? resolveDuration(raw.duration) : undefined,
    location: raw.location != null ? resolveGeolocation(raw.location) : undefined,
    tags:     raw.tags,
    info:     raw.info,
    note:     raw.note,
  }
}

// ─── Activities ──────────────────────────────────────────────────────────────

function resolveActivities(items: RawActivityItem[]): ActivityItem[] {
  // Pass 2 produces a flat list; Pass 3 will wrap ungrouped items.
  // We cast ungrouped activities to a temporary representation.
  // Actually the return type here needs to match what Pass 3 expects.
  // We'll keep the raw structure as a "pre-pass3" list: groups resolved,
  // standalone activities resolved but not yet wrapped.
  // Since ActivityItem = UngroupedActivities | ActivityGroup, we'll
  // temporarily treat each standalone activity as a single-item UngroupedActivities
  // and let Pass 3 merge them.
  const result: ActivityItem[] = []

  for (const item of items) {
    if (item.type === "activity") {
      result.push({
        type:  "ungrouped",
        items: [resolveActivity(item)],
      } as UngroupedActivities)
    } else {
      result.push(resolveActivityGroup(item))
    }
  }

  return result
}

function resolveActivity(raw: RawActivity): Activity {
  return {
    type:     "activity",
    name:     raw.name,
    priority: resolveP(raw.priority),
    tags:     raw.tags,
    time:     raw.time     != null ? resolveMoment(raw.time)      : undefined,
    duration: raw.duration != null ? resolveDuration(raw.duration) : undefined,
    location: raw.location != null ? resolveGeolocation(raw.location) : undefined,
    info:     raw.info,
    note:     raw.note,
  }
}

function resolveActivityGroup(raw: RawActivityGroup): ActivityGroup {
  return {
    type:     "group",
    kind:     raw.kind,
    title:    raw.title,
    time:     raw.time     != null ? resolveMoment(raw.time)      : undefined,
    duration: raw.duration != null ? resolveDuration(raw.duration) : undefined,
    items:    raw.items.map(resolveActivity),
  }
}

function resolveP(raw: string | undefined): Priority | undefined {
  if (raw === "must" || raw === "maybe") return raw
  return undefined
}

// ─── Moment resolution ───────────────────────────────────────────────────────

// Named period estimates
const LOOSE_PERIODS: Record<LoosePeriod, string> = {
  "early morning":  "06:00",
  "morning":        "09:00",
  "midday":         "12:00",
  "afternoon":      "14:30",
  "late afternoon": "17:00",
  "evening":        "19:30",
  "night":          "22:00",
  "late night":     "02:00",
  "midnight":       "23:59",
}

export function resolveMoment(raw: RawMoment): ResolvedMoment {
  const label = raw
  const s = raw.trim()

  // ISO datetime with timezone offset: 2026-09-18T17:00+09:00
  const isoFull = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})([+-]\d{2}:\d{2}|Z)?$/)
  if (isoFull) {
    return {
      date:  { precision: "absolute", value: isoFull[1] },
      time:  { precision: "exact", value: isoFull[2] },
      label,
    }
  }

  // ISO date only: 2026-10-12
  const isoDate = s.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (isoDate) {
    return {
      date:  { precision: "absolute", value: isoDate[1] },
      label,
    }
  }

  // Named loose period (check before time parsing)
  const period = s.toLowerCase() as LoosePeriod
  if (period in LOOSE_PERIODS) {
    return {
      time:  { precision: "loose", value: period, estimate: LOOSE_PERIODS[period] },
      label,
    }
  }

  // Exact time: 8am, 2pm, 10:30, 9:00 AM, etc.
  const exactTime = parseTimeOfDay(s)
  if (exactTime) {
    return { time: exactTime, label }
  }

  // Relative date references
  const relativeDate = parseRelativeDate(s)
  if (relativeDate) {
    return { date: relativeDate, label }
  }

  // Fallback — unrecognised, store in label only
  return { label }
}

function parseTimeOfDay(s: string): TimeOfDay | null {
  // HH:MM
  const hhmm = s.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i)
  if (hhmm) {
    let h = parseInt(hhmm[1], 10)
    const m = parseInt(hhmm[2], 10)
    const ampm = hhmm[3]?.toLowerCase()
    if (ampm === "pm" && h < 12) h += 12
    if (ampm === "am" && h === 12) h = 0
    return { precision: "exact", value: `${pad(h)}:${pad(m)}` }
  }

  // Nh or Nhpm: 8am, 2pm, 10am
  const shortTime = s.match(/^(\d{1,2})(am|pm)$/i)
  if (shortTime) {
    let h = parseInt(shortTime[1], 10)
    const ampm = shortTime[2].toLowerCase()
    if (ampm === "pm" && h < 12) h += 12
    if (ampm === "am" && h === 12) h = 0
    return { precision: "exact", value: `${pad(h)}:00` }
  }

  return null
}

function parseRelativeDate(s: string): DateRef | null {
  const lower = s.toLowerCase()

  // "next day", "next week"
  if (lower === "next day" || lower === "next week") {
    return { precision: "relative", value: lower }
  }

  // "Day 1", "Day 2", "day 1"
  const dayN = lower.match(/^day\s+(\d+)$/)
  if (dayN) {
    return { precision: "relative", value: `Day ${dayN[1]}` }
  }

  // "Week 1", "Week 2"
  const weekN = lower.match(/^week\s+(\d+)$/)
  if (weekN) {
    return { precision: "relative", value: `Week ${weekN[1]}` }
  }

  return null
}

// ─── Duration resolution ─────────────────────────────────────────────────────

export function resolveDuration(raw: RawDuration): ResolvedDuration {
  const label = raw
  const s = raw.trim().toLowerCase()

  // Named spans
  const namedSpan = parseNamedSpan(s)
  if (namedSpan) {
    return { type: "named", span: namedSpan, estimate: namedSpanEstimate(namedSpan), label }
  }

  // Check for qualifiers
  const approxMatch = s.match(/^(?:around|approximately|about|~)\s+(.+)$/)
  if (approxMatch) {
    const inner = parseExactDuration(approxMatch[1])
    if (inner) return { type: "approximate", value: inner.value, unit: inner.unit, label }
  }

  const minMatch = s.match(/^(?:at least|minimum|min)\s+(.+)$/)
  if (minMatch) {
    const inner = parseExactDuration(minMatch[1])
    if (inner) return { type: "minimum", value: inner.value, unit: inner.unit, label }
  }

  // Range: "2-3 hours", "2 to 3 nights"
  const rangeMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s+(.+)$/)
  if (rangeMatch) {
    const unit = parseUnit(rangeMatch[3])
    if (unit) {
      return {
        type: "range",
        min:  parseFloat(rangeMatch[1]),
        max:  parseFloat(rangeMatch[2]),
        unit,
        label,
      }
    }
  }

  // Exact duration
  const exact = parseExactDuration(s)
  if (exact) {
    return { type: "exact", value: exact.value, unit: exact.unit, label }
  }

  return { type: "unknown", label }
}

function parseExactDuration(s: string): { value: number; unit: DurationUnit } | null {
  // Shorthand: 2h, 30m, 1h30m, 2h30m
  const shorthand = s.match(/^(?:(\d+)h)?(?:(\d+)m)?$/)
  if (shorthand && (shorthand[1] || shorthand[2])) {
    const hours   = parseInt(shorthand[1] ?? "0", 10)
    const minutes = parseInt(shorthand[2] ?? "0", 10)
    if (hours > 0 && minutes === 0) return { value: hours, unit: "hours" }
    if (minutes > 0 && hours === 0) return { value: minutes, unit: "minutes" }
    // Combined h+m: store as total minutes
    return { value: hours * 60 + minutes, unit: "minutes" }
  }

  // Plain English: "2 hours", "3 nights", "1 week", "45 minutes", "2 days"
  const plainMatch = s.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)
  if (plainMatch) {
    const value = parseFloat(plainMatch[1])
    const unit  = parseUnit(plainMatch[2])
    if (unit) return { value, unit }
  }

  // "1 night" (singular)
  const nightSingular = s.match(/^(\d+)\s+night$/)
  if (nightSingular) {
    return { value: parseInt(nightSingular[1], 10), unit: "nights" }
  }

  return null
}

function parseUnit(s: string): DurationUnit | null {
  const u = s.trim().toLowerCase()
  if (u === "minute"  || u === "minutes" || u === "min" || u === "mins") return "minutes"
  if (u === "hour"    || u === "hours"   || u === "hr"  || u === "hrs")  return "hours"
  if (u === "day"     || u === "days")                                    return "days"
  if (u === "night"   || u === "nights")                                  return "nights"
  if (u === "week"    || u === "weeks")                                   return "weeks"
  return null
}

function parseNamedSpan(s: string): NamedSpan | null {
  if (s === "all day" || s === "all-day") return "all day"
  if (s === "half day" || s === "half-day") return "half day"
  if (s === "overnight") return "overnight"
  return null
}

function namedSpanEstimate(span: NamedSpan): DurationEstimate {
  if (span === "all day")   return { value: 10, unit: "hours" }
  if (span === "half day")  return { value: 5,  unit: "hours" }
  return { value: 1, unit: "nights" }
}

// ─── Geolocation resolution ──────────────────────────────────────────────────

export function resolveGeolocation(raw: RawGeolocation): ResolvedGeolocation {
  if (typeof raw === "string") {
    if (raw.trim().toLowerCase() === "none") {
      return { label: "none", geocodingDisabled: true }
    }
    return { label: raw }
  }

  // Block form
  const label =
    raw.name ??
    raw.address ??
    (raw.lat != null && raw.lng != null ? `${raw.lat}, ${raw.lng}` : "location")

  return {
    label,
    name:    raw.name,
    address: raw.address,
    lat:     raw.lat,
    lng:     raw.lng,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
