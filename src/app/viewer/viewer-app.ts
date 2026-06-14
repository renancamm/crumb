/**
 * Browser app bundle entry point.
 *
 * Bundled by esbuild (IIFE) and injected into the self-contained HTML output.
 * Reads initialisation data from window globals set by html.ts before this
 * script runs:
 *
 *   window.__CRUMB_SOURCE   — original YAML source for the editor
 *   window.__CRUMB_SPEC     — crumb-spec.md content for "Download spec"
 *   window.__CRUMB_DATA     — parsed CrumbDocument (initial render)
 *
 * The Crumb parser/renderer bundle (window.Crumb) is injected by a separate
 * <script> tag before this one and handles live re-parsing on editor edits.
 */

import { setupListClickHandler, clearFocus, highlightMarker } from "./app-focus"
import { updateMap, fitAllPlaces, applyDetailMarkerFilter, fitTransportPoints, mapPadding, applyGeoState, setMapInteraction } from "./app-map"
import { state, ZOOM_PLACE_FLY, ZOOM_DETAIL_FLY, MOBILE_MAX_W, FLY_DURATION, EMBED } from "./app-state"
import { initSheet, exitSheet, goMedium } from "./app-sheet"
import { seedGeoCache } from "../../geo/geocoder"
import { ICON_PIN_OFF, ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, ICON_MAXIMIZE, ICON_MINIMIZE } from "../../shared/icons"
import { placeStays, placeActivityItems } from "../../shared/plan-view"
import type { ModalRef } from "./app-state"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSinglePlace(doc: typeof state.DATA): boolean {
  return doc?.itinerary?.length === 1 && doc.itinerary[0]?.type === "place"
}

const EMPTY_STATE_HTML = `<div class="panel-empty"><span class="panel-empty-title">No itinerary loaded</span></div>`

// ─── DOM references ───────────────────────────────────────────────────────────

const panelNav     = document.getElementById("panel-nav")!
const panelContent = document.getElementById("panel-content")!
const panelFooter  = document.getElementById("panel-footer")!

// ─── Footer nav ───────────────────────────────────────────────────────────────

const CHEVRON_L = ICON_CHEVRON_LEFT
const CHEVRON_R = ICON_CHEVRON_RIGHT

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
  placeStays(place).forEach((_, i) => items.push({ type: "stay", itemIdx: i }))
  let actFlatIdx = 0
  for (const actItem of placeActivityItems(place))
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
  if (isSinglePlace(state.DATA) && state.activeDetail === null) { panelFooter.innerHTML = ""; return }
  const itinIdx = currentItinIdx()
  if (itinIdx < 0) { panelFooter.innerHTML = ""; return }
  panelFooter.innerHTML = renderFooterNav(itinIdx + 1, state.DATA.itinerary.length)
}

// ─── Scroll memory ────────────────────────────────────────────────────────────

const scrollMemory = new Map<string, number>()

function scrollKey(): string | null {
  if (state.activeDetail !== null) return null
  return state.activePlaceIndex === null ? "trip" : `place-${state.activePlaceIndex}`
}

function saveScroll(): void {
  const key = scrollKey()
  if (key) scrollMemory.set(key, panelContent.scrollTop)
}

// ─── Place navigation ─────────────────────────────────────────────────────────

export function setActivePlace(placeIdx: number | null): void {
  saveScroll()
  const wasAtTrip = state.activePlaceIndex === null && state.activeDetail === null
  state.activePlaceIndex = placeIdx
  state.activeDetail = null
  const doc = state.DATA

  applyDetailMarkerFilter()

  if (placeIdx === null) {
    panelNav.innerHTML     = ""
    panelContent.innerHTML = window.Crumb.renderTripPanel(doc)
    panelContent.scrollTop = scrollMemory.get("trip") ?? 0
    setupStickyTitle()
    applyGeoState(doc)
    clearFocus()
    goMedium()
    fitAllPlaces()
  } else {
    if (wasAtTrip) goMedium()
    panelNav.innerHTML     = ""
    panelContent.innerHTML = window.Crumb.renderPlacePanel(doc, placeIdx)
    panelContent.scrollTop = scrollMemory.get(`place-${placeIdx}`) ?? 0
    setupStickyTitle()
    applyGeoState(doc)
    highlightMarker("place", placeIdx)

    const geo = state.geoIndex.places[placeIdx]
    if (geo && state.mapReady) {
      state.map.setPadding(mapPadding())
      state.map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(state.map.getZoom(), ZOOM_PLACE_FLY), duration: FLY_DURATION })
    }
  }
  updatePanelFooter()
}

// ─── Sidebar detail ───────────────────────────────────────────────────────────

function openDetail(modal: ModalRef): void {
  saveScroll()
  if (state.activeDetail === null) goMedium()
  state.activeDetail = modal
  const doc = state.DATA
  panelNav.innerHTML     = ""
  panelContent.innerHTML = window.Crumb.renderModalContent(doc, modal)
  panelContent.scrollTop = 0
  setupStickyTitle()
  updatePanelFooter()
  focusDetailMarker(modal)

  // Inject "No map" tag when geocoding failed at runtime (pure renderer can't know this)
  if (modal.type === "stay" && modal.placeIdx !== null) {
    const places = doc.itinerary.filter((i: any) => i.type === "place") as any[]
    const place  = places[modal.placeIdx - 1]
    const stay   = place ? placeStays(place)[modal.itemIdx] : undefined
    if (stay && state.geoIndex.staysFailed.has(stay.name)) {
      const noMapTag = `<span class="tag tag--icon">${ICON_PIN_OFF} No map</span>`
      const tagsEl = panelContent.querySelector<HTMLElement>(".panel-stay-body .tags")
      if (tagsEl) {
        tagsEl.insertAdjacentHTML("afterbegin", noMapTag)
      } else {
        const stayBody = panelContent.querySelector<HTMLElement>(".panel-stay-body")
        stayBody?.insertAdjacentHTML("afterbegin", `<div class="tags">${noMapTag}</div>`)
      }
    }
  }

  if (modal.type === "activity" && modal.placeIdx !== null) {
    const places = doc.itinerary.filter((i: any) => i.type === "place") as any[]
    const place  = places[modal.placeIdx - 1]
    let actName: string | null = null
    if (place) {
      let idx = 0
      outer: for (const actItem of placeActivityItems(place)) {
        for (const a of actItem.items) {
          if (idx === modal.itemIdx) { actName = a.name; break outer }
          idx++
        }
      }
    }
    if (actName && state.geoIndex.actsFailed.has(actName)) {
      const noMapTag = `<span class="tag tag--icon">${ICON_PIN_OFF} No map</span>`
      const tagsEl = panelContent.querySelector<HTMLElement>(".panel-activity-body .tags")
      if (tagsEl) {
        tagsEl.insertAdjacentHTML("afterbegin", noMapTag)
      } else {
        const activityBody = panelContent.querySelector<HTMLElement>(".panel-activity-body")
        activityBody?.insertAdjacentHTML("afterbegin", `<div class="tags">${noMapTag}</div>`)
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
  let name: string | undefined

  if (modal.type === "activity") {
    let flatIdx = 0
    outer: for (const actItem of placeActivityItems(place)) {
      for (const act of actItem.items) {
        if (flatIdx === modal.itemIdx) { name = act.name; geo = state.geoIndex.activities.get(act.name) ?? undefined; break outer }
        flatIdx++
      }
    }
  } else if (modal.type === "stay") {
    const stay = placeStays(place)[modal.itemIdx]
    if (stay) { name = stay.name; geo = state.geoIndex.stays.get(stay.name) ?? undefined }
  }

  if (name && (modal.type === "activity" || modal.type === "stay")) highlightMarker(modal.type, name)

  if (geo) {
    state.map.setPadding(mapPadding())
    // easeTo (not flyTo): linear zoom avoids the mid-flight zoom-out that would
    // dip below ZOOM_DETAIL and flash the detail markers between activities.
    state.map.easeTo({ center: [geo.lng, geo.lat], zoom: Math.max(state.map.getZoom(), ZOOM_DETAIL_FLY), duration: FLY_DURATION })
  }
}

// ─── Transport panel ──────────────────────────────────────────────────────────

function openTransportPanel(transportIdx: number): void {
  saveScroll()
  if (state.activePlaceIndex === null && state.activeDetail === null) goMedium()
  state.activeDetail = { type: "transport", placeIdx: null, itemIdx: transportIdx }
  applyDetailMarkerFilter()
  clearFocus()
  panelNav.innerHTML     = ""
  panelContent.innerHTML = window.Crumb.renderTransportPanel(state.DATA, transportIdx)
  panelContent.scrollTop = 0
  setupStickyTitle()
  updatePanelFooter()
  decorateTransportWaypoints()

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
    fitTransportPoints(leg.from?.label ?? null, leg.to?.label ?? null, prevPlaceIdx, nextPlaceIdx)
  }
}

/**
 * Decorate the open transport panel's two from/to names by geocoding state:
 *   solved   → clickable to its transport point
 *   inferred → clickable to the neighbouring Place (label === place name)
 *   failed / map-disabled → no-pin icon
 *   pending  → small spinner
 * Safe to re-run (e.g. on crumb:geo-updated) — it first strips prior decoration.
 */
function decorateTransportWaypoints(): void {
  if (state.activeDetail?.type !== "transport") return
  const legs = state.DATA.itinerary.filter(i => i.type === "transport") as any[]
  const leg  = legs[state.activeDetail.itemIdx]
  if (!leg) return

  // Neighbouring place indices (1-based) for inferred-endpoint → Place links.
  const itinIdx = currentItinIdx()
  let prevPlaceIdx: number | null = null
  let nextPlaceIdx: number | null = null
  if (itinIdx >= 0) {
    let pc = 0
    for (let i = 0; i < itinIdx; i++) if (state.DATA.itinerary[i].type === "place") pc++
    if (pc > 0) prevPlaceIdx = pc
    for (let i = itinIdx + 1; i < state.DATA.itinerary.length; i++) {
      if (state.DATA.itinerary[i].type === "place") { nextPlaceIdx = pc + 1; break }
    }
  }
  const places = state.DATA.itinerary.filter(i => i.type === "place") as any[]
  const sides = [{ ep: leg.from, placeIdx: prevPlaceIdx }, { ep: leg.to, placeIdx: nextPlaceIdx }]

  const spans = panelContent.querySelectorAll<HTMLElement>(".transport-route-block .waypoint-name")
  spans.forEach((el, i) => {
    const side = sides[i]
    // Strip any prior decoration so re-runs don't stack.
    el.removeAttribute("data-map-link")
    el.removeAttribute("data-transport-name")
    el.removeAttribute("data-place-index")
    el.querySelector(".geo-no-loc")?.remove()
    el.querySelector(".waypoint-spinner")?.remove()
    const ep = side?.ep
    if (!ep || !ep.label) return

    if (ep.lat != null && ep.lng != null) {
      el.setAttribute("data-map-link", "")
      el.setAttribute("data-transport-name", ep.label)
      state.geoIndex.transports.set(ep.label, { lat: ep.lat, lng: ep.lng })
      return
    }
    if (ep.geocodingDisabled || state.geoIndex.transportsFailed.has(ep.label)) {
      el.insertAdjacentHTML("beforeend", ` <span class="geo-no-loc">${ICON_PIN_OFF}</span>`)
      return
    }
    const place = side?.placeIdx != null ? places[side.placeIdx - 1] : undefined
    if (place && ep.label === place.name) {
      el.setAttribute("data-map-link", "")
      el.setAttribute("data-place-index", String(side!.placeIdx))
      return
    }
    el.insertAdjacentHTML("beforeend", ` <span class="waypoint-spinner"></span>`)
  })
}

// Re-decorate the open transport panel when geocoding settles (spinner → link/icon).
document.addEventListener("crumb:geo-updated", () => decorateTransportWaypoints())

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
        goMedium()
        const placeIdx = state.activePlaceIndex!
        const doc = state.DATA
        highlightMarker("place", placeIdx)
        applyDetailMarkerFilter()
        const geo = state.geoIndex.places[placeIdx]
        if (geo && state.mapReady) {
          state.map.setPadding(mapPadding())
          state.map.flyTo({ center: [geo.lng, geo.lat], zoom: ZOOM_PLACE_FLY, duration: FLY_DURATION })
        }
        panelNav.innerHTML     = ""
        panelContent.innerHTML = isSinglePlace(doc)
          ? window.Crumb.renderSinglePlacePanel(doc)
          : window.Crumb.renderPlacePanel(doc, placeIdx)
        panelContent.scrollTop = scrollMemory.get(`place-${placeIdx}`) ?? 0
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
      noteMore.textContent = expanded ? " less" : " more"
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

  if (type === "transport" && transportIdx != null) {
    openTransportPanel(transportIdx)
    return
  }

  if ((type === "activity" || type === "stay") && placeIdx != null && name != null) {
    const places = state.DATA.itinerary.filter(i => i.type === "place") as any[]
    const place  = places[placeIdx - 1]
    if (!place) return

    if (type === "stay") {
      const stayIdx = placeStays(place).findIndex((s) => s.name === name)
      if (stayIdx < 0) return
      if (state.activePlaceIndex !== placeIdx) setActivePlace(placeIdx)
      openDetail({ type: "stay", placeIdx, itemIdx: stayIdx })
      return
    }

    let flatIdx = 0
    for (const actItem of placeActivityItems(place)) {
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

// ─── Editor doc-updated ───────────────────────────────────────────────────────
// Fired by the editor bundle when the editor/map split is resized or toggled —
// the map must repaint to fill its new width (editor never imports the map).
window.addEventListener("crumb:layout-resized", () => state.map?.resize())

// Fired by the editor bundle after a successful re-parse (or on clear).

window.addEventListener("crumb:doc-updated", () => {
  scrollMemory.clear()
  const doc = window.__CRUMB_DATA
  if (!doc) {
    state.DATA       = null as any
    panelNav.innerHTML     = ""
    panelContent.innerHTML = EMPTY_STATE_HTML
    panelFooter.innerHTML  = ""
    ;(document.getElementById("map-status") as HTMLElement).textContent = ""
    if (state.mapReady) {
      state.map.getSource("route").setData({ type: "FeatureCollection", features: [] })
      state.placeMarkers.forEach(m  => m.remove());  state.placeMarkers  = []
      state.detailMarkers.forEach(m => m.remove()); state.detailMarkers = []
    }
    return
  }
  state.DATA         = doc
  state.activeDetail = null
  panelNav.innerHTML    = ""
  panelFooter.innerHTML = ""   // reset the pager so the previous crumb's nav doesn't linger
  if (isSinglePlace(doc)) {
    state.activePlaceIndex = 1
    panelContent.innerHTML = window.Crumb.renderSinglePlacePanel(doc)
  } else {
    state.activePlaceIndex = null
    panelContent.innerHTML = window.Crumb.renderTripPanel(doc)
  }
  setupStickyTitle()
  updateMap(doc)
})

// ─── Embed mode ────────────────────────────────────────────────────────────────
// A self-contained, host-friendly render: the map starts with interactions locked
// (so a host page scrolls past it) and exposes an expand→fullscreen control that
// re-enables them. (Runtime document loading — ?src and crumb:load — lives in
// embed-boot.ts.)

function setupEmbedMode(mobileQuery: MediaQueryList): void {
  document.body.classList.add("embed")

  const mapEl  = document.getElementById("map")!
  const sidebar = document.getElementById("sidebar")!

  // Scroll scrim (shown on mobile preview via CSS): a transparent layer with
  // touch-action: pan-y, so a vertical swipe scrolls the *host* page instead of
  // being trapped by the locked map or the bottom sheet. Hidden when expanded,
  // where real interaction (pan, sheet) is wanted.
  const scrim = document.createElement("div")
  scrim.className = "embed-scrim"
  mapEl.appendChild(scrim)

  const btn = document.createElement("button")
  btn.className = "embed-expand-btn"
  btn.setAttribute("aria-label", "Expand map")
  btn.innerHTML = ICON_MAXIMIZE
  mapEl.appendChild(btn)

  // Single source of truth for the embed bottom sheet:
  //   expanded + mobile → the interactive sheet; otherwise the static peek
  //   (mobile preview) or the desktop floating sidebar (no transform).
  // An embed starts with its mobile sheet off-screen (css.ts: body.embed #sidebar),
  // so it never flashes pre-JS; this reveals the right state once JS runs. A ?card
  // page keeps `#sidebar { display:none }` (embed-card) regardless.
  const syncEmbedSheet = (full: boolean): void => {
    if (full && mobileQuery.matches) {
      initSheet()
    } else {
      exitSheet()
      sidebar.style.transform = mobileQuery.matches ? "translateY(40vh)" : ""
    }
  }

  // Apply the local expanded/preview state. The host (if any) grows the iframe to
  // fill the viewport on expand; here we only flip our own UI: icon, interaction
  // level (desktop preview keeps mouse pan; expanded unlocks everything), the
  // sheet, and a re-measure.
  const applyExpanded = (full: boolean): void => {
    document.body.classList.toggle("embed-full", full)
    btn.innerHTML = full ? ICON_MINIMIZE : ICON_MAXIMIZE
    btn.setAttribute("aria-label", full ? "Collapse map" : "Expand map")
    setMapInteraction(full ? "full" : "preview")
    syncEmbedSheet(full)
    state.map.resize()
  }

  // No native Fullscreen API (unreliable in iframes, absent on iPhone Safari): the
  // expand button asks the host page to grow the iframe to the full viewport and
  // applies the expanded state locally. A standalone embed (parent === self) posts
  // to itself harmlessly and still unlocks — it already fills its own page.
  const setFull = (full: boolean): void => {
    window.parent?.postMessage({ type: "crumb:fullscreen", full }, "*")
    applyExpanded(full)
  }
  btn.addEventListener("click", () => setFull(!document.body.classList.contains("embed-full")))

  // Esc collapses an expanded embed. The fullscreen iframe covers the viewport, so it
  // owns keyboard focus — this listener (inside the iframe) is what receives the press;
  // posting full:false shrinks the host iframe via the same crumb:fullscreen path.
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("embed-full")) setFull(false)
  })

  // Re-sync when the available width crosses the breakpoint — e.g. the iframe grows
  // on expand, or the window is resized — so the layout follows the real width
  // (mobile sheet ↔ desktop sidebar) and the interaction set stays correct.
  mobileQuery.addEventListener("change", () =>
    applyExpanded(document.body.classList.contains("embed-full")))

  applyExpanded(false)   // establish the preview state (desktop pan, static peek)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

// Seed the geo cache from baked data (demo page) before any geocoding runs, so
// known places resolve instantly with no network requests. Unknown queries
// still fall back to online lookup. Opt out with __CRUMB_GEO_MODE === "online".
if (window.__CRUMB_GEO_DATA && window.__CRUMB_GEO_MODE !== "online") {
  seedGeoCache(window.__CRUMB_GEO_DATA)
}

const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_MAX_W - 1}px)`)

if (EMBED) {
  // Embed preview shows a static sheet behind a scroll scrim; the interactive
  // sheet is wired only when expanded on mobile (see syncEmbedSheet).
  setupEmbedMode(mobileQuery)
} else {
  if (mobileQuery.matches) initSheet()
  mobileQuery.addEventListener("change", e => {
    if (e.matches) initSheet()
    else           exitSheet()
  })
}

setupListClickHandler()
if (!state.DATA) {
  panelContent.innerHTML = EMPTY_STATE_HTML
} else if (isSinglePlace(state.DATA)) {
  state.activePlaceIndex = 1
  panelContent.innerHTML = window.Crumb.renderSinglePlacePanel(state.DATA)
}
setupStickyTitle()
updateMap(state.DATA)
