import { state, ZOOM_PLACE_FLY, ZOOM_DETAIL_FLY, FLY_DURATION, type FocusType } from "./app-state"

export function clearFocus(): void {
  state.focusedPlaceIdx  = -1
  state.focusedActName   = null
  state.focusedStayName  = null
  state.focusedTransportName   = null
  state.placeMarkers.forEach(m => m.getElement().classList.remove("--focused"))
  state.detailMarkers.forEach(m => m.getElement().classList.remove("--focused"))
}

/**
 * Highlight the focused marker (place or detail), clearing any previous focus.
 * No camera move — call from navigation, which does its own fly. The focus state
 * is recorded so setPlaceSource/setDetailSource re-apply it after a re-render.
 */
export function highlightMarker(type: FocusType, id: string | number): void {
  clearFocus()
  if (type === "place") {
    const idx = id as number
    state.focusedPlaceIdx = idx
    state.placeMarkers[idx - 1]?.getElement().classList.add("--focused")
  } else {
    const name = id as string
    if (type === "activity") state.focusedActName  = name
    if (type === "stay")     state.focusedStayName = name
    if (type === "transport") state.focusedTransportName = name
    for (const m of state.detailMarkers) {
      if (m.getElement().dataset.name === name) { m.getElement().classList.add("--focused"); break }
    }
  }
}

/** Highlight a marker AND fly the camera to it — used for direct from/to clicks. */
export function focusMarker(type: FocusType, id: string | number, coords?: { lat: number; lng: number }): void {
  highlightMarker(type, id)
  if (!coords) return
  if (type === "place") {
    state.map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(state.map.getZoom(), ZOOM_PLACE_FLY), duration: FLY_DURATION })
  } else {
    const target = { center: [coords.lng, coords.lat] as [number, number], zoom: Math.max(state.map.getZoom(), ZOOM_DETAIL_FLY), duration: FLY_DURATION }
    // Transport endpoints can be far apart — flyTo's arc reads better over distance.
    // Activities/stays are short hops where flyTo's mid-flight zoom-out would dip
    // below ZOOM_DETAIL and flash the detail markers, so they use the linear easeTo.
    if (type === "transport") state.map.flyTo(target)
    else                      state.map.easeTo(target)
  }
}

// Transport from/to waypoint click → fly/focus the map. Waypoints are the only
// elements carrying data-map-link (set by decorateTransportWaypoints): a solved
// endpoint gets data-transport-name; an inferred one gets data-place-index.
export function setupListClickHandler(): void {
  const listEl = document.getElementById("panel-content")!

  listEl.addEventListener("click", e => {
    const link = (e.target as Element).closest("[data-map-link]") as HTMLElement | null
    if (!link) return
    if (link.dataset.transportName) {
      focusMarker("transport", link.dataset.transportName, state.geoIndex.transports.get(link.dataset.transportName) ?? undefined)
      return
    }
    const place = link.closest<HTMLElement>("[data-place-index]")
    if (place) {
      const idx = parseInt(place.dataset.placeIndex!, 10)
      focusMarker("place", idx, state.geoIndex.places[idx] ?? undefined)
    }
  })
}
