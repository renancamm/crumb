import { state, ZOOM_PLACE_FLY, ZOOM_DETAIL_FLY, type FocusType } from "./app-state"

export function clearFocus(): void {
  state.focusedPlaceIdx  = -1
  state.focusedActName   = null
  state.focusedStayName  = null
  state.focusedHubName   = null
  document.querySelectorAll(".place.--focused, .activity-item.--focused, .stay.--focused")
    .forEach(el => el.classList.remove("--focused"))
  state.placeMarkers.forEach(m => m.getElement().classList.remove("--focused"))
  state.detailMarkers.forEach(m => m.getElement().classList.remove("--focused"))
}

export function focusMarker(type: FocusType, id: string | number, coords?: { lat: number; lng: number }): void {
  clearFocus()

  const listEl = document.getElementById("panel-content")!

  if (type === "place") {
    const idx = id as number
    state.focusedPlaceIdx = idx
    const el = document.querySelector(`.place[data-place-index="${idx}"]`)
    el?.classList.add("--focused")
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    state.placeMarkers[idx - 1]?.getElement().classList.add("--focused")
    if (coords) state.map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(state.map.getZoom(), ZOOM_PLACE_FLY), duration: 800 })
  } else {
    const name = id as string
    if (type === "activity") state.focusedActName  = name
    if (type === "stay")     state.focusedStayName = name
    if (type === "hub")      state.focusedHubName  = name

    const selector = type === "activity" ? `.activity-item[data-act-name="${name}"]`
                   : type === "stay"     ? `.stay[data-stay-name="${name}"]`
                   : null
    if (selector) {
      const el = listEl.querySelector<HTMLElement>(selector)
      el?.classList.add("--focused")
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }

    for (const m of state.detailMarkers) {
      if (m.getElement().dataset.name === name) { m.getElement().classList.add("--focused"); break }
    }

    const zoom = type === "hub" ? ZOOM_DETAIL_FLY : ZOOM_DETAIL_FLY
    if (coords) state.map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(state.map.getZoom(), zoom), duration: 800 })
  }
}

// List → map click handler (wired up here because it directly calls focusMarker)
export function setupListClickHandler(): void {
  const listEl = document.getElementById("panel-content")!

  listEl.addEventListener("click", e => {
    const link = (e.target as Element).closest("[data-map-link]") as HTMLElement | null
    if (!link) return
    const act  = link.closest<HTMLElement>("[data-act-name]")
    const stay = link.closest<HTMLElement>("[data-stay-name]")
    if (act)  { focusMarker("activity", act.dataset.actName!,  state.geoIndex.activities.get(act.dataset.actName!)  ?? undefined); return }
    if (stay) { focusMarker("stay",     stay.dataset.stayName!, state.geoIndex.stays.get(stay.dataset.stayName!)    ?? undefined); return }
    if (link.dataset.hubName) { focusMarker("hub", link.dataset.hubName, state.geoIndex.hubs.get(link.dataset.hubName) ?? undefined); return }
    const place = link.closest<HTMLElement>("[data-place-index]")
    if (place) {
      const idx = parseInt(place.dataset.placeIndex!, 10)
      focusMarker("place", idx, state.geoIndex.places[idx] ?? undefined)
    }
  })
}
