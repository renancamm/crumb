/**
 * Pass 3 — Inference
 *
 * Enriches the resolved document with inferred information:
 *   3.1  Wrap ungrouped activities into UngroupedActivities containers
 *   3.2  Infer transport from/to endpoints from neighbouring places
 *   3.3  Inject default time on day/week groups
 *   3.4  Forward anchor propagation — assign calendar dates to places/groups
 *   3.5  Relative date resolution — resolve "next day", "Day N" to calendar dates
 */

import {
  ActivityGroup,
  ActivityItem,
  CrumbDocument,
  Place,
  ResolvedMoment,
  UngroupedActivities,
} from "../types"

// ─── Entry point ─────────────────────────────────────────────────────────────

export function pass3(doc: CrumbDocument): CrumbDocument {
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

  // 3.4 — Forward anchor propagation
  let currentDate: string | null = null

  for (let i = 0; i < itinerary.length; i++) {
    const item = itinerary[i]

    if (item.type === "transport") {
      // Transport leg with an absolute departs date updates currentDate
      if (item.departs?.date?.precision === "absolute") {
        currentDate = item.departs.date.value
      }
      continue
    }

    // Place
    const place = item as Place

    // Determine place arrival date
    let arrivalDate: string | null = null

    if (place.arrives?.date?.precision === "absolute") {
      arrivalDate = place.arrives.date.value
      currentDate = arrivalDate
    } else if (place.departs?.date?.precision === "absolute" && !place.arrives) {
      // Use departs as a proxy for the start if no arrives
      arrivalDate = currentDate
      currentDate = place.departs.date.value
    } else if (currentDate) {
      // Use propagated date from previous leg
      arrivalDate = currentDate
    }

    // 3.5 — Resolve day group dates
    let dayGroupIndex = 0
    for (const actItem of place.activities) {
      if (actItem.type === "ungrouped") {
        // Attach anchor to ungrouped activities if we have a date
        if (arrivalDate) {
          for (const act of actItem.items) {
            if (act.time && !act.time.anchor && !isAbsoluteDate(act.time)) {
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
        )

        if (resolvedDate) {
          group.time = {
            ...group.time,
            date:   { precision: "absolute", value: resolvedDate },
            anchor: { date: resolvedDate, precedence: "explicit" },
          }

          // Propagate anchor to items inside this group
          for (const act of group.items) {
            if (!act.time) continue
            if (!isAbsoluteDate(act.time)) {
              act.time = { ...act.time, anchor: { date: resolvedDate, precedence: "explicit" } }
            }
          }
        }
      } else if (group.time?.date?.precision === "absolute") {
        // Explicit date on group — propagate to items
        const groupDate = group.time.date.value
        for (const act of group.items) {
          if (!act.time) continue
          if (!isAbsoluteDate(act.time)) {
            act.time = { ...act.time, anchor: { date: groupDate, precedence: "explicit" } }
          }
        }
      }

      dayGroupIndex++
    }

    // Advance currentDate past this place
    currentDate = advanceDateByDuration(
      arrivalDate ?? currentDate,
      place,
    )
  }

  return doc
}

// ─── 3.1 — Merge consecutive ungrouped wrappers ──────────────────────────────

function mergeUngrouped(items: ActivityItem[]): ActivityItem[] {
  const result: ActivityItem[] = []

  for (const item of items) {
    if (item.type === "ungrouped") {
      const last = result[result.length - 1]
      if (last && last.type === "ungrouped") {
        // Merge into previous ungrouped container
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

function resolveRelativeGroupDate(
  relValue: string,
  arrivalDate: string,
  groupIndex: number, // 0-based index among day/week groups only
): string | null {
  const lower = relValue.toLowerCase()

  if (lower === "next day") {
    // First group (index 0) = arrival date, second = +1, etc.
    return addDays(arrivalDate, groupIndex)
  }

  if (lower === "next week") {
    return addDays(arrivalDate, groupIndex * 7)
  }

  // "Day 1" = arrival, "Day 2" = arrival+1
  const dayN = lower.match(/^day\s+(\d+)$/)
  if (dayN) {
    return addDays(arrivalDate, parseInt(dayN[1], 10) - 1)
  }

  // "Week 1" = arrival, "Week 2" = arrival+7
  const weekN = lower.match(/^week\s+(\d+)$/)
  if (weekN) {
    return addDays(arrivalDate, (parseInt(weekN[1], 10) - 1) * 7)
  }

  return null
}

// ─── 3.4 — Anchor propagation helpers ────────────────────────────────────────

function advanceDateByDuration(
  baseDate: string | null,
  place: Place,
): string | null {
  if (!baseDate) return null

  // Explicit departs date takes precedence
  if (place.departs?.date?.precision === "absolute") {
    return place.departs.date.value
  }

  // Use duration
  if (!place.duration) return baseDate

  const dur = place.duration
  let days = 0

  if (dur.type === "exact" || dur.type === "approximate" || dur.type === "minimum") {
    days = durationToDays(dur.value, dur.unit)
  } else if (dur.type === "range") {
    days = durationToDays(dur.max, dur.unit)
  }

  if (days === 0) return baseDate

  return addDays(baseDate, days)
}

function durationToDays(value: number, unit: string): number {
  if (unit === "nights" || unit === "days") return value
  if (unit === "weeks") return value * 7
  return 0
}

function isAbsoluteDate(moment: ResolvedMoment): boolean {
  return moment.date?.precision === "absolute"
}

// ─── Date arithmetic ─────────────────────────────────────────────────────────

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
