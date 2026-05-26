/**
 * Browser app bundle entry point.
 *
 * Bundled by esbuild (IIFE) and injected into the self-contained HTML output.
 * Reads initialisation data from window globals set by html.ts before this
 * script runs:
 *
 *   window.__CRUMB_SOURCE   — original YAML source for the editor
 *   window.__CRUMB_SPEC     — CRUMB_SPEC.md content for "Download spec"
 *   window.__CRUMB_EXAMPLES — example crumb files keyed by filename
 *   window.__CRUMB_DATA     — parsed CrumbDocument (initial render)
 *   window.__CRUMB_POPUPS   — pre-computed popup metadata
 *
 * The Crumb parser/renderer bundle (window.Crumb) is injected by a separate
 * <script> tag before this one and handles live re-parsing on editor edits.
 */

import "./app-menus"
import { setupListClickHandler, focusMarker, clearFocus } from "./app-focus"
import { updateMap, fitAllPlaces, applyDetailMarkerFilter, fitTransportHubs, mapPadding, applyGeoState } from "./app-map"
import { state, ZOOM_PLACE_FLY, ZOOM_DETAIL_FLY, MOBILE_MAX_W } from "./app-state"
import { initSheet, exitSheet, goMedium } from "./app-sheet"
import { ICON_GLOBE_OFF } from "./icons"
import type { ModalRef } from "./app-state"

// ─── DOM references ───────────────────────────────────────────────────────────

const panelNav     = document.getElementById("panel-nav")!
const panelContent = document.getElementById("panel-content")!
const panelFooter  = document.getElementById("panel-footer")!

// ─── Footer nav ───────────────────────────────────────────────────────────────

const CHEVRON_L = `<svg class="crumb-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>`
const CHEVRON_R = `<svg class="crumb-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>`

// ── Trip-level stack (places + transports) ────────────────────────────────────

function currentItinIdx(): number {
  const doc = state.DATA
  if (state.activeDetail?.type === "transport") {
    let tc = -1
    for (let i = 0; i < doc.itinerary.length; i++) {
      if (doc.itinerary[i].type === "transport" && ++tc === state.activeDetail.itemIdx) return i
    }
  } else if (state.activePlaceIndex !== null) {
    let pc = 0
    for (let i = 0; i < doc.itinerary.length; i++) {
      if (doc.itinerary[i].type === "place" && ++pc === state.activePlaceIndex) return i
    }
  }
  return -1
}

function navigateToItinItem(itinIdx: number): void {
  const doc = state.DATA
  const item = doc.itinerary[itinIdx]
  if (!item) return
  if (item.type === "place") {
    let pc = 0
    for (let i = 0; i <= itinIdx; i++) if (doc.itinerary[i].type === "place") pc++
    setActivePlace(pc)
  } else {
    let tc = 0
    for (let i = 0; i < itinIdx; i++) if (doc.itinerary[i].type === "transport") tc++
    openTransportPanel(tc)
  }
}

// ── Place-level stack (stays + activities within the active place) ─────────────

type PlaceItem = { type: "stay" | "activity"; itemIdx: number }

function getPlaceItems(): PlaceItem[] {
  if (state.activePlaceIndex === null) return []
  const places = state.DATA.itinerary.filter(i => i.type === "place") as any[]
  const place  = places[state.activePlaceIndex - 1]
  if (!place) return []
  const items: PlaceItem[] = []
  ;(place.stay ?? []).forEach((_: any, i: number) => items.push({ type: "stay", itemIdx: i }))
  let actFlatIdx = 0
  for (const actItem of place.activities)
    for (const _ of actItem.items) items.push({ type: "activity", itemIdx: actFlatIdx++ })
  return items
}

function currentPlaceItemIdx(): number {
  const d = state.activeDetail
  if (!d || d.type === "transport" || d.type === "trip") return -1
  const items = getPlaceItems()
  return items.findIndex(it => it.type === d.type && it.itemIdx === d.itemIdx)
}

function navigateToPlaceItem(idx: number): void {
  const item = getPlaceItems()[idx]
  if (!item) return
  openDetail({ type: item.type, placeIdx: state.activePlaceIndex, itemIdx: item.itemIdx })
}

function isPlaceLevelDetail(): boolean {
  return state.activePlaceIndex !== null
    && state.activeDetail !== null
    && state.activeDetail.type !== "transport"
}

// ── Render footer ─────────────────────────────────────────────────────────────

function renderFooterNav(cur: number, total: number): string {
  const prevDis = cur <= 1     ? " disabled" : ""
  const nextDis = cur >= total ? " disabled" : ""
  return `<div class="panel-footer-nav">` +
    `<button class="panel-nav-btn" id="panel-nav-prev"${prevDis}>${CHEVRON_L}</button>` +
    `<span class="panel-nav-counter">${cur} of ${total}</span>` +
    `<button class="panel-nav-btn" id="panel-nav-next"${nextDis}>${CHEVRON_R}</button>` +
    `</div>`
}

function updatePanelFooter(): void {
  if (isPlaceLevelDetail()) {
    const items = getPlaceItems()
    const cur   = currentPlaceItemIdx()
    if (cur < 0 || items.length === 0) { panelFooter.innerHTML = ""; return }
    panelFooter.innerHTML = renderFooterNav(cur + 1, items.length)
    return
  }
  const itinIdx = currentItinIdx()
  if (itinIdx < 0) { panelFooter.innerHTML = ""; return }
  panelFooter.innerHTML = renderFooterNav(itinIdx + 1, state.DATA.itinerary.length)
}

// ─── Place navigation ─────────────────────────────────────────────────────────

export function setActivePlace(placeIdx: number | null): void {
  state.activePlaceIndex = placeIdx
  state.activeDetail = null
  const doc = state.DATA

  panelContent.scrollTop = 0
  applyDetailMarkerFilter()

  if (placeIdx === null) {
    panelNav.innerHTML     = ""
    panelContent.innerHTML = window.Crumb.renderTripPanel(doc)
    setupStickyTitle()
    goMedium()
    fitAllPlaces()
  } else {
    panelNav.innerHTML     = ""
    panelContent.innerHTML = window.Crumb.renderPlacePanel(doc, placeIdx)
    setupStickyTitle()
    applyGeoState(doc)

    const geo = state.geoIndex.places[placeIdx]
    if (geo && state.mapReady) {
      state.map.setPadding(mapPadding())
      state.map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(state.map.getZoom(), ZOOM_PLACE_FLY), duration: 800 })
    }
  }
  updatePanelFooter()
}

// ─── Sidebar detail ───────────────────────────────────────────────────────────

function openDetail(modal: ModalRef): void {
  state.activeDetail = modal
  const doc = state.DATA
  panelNav.innerHTML     = ""
  panelContent.innerHTML = window.Crumb.renderModalContent(doc, modal)
  panelContent.scrollTop = 0
  setupStickyTitle()
  updatePanelFooter()
  focusDetailMarker(modal)

  // Inject "No map" tag when geocoding failed at runtime (pure renderer can't know this)
  if (modal.type === "activity" && modal.placeIdx !== null) {
    const places = doc.itinerary.filter((i: any) => i.type === "place") as any[]
    const place  = places[modal.placeIdx - 1]
    let actName: string | null = null
    if (place) {
      let idx = 0
      outer: for (const actItem of place.activities) {
        for (const a of actItem.items) {
          if (idx === modal.itemIdx) { actName = a.name; break outer }
          idx++
        }
      }
    }
    if (actName && state.geoIndex.actsFailed.has(actName)) {
      const noMapTag = `<span class="tag tag--icon">${ICON_GLOBE_OFF} No map</span>`
      const tagsEl = panelContent.querySelector<HTMLElement>(".panel-header-body .tags")
      if (tagsEl) {
        tagsEl.insertAdjacentHTML("afterbegin", noMapTag)
      } else {
        const titleRow = panelContent.querySelector<HTMLElement>(".panel-title-row")
        titleRow?.insertAdjacentHTML("afterend", `<div class="tags">${noMapTag}</div>`)
      }
    }
  }
}

function focusDetailMarker(modal: ModalRef): void {
  if (!state.mapReady) return
  const doc = state.DATA
  const places = doc.itinerary.filter(i => i.type === "place") as any[]
  const place  = modal.placeIdx !== null ? places[modal.placeIdx - 1] : null
  if (!place) return

  let geo: { lat: number; lng: number } | undefined

  if (modal.type === "activity") {
    let flatIdx = 0
    outer: for (const actItem of place.activities) {
      for (const act of actItem.items) {
        if (flatIdx === modal.itemIdx) { geo = state.geoIndex.activities.get(act.name) ?? undefined; break outer }
        flatIdx++
      }
    }
  } else if (modal.type === "stay") {
    const stay = place.stay?.[modal.itemIdx]
    if (stay) geo = state.geoIndex.stays.get(stay.name) ?? undefined
  }

  if (geo) {
    state.map.setPadding(mapPadding())
    state.map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(state.map.getZoom(), ZOOM_DETAIL_FLY), duration: 800 })
  }
}

// ─── Transport panel ──────────────────────────────────────────────────────────

function openTransportPanel(transportIdx: number): void {
  state.activeDetail = { type: "transport", placeIdx: null, itemIdx: transportIdx }
  applyDetailMarkerFilter()
  panelNav.innerHTML     = ""
  panelContent.innerHTML = window.Crumb.renderTransportPanel(state.DATA, transportIdx)
  panelContent.scrollTop = 0
  setupStickyTitle()
  updatePanelFooter()

  const legs = state.DATA.itinerary.filter(i => i.type === "transport") as any[]
  const leg  = legs[transportIdx]
  if (leg) {
    const itinIdx = currentItinIdx()
    let prevPlaceIdx: number | null = null
    let nextPlaceIdx: number | null = null
    if (itinIdx >= 0) {
      let pc = 0
      for (let i = 0; i < itinIdx; i++)
        if (state.DATA.itinerary[i].type === "place") pc++
      if (pc > 0) prevPlaceIdx = pc
      for (let i = itinIdx + 1; i < state.DATA.itinerary.length; i++) {
        if (state.DATA.itinerary[i].type === "place") { nextPlaceIdx = pc + 1; break }
      }
    }
    fitTransportHubs(leg.from?.label ?? null, leg.to?.label ?? null, prevPlaceIdx, nextPlaceIdx)
  }
}

// ─── Event delegation ─────────────────────────────────────────────────────────

document.addEventListener("click", e => {
  const target = e.target as Element

  // Panel footer: previous / next
  if (target.closest("#panel-nav-prev")) {
    if (isPlaceLevelDetail()) {
      const idx = currentPlaceItemIdx()
      if (idx > 0) navigateToPlaceItem(idx - 1)
    } else {
      const idx = currentItinIdx()
      if (idx > 0) navigateToItinItem(idx - 1)
    }
    return
  }
  if (target.closest("#panel-nav-next")) {
    if (isPlaceLevelDetail()) {
      const idx = currentPlaceItemIdx()
      const items = getPlaceItems()
      if (idx >= 0 && idx < items.length - 1) navigateToPlaceItem(idx + 1)
    } else {
      const idx = currentItinIdx()
      if (idx >= 0 && idx < state.DATA.itinerary.length - 1) navigateToItinItem(idx + 1)
    }
    return
  }

  // Panel back / close button
  if (target.closest("#nav-back")) {
    if (state.activeDetail !== null) {
      const wasInsidePlace = state.activeDetail.type !== "transport" && state.activePlaceIndex !== null
      state.activeDetail = null
      if (wasInsidePlace) {
        const placeIdx = state.activePlaceIndex!
        const doc = state.DATA
        clearFocus()
        applyDetailMarkerFilter()
        const geo = state.geoIndex.places[placeIdx]
        if (geo && state.mapReady) {
          state.map.setPadding(mapPadding())
          state.map.flyTo({ center: [geo.lng, geo.lat], zoom: ZOOM_PLACE_FLY, duration: 800 })
        }
        panelNav.innerHTML     = ""
        panelContent.innerHTML = window.Crumb.renderPlacePanel(doc, placeIdx)
        panelContent.scrollTop = 0
        setupStickyTitle()
        applyGeoState(doc)
        updatePanelFooter()
      } else {
        setActivePlace(null)
      }
    } else {
      setActivePlace(null)
    }
    return
  }

  // Panel ToC: place item → navigate to place level
  const tocPlace = target.closest(".list-item--place") as HTMLElement | null
  if (tocPlace) {
    const idx = parseInt(tocPlace.dataset.placeIdx ?? "", 10)
    if (!isNaN(idx)) setActivePlace(idx)
    return
  }

  // Panel ToC: transport item → transport panel
  const tocTransport = target.closest(".list-item--transport") as HTMLElement | null
  if (tocTransport) {
    const idx = parseInt(tocTransport.dataset.transportIdx ?? "", 10)
    if (!isNaN(idx)) openTransportPanel(idx)
    return
  }

  // Panel ToC: activity item → sidebar detail
  const tocActivity = target.closest(".list-item--activity") as HTMLElement | null
  if (tocActivity) {
    const idx = parseInt(tocActivity.dataset.actIdx ?? "", 10)
    if (!isNaN(idx)) openDetail({ type: "activity", placeIdx: state.activePlaceIndex, itemIdx: idx })
    return
  }

  // Panel ToC: stay item → sidebar detail
  const tocStay = target.closest(".list-item--stay") as HTMLElement | null
  if (tocStay) {
    const sIdx = parseInt(tocStay.dataset.stayIdx ?? "", 10)
    if (!isNaN(sIdx)) openDetail({ type: "stay", placeIdx: state.activePlaceIndex, itemIdx: sIdx })
    return
  }

  // Note expand/collapse
  const noteMore = target.closest(".note-more") as HTMLElement | null
  if (noteMore) {
    const trunc = noteMore.previousElementSibling
    if (trunc?.classList.contains("note-trunc")) {
      const expanded = trunc.classList.toggle("--expanded")
      noteMore.textContent = expanded ? " less" : " … more"
    }
    return
  }
})

// ─── Keyboard navigation (← → between places) ────────────────────────────────

document.addEventListener("keydown", e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
  if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
  const prev = e.key === "ArrowLeft"
  if (isPlaceLevelDetail()) {
    const idx   = currentPlaceItemIdx()
    const items = getPlaceItems()
    if (prev && idx > 0)                      navigateToPlaceItem(idx - 1)
    if (!prev && idx >= 0 && idx < items.length - 1) navigateToPlaceItem(idx + 1)
  } else {
    const idx = currentItinIdx()
    if (prev && idx > 0)                                           navigateToItinItem(idx - 1)
    if (!prev && idx >= 0 && idx < state.DATA.itinerary.length - 1) navigateToItinItem(idx + 1)
  }
})

// ─── Sticky title bar ─────────────────────────────────────────────────────────

let stickyObserver: IntersectionObserver | null = null

export function setupStickyTitle(): void {
  stickyObserver?.disconnect()
  requestAnimationFrame(() => {
    const bar   = panelContent.querySelector<HTMLElement>(".panel-sticky-bar")
    const title = panelContent.querySelector<HTMLElement>(".panel-trip-name, .panel-place-name, .panel-transport-name, .panel-activity-name, .panel-stay-name")
    if (!bar || !title) return
    stickyObserver = new IntersectionObserver(
      ([entry]) => bar.classList.toggle("--visible", !entry.isIntersecting),
      { root: panelContent }
    )
    stickyObserver.observe(title)
  })
}

// ─── Map marker clicks ────────────────────────────────────────────────────────

document.addEventListener("crumb:marker", (e: Event) => {
  const { type, placeIdx, name, transportIdx } = (e as CustomEvent).detail as { type: string; placeIdx?: number; name?: string; transportIdx?: number }

  if (type === "place" && placeIdx != null) {
    setActivePlace(placeIdx)
    return
  }

  if (type === "hub" && transportIdx != null) {
    openTransportPanel(transportIdx)
    return
  }

  if ((type === "activity" || type === "stay") && placeIdx != null && name != null) {
    const places = state.DATA.itinerary.filter(i => i.type === "place") as any[]
    const place  = places[placeIdx - 1]
    if (!place) return

    if (type === "stay") {
      const stayIdx = (place.stay ?? []).findIndex((s: any) => s.name === name)
      if (stayIdx < 0) return
      if (state.activePlaceIndex !== placeIdx) setActivePlace(placeIdx)
      openDetail({ type: "stay", placeIdx, itemIdx: stayIdx })
      return
    }

    let flatIdx = 0
    for (const actItem of place.activities) {
      for (const act of actItem.items) {
        if (act.name === name) {
          if (state.activePlaceIndex !== placeIdx) setActivePlace(placeIdx)
          openDetail({ type: "activity", placeIdx, itemIdx: flatIdx })
          return
        }
        flatIdx++
      }
    }
  }
})

// ─── Map background tap → peek sheet ─────────────────────────────────────────

document.addEventListener("crumb:map-click", () => {
  goMedium()
})

// ─── Init ─────────────────────────────────────────────────────────────────────

const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_MAX_W - 1}px)`)

if (mobileQuery.matches) initSheet()

mobileQuery.addEventListener("change", e => {
  if (e.matches) initSheet()
  else           exitSheet()
})

setupListClickHandler()
setupStickyTitle()
updateMap(state.DATA)
