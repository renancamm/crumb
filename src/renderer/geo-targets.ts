/**
 * DOM-free collection of geocoding targets from a parsed document.
 *
 * Shared by the viewer's map layer (`app-map.ts`) and the offline geo-cache
 * generator (`scripts/gen-geocache.ts`) so both issue byte-identical queries —
 * every key the generator bakes is one the viewer will actually look up.
 */

import type { CrumbDocument } from "../types/resolved"
import type { GeoTarget } from "./geocoder"
import { activityLabel } from "./format"
import { placeStays, placeActivityItems } from "./plan-view"

export interface ActivityGeoTarget extends GeoTarget {
  priority: string | null
  placeIdx: number
  actLabel: string
}

export interface StayGeoTarget extends GeoTarget {
  stayName:  string
  hasCoords: boolean
  placeIdx:  number
}

export function collectActivityGeoTargets(doc: CrumbDocument): ActivityGeoTarget[] {
  const targets: ActivityGeoTarget[] = []
  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    let dayIdx = 0, weekIdx = 0, groupIdx = 0, ungroupedIdx = 0
    for (const actItem of placeActivityItems(item)) {
      if (actItem.type === "group") {
        const isPlan = actItem.kind === "group"
        if (isPlan)                        groupIdx++
        else if (actItem.kind === "day")   dayIdx++
        else if (actItem.kind === "week")  weekIdx++
        const groupNum = isPlan ? groupIdx : actItem.kind === "day" ? dayIdx : actItem.kind === "week" ? weekIdx : undefined
        let actGroupIdx = 0
        for (const act of actItem.items) {
          if (!act.location?.geocodingDisabled) {
            // Query is the activity's location label (or, failing that, its
            // name) geocoded verbatim — the per-place parentCoords viewbox
            // supplies the region, so no city is appended.
            targets.push({
              name:     act.name,
              location: act.location ?? null,
              priority: act.priority ?? null,
              placeIdx,
              actLabel: activityLabel(actGroupIdx, groupNum),
            })
          }
          actGroupIdx++
        }
      } else {
        let localIdx = ungroupedIdx
        for (const act of actItem.items) {
          if (!act.location?.geocodingDisabled) {
            targets.push({
              name:     act.name,
              location: act.location ?? null,
              priority: act.priority ?? null,
              placeIdx,
              actLabel: activityLabel(localIdx),
            })
          }
          localIdx++
          ungroupedIdx++
        }
      }
    }
  }
  return targets
}

export function collectStayGeoTargets(doc: CrumbDocument): StayGeoTarget[] {
  const targets: StayGeoTarget[] = []
  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    for (const stay of placeStays(item)) {
      if (stay.location?.geocodingDisabled) continue
      const hasCoords = stay.location?.lat != null && stay.location?.lng != null
      targets.push({
        name:      stay.name,
        stayName:  stay.name,
        location:  stay.location ?? null,
        hasCoords,
        placeIdx,
      })
    }
  }
  return targets
}
