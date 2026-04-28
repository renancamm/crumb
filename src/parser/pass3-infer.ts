/**
 * Pass 3 — Inference
 *
 * Enriches the resolved document with inferred information:
 *   3.1  Wrap ungrouped activities into UngroupedActivities containers
 *   3.2  Infer transport from/to endpoints from neighbouring places
 *   3.3  Inject default time on day/week groups
 *   3.4  inferTimeline() — 5-phase constraint propagation:
 *          Phase 1: intra-item resolution (2 of {arrives, departs, duration} → 3rd)
 *          Phase 4: even distribution (split remaining time across duration-less places)
 *          Phase 1 again: re-run with newly distributed durations
 *          Phase 2: forward sweep (propagate end dates left→right)
 *          Phase 3: backward sweep (propagate start dates right→left)
 *   3.5  Relative date resolution — resolve "next day", "Day N" to calendar dates
 */

import {
  ActivityGroup,
  ActivityItem,
  CrumbDocument,
  ItineraryItem,
  Place,
  ResolvedDuration,
  ResolvedMoment,
  TransportLeg,
  UngroupedActivities,
} from "../types/resolved"

// ─── Entry point ─────────────────────────────────────────────────────────────

export function infer(doc: CrumbDocument): CrumbDocument {
  const itinerary = doc.itinerary

  // 3.1 — Wrap ungrouped activities (already done partially in Pass 2,
  //        now we merge consecutive single-item ungrouped containers)
  for (const item of itinerary) {
    if (item.type === "place") {
      item.activities = mergeUngrouped(item.activities)
    }
  }

  // 3.2 — Infer transport endpoints
  for (let i = 0; i < itinerary.length; i++) {
    const item = itinerary[i]
    if (item.type !== "transport") continue

    if (!item.from) {
      const prev = nearestPlace(itinerary, i, -1)
      if (prev) item.from = { label: prev.name }
    }
    if (!item.to) {
      const next = nearestPlace(itinerary, i, +1)
      if (next) item.to = { label: next.name }
    }
  }

  // 3.3 — Inject default time on day/week groups
  for (const item of itinerary) {
    if (item.type !== "place") continue
    for (const actItem of item.activities) {
      if (actItem.type !== "group") continue
      const group = actItem as ActivityGroup
      if (group.kind === "plan") continue
      if (!group.time) {
        const relValue = group.kind === "day" ? "next day" : "next week"
        group.time = {
          date:  { precision: "relative", value: relValue },
          label: relValue,
        }
      }
    }
  }

  // 3.4 — Timeline inference
  inferTimeline(itinerary)

  // 3.5 — Relative date resolution (runs after inferTimeline so place.arrives may be inferred)
  for (let i = 0; i < itinerary.length; i++) {
    const item = itinerary[i]
    if (item.type !== "place") continue

    const place = item as Place
    const arrivalDate = momentToISO(place.arrives)

    let dayGroupIndex = 0
    for (const actItem of place.activities) {
      if (actItem.type === "ungrouped") {
        if (arrivalDate) {
          for (const act of actItem.items) {
            if (act.time && !act.time.anchor && !isAbsoluteOrApproxDate(act.time)) {
              act.time = { ...act.time, anchor: { date: arrivalDate, precedence: "place" } }
            }
          }
        }
        continue
      }

      const group = actItem as ActivityGroup
      if (group.kind === "plan") continue

      if (group.time && group.time.date?.precision === "relative" && arrivalDate) {
        const resolvedDate = resolveRelativeGroupDate(
          group.time.date.value,
          arrivalDate,
          dayGroupIndex,
          momentToISO(place.departs),
        )

        if (resolvedDate) {
          group.time = {
            ...group.time,
            date:   { precision: "absolute", value: resolvedDate },
            anchor: { date: resolvedDate, precedence: "explicit" },
          }

          const groupPrecedence = group.time.anchor?.precedence ?? "explicit"
          for (const act of group.items) {
            if (!act.time) continue
            if (!isAbsoluteOrApproxDate(act.time)) {
              act.time = { ...act.time, anchor: { date: resolvedDate, precedence: groupPrecedence } }
            }
          }
        }
      } else if (group.time?.date?.precision === "absolute") {
        const groupDate      = group.time.date.value
        const groupPrecedence = group.time.anchor?.precedence ?? "explicit"
        for (const act of group.items) {
          if (!act.time) continue
          if (!isAbsoluteOrApproxDate(act.time)) {
            act.time = { ...act.time, anchor: { date: groupDate, precedence: groupPrecedence } }
          }
        }
      }

      dayGroupIndex++
    }
  }

  return doc
}

// ─── 3.4 — Timeline inference ─────────────────────────────────────────────────

function inferTimeline(itinerary: ItineraryItem[]): void {
  // Phase 1 — intra-item: derive missing field from any 2 known fields
  runIntraItem(itinerary)

  // Phase 4 — distribute remaining time across duration-less places within anchored spans.
  // Must run BEFORE the forward/backward sweeps so that explicit-only anchor detection
  // works correctly (sweeps would otherwise fill everything with incorrect inferred dates).
  distributeRemainingTime(itinerary)

  // Phase 1 again — re-run with newly distributed durations
  runIntraItem(itinerary)

  // Phase 2 — forward sweep: propagate end dates left→right
  let current: string | null = null
  for (let i = 0; i < itinerary.length; i++) {
    const item = itinerary[i]

    if (item.type === "transport") {
      const dISO = momentToISO(item.departs)
      const aISO = momentToISO(item.arrives)
      if (dISO) current = dISO
      if (aISO) {
        current = aISO
      } else {
        const bridgeDays = transportBridgeDays(item)
        if (current && bridgeDays > 0) current = addDays(current, bridgeDays)
      }
      continue
    }

    const place = item as Place
    const arrivesISO = momentToISO(place.arrives)
    const departsISO = momentToISO(place.departs)

    if (arrivesISO) {
      current = arrivesISO
    } else if (current && !place.arrives) {
      place.arrives = makeInferredMoment(current)
    }

    // Recompute in case we just wrote an inferred arrives
    const effectiveArrives = momentToISO(place.arrives)
    const days = placeDays(place)

    if (departsISO) {
      current = departsISO
    } else if (effectiveArrives && days > 0) {
      const inferredDeparts = addDays(effectiveArrives, days)
      current = inferredDeparts
      if (!place.departs) place.departs = makeInferredMoment(inferredDeparts)
    }
  }

  // Phase 3 — backward sweep: propagate start dates right→left
  current = null
  for (let i = itinerary.length - 1; i >= 0; i--) {
    const item = itinerary[i]

    if (item.type === "transport") {
      const dISO = momentToISO(item.departs)
      const aISO = momentToISO(item.arrives)
      if (aISO) current = aISO
      if (dISO) {
        current = dISO
      } else {
        const bridgeDays = transportBridgeDays(item)
        if (current && bridgeDays > 0) current = addDays(current, -bridgeDays)
      }
      continue
    }

    const place = item as Place
    const arrivesISO = momentToISO(place.arrives)
    const departsISO = momentToISO(place.departs)

    if (departsISO) {
      current = departsISO
    } else if (current && !place.departs) {
      place.departs = makeInferredMoment(current)
    }

    // Recompute in case we just wrote an inferred departs
    const effectiveDeparts = momentToISO(place.departs)
    const days = placeDays(place)

    if (arrivesISO) {
      current = arrivesISO
    } else if (effectiveDeparts && days > 0) {
      const inferredArrives = addDays(effectiveDeparts, -days)
      if (!place.arrives) place.arrives = makeInferredMoment(inferredArrives)
      current = inferredArrives
    } else if (effectiveDeparts) {
      current = effectiveDeparts
    }
  }
}

// Phase 1: for each place, if 2 of {arrives, departs, duration} are known, derive the 3rd
function runIntraItem(itinerary: ItineraryItem[]): void {
  for (const item of itinerary) {
    if (item.type !== "place") continue
    const place = item as Place

    const aISO = momentToISO(place.arrives)
    const dISO = momentToISO(place.departs)
    const days = placeDays(place)

    if (aISO && !place.departs && days > 0) {
      place.departs = makeInferredMoment(addDays(aISO, days))
    } else if (dISO && !place.arrives && days > 0) {
      place.arrives = makeInferredMoment(addDays(dISO, -days))
    } else if (aISO && dISO && !place.duration) {
      const n = daysBetween(aISO, dISO)
      if (n > 0) {
        // Exact when both dates are user-authored; approximate when either was inferred
        const anyInferred =
          place.arrives?.anchor?.precedence === "inferred" ||
          place.departs?.anchor?.precedence  === "inferred"
        place.duration = anyInferred ? makeSyntheticDuration(n) : makeExactDuration(n)
      }
    }
  }
}

// Phase 4: distribute remaining time evenly across duration-less places within spans
// bounded by EXPLICIT (non-inferred) anchor dates.
function distributeRemainingTime(itinerary: ItineraryItem[]): void {
  // Collect explicit anchor points: (place index, ISO date)
  // We only use user-authored dates — not engine-inferred ones.
  type Anchor = { idx: number; date: string }
  const anchors: Anchor[] = []

  for (let i = 0; i < itinerary.length; i++) {
    const item = itinerary[i]
    if (item.type !== "place") continue
    const place = item as Place

    const aISO = momentToISO(place.arrives)
    const dISO = momentToISO(place.departs)

    if (aISO && place.arrives?.anchor?.precedence !== "inferred") {
      anchors.push({ idx: i, date: aISO })
    }
    if (dISO && place.departs?.anchor?.precedence !== "inferred") {
      anchors.push({ idx: i, date: dISO })
    }
  }

  // Process each consecutive anchor pair
  for (let a = 0; a + 1 < anchors.length; a++) {
    const start = anchors[a]
    const end   = anchors[a + 1]
    const totalDays = daysBetween(start.date, end.date)
    if (totalDays <= 0) continue

    let committed = 0
    const durationless: Place[] = []

    for (let i = start.idx; i <= end.idx; i++) {
      const inner = itinerary[i]
      if (inner.type === "transport") {
        committed += transportBridgeDays(inner)
        continue
      }
      const p = inner as Place
      const pA = momentToISO(p.arrives)
      const pD = momentToISO(p.departs)
      const pAExplicit = pA != null && p.arrives?.anchor?.precedence !== "inferred"
      const pDExplicit = pD != null && p.departs?.anchor?.precedence !== "inferred"

      if (pAExplicit && pDExplicit) {
        // Fully explicitly anchored: count its span as committed
        committed += Math.max(0, daysBetween(pA!, pD!))
        continue
      }
      const days = placeDays(p)
      if (days > 0) {
        committed += days
        continue
      }
      durationless.push(p)
    }

    if (durationless.length === 0) continue
    const remaining = Math.max(0, totalDays - committed)
    if (remaining === 0) continue

    const perPlace = Math.floor(remaining / durationless.length)
    const extra    = remaining % durationless.length

    durationless.forEach((p, idx) => {
      const nights = perPlace + (idx < extra ? 1 : 0)
      if (nights > 0 && !p.duration) {
        p.duration = makeSyntheticDuration(nights)
      }
    })
  }
}

// ─── 3.1 — Merge consecutive ungrouped wrappers ──────────────────────────────

function mergeUngrouped(items: ActivityItem[]): ActivityItem[] {
  const result: ActivityItem[] = []

  for (const item of items) {
    if (item.type === "ungrouped") {
      const last = result[result.length - 1]
      if (last && last.type === "ungrouped") {
        last.items.push(...item.items)
      } else {
        result.push({ type: "ungrouped", items: [...item.items] } as UngroupedActivities)
      }
    } else {
      result.push(item)
    }
  }

  return result
}

// ─── 3.2 — Nearest place lookup ──────────────────────────────────────────────

function nearestPlace(
  itinerary: CrumbDocument["itinerary"],
  from: number,
  direction: -1 | 1,
): Place | null {
  let i = from + direction
  while (i >= 0 && i < itinerary.length) {
    if (itinerary[i].type === "place") return itinerary[i] as Place
    i += direction
  }
  return null
}

// ─── 3.5 — Relative date resolution ─────────────────────────────────────────

const WEEKDAY_NAMES = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]

function resolveRelativeGroupDate(
  relValue: string,
  arrivalDate: string,
  groupIndex: number,
  departureDate?: string | null,
): string | null {
  const lower = relValue.toLowerCase()

  if (lower === "next day") {
    return addDays(arrivalDate, groupIndex)
  }

  if (lower === "next week") {
    return addDays(arrivalDate, groupIndex * 7)
  }

  if (lower === "first day") {
    return arrivalDate
  }

  if (lower === "last day") {
    return departureDate ?? null
  }

  const dayN = lower.match(/^day\s+(\d+)$/)
  if (dayN) {
    const n = parseInt(dayN[1], 10)
    if (n <= 0) return null
    return addDays(arrivalDate, n - 1)
  }

  const weekN = lower.match(/^week\s+(\d+)$/)
  if (weekN) {
    const n = parseInt(weekN[1], 10)
    if (n <= 0) return null
    return addDays(arrivalDate, (n - 1) * 7)
  }

  // Weekday names: Monday through Sunday
  const wdIdx = WEEKDAY_NAMES.indexOf(lower)
  if (wdIdx >= 0) {
    return nextWeekday(arrivalDate, wdIdx)
  }

  return null
}

/** Returns the next occurrence of the given weekday on or after fromDate.
 *  weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday */
function nextWeekday(fromDate: string, weekday: number): string {
  const [y, m, d] = fromDate.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  // JS Date: 0=Sun, 1=Mon, ..., 6=Sat; our indexing: 0=Mon, ..., 6=Sun
  const currentDay = date.getUTCDay()
  const targetDay  = (weekday + 1) % 7
  const daysToAdd  = (targetDay - currentDay + 7) % 7
  return addDays(fromDate, daysToAdd)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a usable ISO date string from any ResolvedMoment, or null. */
function momentToISO(m: ResolvedMoment | undefined): string | null {
  if (!m?.date) return null
  if (m.date.precision === "absolute")    return m.date.value
  if (m.date.precision === "approximate") return m.date.estimate
  return null
}

/** Resolve a place's duration to whole days (0 if sub-day or unknown). */
function placeDays(place: Place): number {
  return place.duration ? durationToDays(place.duration) : 0
}

/** Resolve a transport leg's duration to whole days (0 if not day-resolvable). */
function transportBridgeDays(leg: TransportLeg): number {
  return leg.duration ? durationToDays(leg.duration) : 0
}

function durationToDays(dur: ResolvedDuration): number {
  switch (dur.type) {
    case "exact":
    case "approximate":
    case "minimum":
      return toWholeDays(dur.value, dur.unit)
    case "range":
      return toWholeDays(dur.max, dur.unit)
    case "named": {
      const h = dur.estimate.unit === "hours" ? dur.estimate.value : 0
      return h >= 24 ? Math.floor(h / 24) : 0
    }
    default:
      return 0
  }
}

function toWholeDays(value: number, unit: string): number {
  if (unit === "nights" || unit === "days") return Math.round(value)
  if (unit === "weeks")                     return Math.round(value * 7)
  return 0
}

function makeInferredMoment(dateStr: string): ResolvedMoment {
  const [y, m, d] = dateStr.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return {
    date:   { precision: "absolute", value: dateStr },
    anchor: { date: dateStr, precedence: "inferred" },
    label:  `~${months[m - 1]} ${d}, ${y}`,
  }
}

function makeSyntheticDuration(nights: number): ResolvedDuration {
  return {
    type:  "approximate",
    value: nights,
    unit:  "nights",
    label: `~${nights} ${nights === 1 ? "night" : "nights"}`,
  }
}

function makeExactDuration(nights: number): ResolvedDuration {
  return {
    type:  "exact",
    value: nights,
    unit:  "nights",
    label: `${nights} ${nights === 1 ? "night" : "nights"}`,
  }
}

function isAbsoluteOrApproxDate(m: ResolvedMoment): boolean {
  return m.date?.precision === "absolute" || m.date?.precision === "approximate"
}

// ─── Date arithmetic ─────────────────────────────────────────────────────────

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00Z").getTime()
  const msB = new Date(b + "T00:00:00Z").getTime()
  return Math.round((msB - msA) / 86_400_000)
}
