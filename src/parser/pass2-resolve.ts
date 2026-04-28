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

  // Fuzzy date expressions ("early October", "mid-March 2026", "spring 2027", …)
  const fuzzyDate = parseFuzzyDate(s)
  if (fuzzyDate) {
    return { date: fuzzyDate, label }
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

const WEEKDAY_NAMES = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]

function parseRelativeDate(s: string): DateRef | null {
  const lower = s.toLowerCase()

  // "next day", "next week"
  if (lower === "next day" || lower === "next week") {
    return { precision: "relative", value: lower }
  }

  // "first day" / "last day"
  if (lower === "first day" || lower === "last day") {
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

  // Weekday names: Monday through Sunday
  if (WEEKDAY_NAMES.includes(lower)) {
    return { precision: "relative", value: lower }
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

  // Named span range: "half day to all day", "overnight - all day"
  const namedRangeMatch = s.match(/^(.+?)\s+(?:to|-)\s+(.+)$/)
  if (namedRangeMatch) {
    const minSpan = parseNamedSpan(namedRangeMatch[1].trim())
    const maxSpan = parseNamedSpan(namedRangeMatch[2].trim())
    if (minSpan && maxSpan && minSpan !== maxSpan) {
      return {
        type:        "named-range",
        min:         minSpan,
        max:         maxSpan,
        minEstimate: namedSpanEstimate(minSpan),
        maxEstimate: namedSpanEstimate(maxSpan),
        label,
      }
    }
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
      const min = parseFloat(rangeMatch[1])
      const max = parseFloat(rangeMatch[2])
      if (min < max) return { type: "range", min, max, unit, label }
      return { type: "unknown", label }
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

  // Block form — validate coordinate ranges; discard pair if either is out of bounds
  const validCoords =
    raw.lat != null && raw.lng != null &&
    raw.lat >= -90 && raw.lat <= 90 &&
    raw.lng >= -180 && raw.lng <= 180

  const lat = validCoords ? raw.lat : undefined
  const lng = validCoords ? raw.lng : undefined

  const label =
    raw.name ??
    raw.address ??
    (validCoords ? `${raw.lat}, ${raw.lng}` : "location")

  return {
    label,
    name:    raw.name,
    address: raw.address,
    lat,
    lng,
  }
}

// ─── Fuzzy date parsing ──────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
}

function parseFuzzyDate(s: string): DateRef | null {
  // Normalise: lowercase and collapse hyphens to spaces ("mid-October" → "mid october")
  const lower = s.toLowerCase().trim().replace(/-/g, " ")

  // Seasons: "spring 2026", "summer 2026", "fall 2026", "autumn 2026", "winter 2026"
  const season = lower.match(/^(spring|summer|fall|autumn|winter)\s+(\d{4})$/)
  if (season) {
    const year = parseInt(season[2], 10)
    const estimates: Record<string, [number, number, number]> = {
      spring: [year,     4,  1],
      summer: [year,     7,  1],
      fall:   [year,    10,  1],
      autumn: [year,    10,  1],
      winter: [year + 1, 1,  1],
    }
    const [y, m, d] = estimates[season[1]]
    return { precision: "approximate", estimate: `${y}-${pad(m)}-${pad(d)}` }
  }

  // "sometime in [Month] [Year?]"
  const sometime = lower.match(/^sometime in\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (sometime) {
    const month = MONTH_NAMES[sometime[1]]
    if (!month) return null
    const year = sometime[2] ? parseInt(sometime[2], 10) : inferYear(month, 15)
    return { precision: "approximate", estimate: `${year}-${pad(month)}-15` }
  }

  // "around [Month] [Day] [Year?]"  e.g. "around October 15, 2026"
  const aroundA = lower.match(/^around\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[, ]+(\d{4}))?$/)
  if (aroundA) {
    const month = MONTH_NAMES[aroundA[1]]
    const day   = parseInt(aroundA[2], 10)
    if (!month || isNaN(day)) return null
    const year = aroundA[3] ? parseInt(aroundA[3], 10) : inferYear(month, day)
    return { precision: "approximate", estimate: `${year}-${pad(month)}-${pad(day)}` }
  }

  // "around [Day] [Month] [Year?]"  e.g. "around 15 October 2026"
  const aroundB = lower.match(/^around\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:[, ]+(\d{4}))?$/)
  if (aroundB) {
    const day   = parseInt(aroundB[1], 10)
    const month = MONTH_NAMES[aroundB[2]]
    if (!month || isNaN(day)) return null
    const year = aroundB[3] ? parseInt(aroundB[3], 10) : inferYear(month, day)
    return { precision: "approximate", estimate: `${year}-${pad(month)}-${pad(day)}` }
  }

  // "[early|mid|middle of|late] [Month] [Year?]"
  const qualified = lower.match(/^(early|middle of|mid|late)\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (qualified) {
    const q     = qualified[1]
    const month = MONTH_NAMES[qualified[2]]
    if (!month) return null
    const day = q === "early" ? 5 : q.startsWith("mid") ? 15 : 25
    const year = qualified[3] ? parseInt(qualified[3], 10) : inferYear(month, day)
    return { precision: "approximate", estimate: `${year}-${pad(month)}-${pad(day)}` }
  }

  // "[Month] [Day]"  e.g. "September 15", "Sep 15" (no year) → relative
  const monthDay = lower.match(/^([a-z]+)\s+(\d{1,2})$/)
  if (monthDay && MONTH_NAMES[monthDay[1]]) {
    return { precision: "relative", value: s }
  }

  // "[Month] [Year]"  e.g. "September 2026" → relative
  const monthYear = lower.match(/^([a-z]+)\s+(\d{4})$/)
  if (monthYear && MONTH_NAMES[monthYear[1]]) {
    return { precision: "relative", value: s }
  }

  // "[Month]" bare → relative
  const monthOnly = lower.match(/^([a-z]+)$/)
  if (monthOnly && MONTH_NAMES[monthOnly[1]]) {
    return { precision: "relative", value: s }
  }

  return null
}

function inferYear(month: number, day: number): number {
  const thisYear = new Date().getFullYear()
  const today    = new Date().toISOString().slice(0, 10)
  const candidate = `${thisYear}-${pad(month)}-${pad(day)}`
  return candidate >= today ? thisYear : thisYear + 1
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
