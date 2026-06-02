/**
 * Plan view-model
 *
 * Projects a Place's unified `plan` list into the stay/activity shapes the
 * renderer consumes. Stays are surfaced as their own section; activities and
 * groups keep their order, with consecutive loose activities merged into a
 * single "ungrouped" block for display.
 *
 * All three consumers — html.ts (static render), app-map.ts (markers), and
 * browser-app.ts (runtime modal navigation) — derive their stay/activity lists
 * here, so the flat indices they assign stay consistent with one another.
 */

import { GroupKind } from "../types/primitives"
import { Activity, Place, ResolvedDuration, ResolvedMoment, Stay } from "../types/resolved"

export interface UngroupedActivities {
  type:  "ungrouped"
  items: Activity[]
}

export interface RenderActivityGroup {
  type:      "group"
  kind:      GroupKind
  title?:    string
  time?:     ResolvedMoment
  duration?: ResolvedDuration
  items:     Activity[]
}

export type RenderActivityItem = UngroupedActivities | RenderActivityGroup

/** Every stay in a place's plan, in order. */
export function placeStays(place: Place): Stay[] {
  return place.plan.filter((p): p is Stay => p.type === "stay")
}

/**
 * A place's activities and groups (stays excluded), with runs of consecutive
 * loose activities collapsed into one "ungrouped" block — matching how the
 * renderer lays out a place body.
 */
export function placeActivityItems(place: Place): RenderActivityItem[] {
  const items: RenderActivityItem[] = []
  let buffer: Activity[] = []

  const flush = () => {
    if (buffer.length) { items.push({ type: "ungrouped", items: buffer }); buffer = [] }
  }

  for (const p of place.plan) {
    if (p.type === "stay") continue            // rendered separately, doesn't split a run
    if (p.type === "activity") { buffer.push(p); continue }
    flush()
    items.push({ type: "group", kind: p.kind, title: p.title, time: p.time, duration: p.duration, items: p.plan })
  }
  flush()

  return items
}
