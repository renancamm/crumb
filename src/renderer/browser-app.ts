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

import type { CrumbDocument } from "../types/resolved"
import {
  cachedGeo,
  cacheGeo,
  fetchGeo,
  resolveGeo,
  writeBackGeo,
  geocodeTransportHubs,
  type GeoResult,
  type GeoTarget,
  type DetailPoint,
} from "./geocoder"
import {
  ICON_STAY, ICON_PLANE, ICON_TRAIN, ICON_BUS, ICON_CAR, ICON_SHIP,
  ICON_WALK, ICON_BIKE, ICON_ROUTE, ICON_GLOBE_OFF, ICON_ARRIVES, ICON_DEPARTS, ICON_CLOCK,
} from "./icons"
import { escape, activityLabel } from "./format"

// ─── Window interface ─────────────────────────────────────────────────────────

declare global {
  interface Window {
    __CRUMB_SOURCE:   string
    __CRUMB_SPEC:     string
    __CRUMB_EXAMPLES: Record<string, string>
    __CRUMB_DATA:     CrumbDocument
    __CRUMB_POPUPS:   Record<string, string>
    Crumb: {
      parse:                (src: string) => CrumbDocument
      renderItineraryBody:  (doc: CrumbDocument) => string
      buildPopupMeta:       (doc: CrumbDocument) => Record<string, string>
    }
  }
}

declare const maplibregl: any

// ─── Constants ────────────────────────────────────────────────────────────────

const ZOOM_OVERVIEW             = 8
const ZOOM_DETAIL               = 12
const ZOOM_PLACE_FLY            = 10
const ZOOM_DETAIL_FLY           = 14
const MAX_UNCACHED_STAY_FETCHES = 3   // rate-limit guard: avoid flooding Nominatim per load

// ─── Embedded data ────────────────────────────────────────────────────────────

const SOURCE   = window.__CRUMB_SOURCE
const SPEC     = window.__CRUMB_SPEC
const EXAMPLES = window.__CRUMB_EXAMPLES
let DATA       = window.__CRUMB_DATA
let POPUP_META = window.__CRUMB_POPUPS

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const editorEl      = document.getElementById("editor")          as HTMLTextAreaElement
const listEl        = document.getElementById("list")            as HTMLElement
const mapStatusEl   = document.getElementById("map-status")      as HTMLElement
const editorPanel   = document.getElementById("editor-panel")    as HTMLElement
const errorBar      = document.getElementById("editor-error-bar") as HTMLElement
const newModal      = document.getElementById("new-modal")       as HTMLElement
const newTextarea   = document.getElementById("new-textarea")    as HTMLTextAreaElement
const generateModal = document.getElementById("generate-modal")  as HTMLElement
const aboutModal    = document.getElementById("about-modal")     as HTMLElement

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  stay:      ICON_STAY,
  flight:    ICON_PLANE,
  train:     ICON_TRAIN,
  bus:       ICON_BUS,
  car:       ICON_CAR,
  ferry:     ICON_SHIP,
  walk:      ICON_WALK,
  bike:      ICON_BIKE,
  transport: ICON_ROUTE,
  globe_off: ICON_GLOBE_OFF,
  arrives:   ICON_ARRIVES,
  departs:   ICON_DEPARTS,
  clock:     ICON_CLOCK,
}

const GEO_FAIL_ICON = `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>`
const ROUTE_COLOR   = "#18181b"

// ─── Geo index (list → map fly-to) ───────────────────────────────────────────

const geoIndex = {
  places:     [null] as Array<GeoResult | null>,
  activities: new Map<string, GeoResult>(),
  stays:      new Map<string, GeoResult>(),
  hubs:       new Map<string, GeoResult>(),
}

// ─── Focus state (list ↔ marker sync) ────────────────────────────────────────

type FocusType = "place" | "activity" | "stay" | "hub"

let focusedPlaceIdx  = -1
let focusedActName:  string | null = null
let focusedStayName: string | null = null
let focusedHubName:  string | null = null

function clearFocus(): void {
  focusedPlaceIdx  = -1
  focusedActName   = null
  focusedStayName  = null
  focusedHubName   = null
  document.querySelectorAll(".place.--focused, .activity-item.--focused, .stay.--focused")
    .forEach(el => el.classList.remove("--focused"))
  placeMarkers.forEach(m => m.getElement().classList.remove("--focused"))
  detailMarkers.forEach(m => m.getElement().classList.remove("--focused"))
}

function focusMarker(type: FocusType, id: string | number, coords?: GeoResult): void {
  clearFocus()

  // Expand sheet and update map padding before flyTo so the animation
  // uses the correct inset from the start and isn't cancelled by setPadding.
  expandSheetForFocus()

  if (type === "place") {
    const idx = id as number
    focusedPlaceIdx = idx
    const el = document.querySelector(`.place[data-place-index="${idx}"]`)
    el?.classList.add("--focused")
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    placeMarkers[idx - 1]?.getElement().classList.add("--focused")
    if (coords) map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(map.getZoom(), ZOOM_PLACE_FLY), duration: 800 })
  } else {
    const name = id as string
    if (type === "activity") focusedActName  = name
    if (type === "stay")     focusedStayName = name
    if (type === "hub")      focusedHubName  = name

    // Scroll list item into view
    const selector = type === "activity" ? `.activity-item[data-act-name="${name}"]`
                   : type === "stay"     ? `.stay[data-stay-name="${name}"]`
                   : null
    if (selector) {
      const el = listEl.querySelector<HTMLElement>(selector)
      el?.classList.add("--focused")
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }

    // Focus the matching detail marker
    for (const m of detailMarkers) {
      if (m.getElement().dataset.name === name) { m.getElement().classList.add("--focused"); break }
    }

    const zoom = type === "hub" ? ZOOM_DETAIL : ZOOM_DETAIL_FLY
    if (coords) map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(map.getZoom(), zoom), duration: 800 })
  }
}

// ─── Mobile sheet ─────────────────────────────────────────────────────────────

const SHEET_PEEK   = 72   // px — matches CSS calc(100% - 72px)
const MOBILE_MAX_W = 768

function isMobile(): boolean { return window.innerWidth < MOBILE_MAX_W }

let sheetY = 0

function setSheetY(top: number, animate = false): void {
  const sidebar = document.getElementById("sidebar")!
  sidebar.style.transition = animate ? "top 0.35s cubic-bezier(0.32, 0.72, 0, 1)" : "none"
  sidebar.style.top = `${top}px`
  sheetY = top
}

function sheetSnaps(): { peek: number; half: number; full: number } {
  const vh = window.innerHeight
  return { peek: vh - SHEET_PEEK, half: vh * 0.5, full: vh * 0.1 }
}

function snapSheet(to: "peek" | "half" | "full"): void {
  setSheetY(sheetSnaps()[to], true)
  updateMapPadding()
}

function expandSheetForFocus(): void {
  if (!isMobile()) return
  if (sheetY >= sheetSnaps().half - 10) snapSheet("half")
}

function setupMobileSheet(): void {
  const handle = document.getElementById("sheet-drag-handle")!
  let startY = 0, startSheetY = 0, dragging = false, didDrag = false

  function dragStart(y: number): void {
    dragging    = true
    didDrag     = false
    startY      = y
    startSheetY = sheetY
  }

  function dragMove(y: number): void {
    if (!dragging) return
    didDrag = true
    const { full, peek } = sheetSnaps()
    const dy = y - startY
    setSheetY(Math.max(full, Math.min(peek, startSheetY + dy)))
  }

  function dragEnd(): void {
    if (!dragging) return
    dragging = false
    const s = sheetSnaps()
    const nearest = ([s.full, s.half, s.peek] as const)
      .reduce((a, b) => Math.abs(a - sheetY) < Math.abs(b - sheetY) ? a : b)
    setSheetY(nearest, true)
    updateMapPadding()
  }

  // Touch
  handle.addEventListener("touchstart",  e => { if (isMobile()) dragStart(e.touches[0].clientY) }, { passive: true })
  handle.addEventListener("touchmove",   e => { if (isMobile()) dragMove(e.touches[0].clientY)  }, { passive: true })
  handle.addEventListener("touchend",    () => dragEnd())

  // Mouse (move/up on document so fast drags don't lose tracking)
  handle.addEventListener("mousedown", e => {
    if (!isMobile()) return
    e.preventDefault()
    dragStart(e.clientY)
    document.body.style.userSelect = "none"
    document.body.style.cursor     = "grabbing"
  })
  document.addEventListener("mousemove", e => { if (isMobile()) dragMove(e.clientY) })
  document.addEventListener("mouseup",   () => {
    if (!dragging) return
    dragEnd()
    document.body.style.userSelect = ""
    document.body.style.cursor     = ""
  })

  // Click to toggle peek ↔ half (suppressed if a drag just happened)
  handle.addEventListener("click", () => {
    if (!isMobile() || didDrag) return
    const s = sheetSnaps()
    snapSheet(sheetY > s.half + 10 ? "half" : "peek")
  })

  // Initialize now if on mobile, and re-initialize whenever the viewport enters mobile range.
  // On desktop entry, clear inline styles left by the JS sheet so CSS layout is unaffected.
  const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_W - 1}px)`)
  const sidebar = document.getElementById("sidebar")!
  const init = (): void => snapSheet("peek")
  if (mq.matches) init()
  mq.addEventListener("change", e => {
    if (e.matches) {
      init()
    } else {
      sidebar.style.top        = ""
      sidebar.style.transition = ""
    }
  })
}

// ─── Spinner helpers ──────────────────────────────────────────────────────────

function setPlaceLoading(placeIdx: number, loading: boolean): void {
  document.querySelector(`.place[data-place-index="${placeIdx}"] .place-num`)
    ?.classList.toggle("--loading", loading)
}

function setStayLoading(stayName: string, loading: boolean): void {
  listEl.querySelector<HTMLElement>(`.stay[data-stay-name="${stayName}"] .stay-icon`)
    ?.classList.toggle("--loading", loading)
}

function setActLoading(actName: string, loading: boolean): void {
  for (const item of listEl.querySelectorAll<HTMLElement>(".activity-item[data-act-name]")) {
    if (item.dataset.actName === actName) {
      item.querySelector(".act-label")?.classList.toggle("--loading", loading)
      break
    }
  }
}

// ─── Pill menu ────────────────────────────────────────────────────────────────

const menuTrigger = document.getElementById("menu-trigger") as HTMLElement
const mainMenu    = document.getElementById("main-menu")    as HTMLElement

function closeMenu(): void {
  mainMenu.classList.remove("open")
  menuTrigger.classList.remove("open")
}

menuTrigger.addEventListener("click", e => {
  e.stopPropagation()
  mainMenu.classList.toggle("open")
  menuTrigger.classList.toggle("open")
})
document.addEventListener("click", closeMenu)
mainMenu.addEventListener("click", e => e.stopPropagation())

// ─── Menu → New ───────────────────────────────────────────────────────────────

document.getElementById("menu-new")!.addEventListener("click", () => {
  closeMenu()
  newModal.classList.add("open")
  setTimeout(() => newTextarea.focus(), 50)
})

function closeNewModal(): void {
  newModal.classList.remove("open")
  newTextarea.value = ""
}
document.getElementById("new-close-x")!.addEventListener("click", closeNewModal)
document.getElementById("new-cancel")!.addEventListener("click",   closeNewModal)
newModal.addEventListener("click", e => { if (e.target === newModal) closeNewModal() })
document.getElementById("new-load")!.addEventListener("click", () => {
  const src = newTextarea.value.trim()
  if (!src) return
  editorEl.value = src
  render()
  closeEditor()
  closeNewModal()
})

// ─── Menu → Edit ──────────────────────────────────────────────────────────────

document.getElementById("menu-edit")!.addEventListener("click", () => { closeMenu(); openEditor() })

function openEditor(): void {
  if (editorEl.value === "") editorEl.value = SOURCE
  editorPanel.style.display = "flex"
  editorEl.focus()
}

function closeEditor(): void {
  editorPanel.style.display = "none"
}

document.getElementById("editor-close-btn")!.addEventListener("click", closeEditor)

// ─── Menu → Examples ──────────────────────────────────────────────────────────

document.getElementById("menu-examples")!.addEventListener("click", e => {
  e.stopPropagation()
  document.getElementById("examples-sub")!.classList.toggle("open")
  ;(e.currentTarget as HTMLElement).classList.toggle("open")
})
document.querySelectorAll<HTMLElement>("[data-example]").forEach(el => {
  el.addEventListener("click", () => {
    const src = EXAMPLES[el.dataset.example!]
    if (!src) return
    editorEl.value = src
    render()
    closeEditor()
    closeMenu()
  })
})

// ─── Menu → How to generate ───────────────────────────────────────────────────

document.getElementById("menu-generate")!.addEventListener("click", () => {
  closeMenu()
  generateModal.classList.add("open")
})
function closeGenerate(): void { generateModal.classList.remove("open") }
document.getElementById("generate-close-x")!.addEventListener("click", closeGenerate)
document.getElementById("generate-close")!.addEventListener("click",   closeGenerate)
generateModal.addEventListener("click", e => { if (e.target === generateModal) closeGenerate() })

document.getElementById("dl-spec-btn")!.addEventListener("click", () => {
  if (!SPEC) return
  const blob = new Blob([SPEC], { type: "text/markdown" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "CRUMB_SPEC.md"; a.click()
  URL.revokeObjectURL(url)
})

// ─── Menu → About ─────────────────────────────────────────────────────────────

document.getElementById("menu-about")!.addEventListener("click", () => {
  closeMenu()
  aboutModal.classList.add("open")
})
function closeAbout(): void { aboutModal.classList.remove("open") }
document.getElementById("about-close-x")!.addEventListener("click",   closeAbout)
document.getElementById("about-close-btn")!.addEventListener("click", closeAbout)
aboutModal.addEventListener("click", e => { if (e.target === aboutModal) closeAbout() })

// ─── List click: focus on map-link elements ───────────────────────────────────

listEl.addEventListener("click", e => {
  const link = (e.target as Element).closest("[data-map-link]") as HTMLElement | null
  if (!link) return
  const act  = link.closest<HTMLElement>("[data-act-name]")
  const stay = link.closest<HTMLElement>("[data-stay-name]")
  if (act)  { focusMarker("activity", act.dataset.actName!,  geoIndex.activities.get(act.dataset.actName!)  ?? undefined); return }
  if (stay) { focusMarker("stay",     stay.dataset.stayName!, geoIndex.stays.get(stay.dataset.stayName!)    ?? undefined); return }
  if (link.dataset.hubName) { focusMarker("hub", link.dataset.hubName, geoIndex.hubs.get(link.dataset.hubName) ?? undefined); return }
  const place = link.closest<HTMLElement>("[data-place-index]")
  if (place) {
    const idx = parseInt(place.dataset.placeIndex!, 10)
    focusMarker("place", idx, geoIndex.places[idx] ?? undefined)
  }
})

// ─── MapLibre GL ──────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container:          "map",
  style:              "https://tiles.openfreemap.org/styles/liberty",
  center:             [10, 30],
  zoom:               2,
  attributionControl: false,
})
const attribution = new maplibregl.AttributionControl({ compact: true })
map.addControl(attribution)
setTimeout(() => {
  attribution._container?.querySelector(".maplibregl-ctrl-attrib-button")?.click()
}, 5000)

let mapReady      = false
let pendingDoc:   CrumbDocument | null = null
let placeMarkers: any[] = []
let detailMarkers: any[] = []

function popupHtml(p: { name: string }): string {
  const meta = POPUP_META[p.name]
  return meta
    ? `<span class="popup-title">${escape(p.name)}</span><br><span class="popup-sub">${escape(meta)}</span>`
    : `<span class="popup-title">${escape(p.name)}</span>`
}

function applyZoomClass(): void {
  const z = map.getZoom()
  document.body.classList.toggle("map-zoom-medium", z >= ZOOM_OVERVIEW)
  document.body.classList.toggle("map-zoom-close",  z >= ZOOM_DETAIL)
}
map.on("zoom",    applyZoomClass)
map.on("zoomend", applyZoomClass)

map.on("load", () => {
  map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  map.addLayer({
    id: "route-line", type: "line", source: "route",
    paint: {
      "line-color": ROUTE_COLOR, "line-width": 2,
      "line-opacity": ["step", ["zoom"], 0.5, ZOOM_DETAIL, 0],
      "line-dasharray": [2, 2],
    },
  })
  mapReady = true
  updateMapPadding()
  if (pendingDoc) { updateMap(pendingDoc); pendingDoc = null }
})

function updateMapPadding(): void {
  if (!isMobile() || !mapReady) return
  map.setPadding({ bottom: Math.max(0, Math.round(window.innerHeight - sheetY)) })
}

// ─── Geocoding epoch ──────────────────────────────────────────────────────────

let geocodeEpoch = 0

// ─── Geocoding phase functions ────────────────────────────────────────────────

interface ActivityGeoTarget extends GeoTarget {
  priority: string | null
  placeIdx: number
  actLabel: string
}

interface StayGeoTarget extends GeoTarget {
  stayName: string
  hasCoords: boolean
  placeIdx: number
}

function collectActivityGeoTargets(doc: CrumbDocument): ActivityGeoTarget[] {
  const targets: ActivityGeoTarget[] = []
  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    let actIdx = 0
    for (const group of (item.activities ?? []))
      for (const act of (group.items ?? []))
        if (!act.location?.geocodingDisabled)
          targets.push({
            name:     act.name,
            location: act.location ?? null,
            query:    act.location ? null : `${act.name}, ${item.name}`,
            priority: act.priority ?? null,
            placeIdx,
            actLabel: activityLabel(actIdx++),
          })
  }
  return targets
}

function collectStayGeoTargets(doc: CrumbDocument): StayGeoTarget[] {
  const targets: StayGeoTarget[] = []
  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    for (const stay of (item.stay ?? [])) {
      if (stay.location?.geocodingDisabled) continue
      const hasCoords = stay.location?.lat != null
      targets.push({
        name:      hasCoords ? stay.name : `${stay.name}, ${item.name}`,
        stayName:  stay.name,
        location:  stay.location ?? null,
        hasCoords,
        placeIdx,
      })
    }
  }
  return targets
}

function actPoint(t: ActivityGeoTarget, geo: GeoResult): DetailPoint {
  return {
    name:     t.name,
    lat:      geo.lat,
    lng:      geo.lng,
    pinType:  t.priority === "must" ? "must" : t.priority === "maybe" ? "maybe" : "activity",
    placeIdx: t.placeIdx,
    actLabel: t.actLabel,
  }
}

async function geocodePlaces(
  doc: CrumbDocument,
  epoch: number,
): Promise<{ resolved: Array<{ name: string; lat: number; lng: number }>; resolvedCoords: Map<string, GeoResult> }> {
  const places = doc.itinerary.filter(item => item.type === "place") as import("../types/resolved").Place[]
  const needsFetch = places.filter(
    p => !p.location?.geocodingDisabled && p.location?.lat == null && !cachedGeo(p.location?.label || p.name)
  )
  const needsFetchSet = new Set(needsFetch)

  for (const [i, place] of places.entries()) {
    if (needsFetchSet.has(place)) setPlaceLoading(i + 1, true)
  }
  if (needsFetch.length) setMapStatus("geocoding…")

  const resolved: Array<{ name: string; lat: number; lng: number }> = []
  const resolvedCoords = new Map<string, GeoResult>()
  const retryQueue: Array<{ place: import("../types/resolved").Place; i: number }> = []
  let done = 0

  for (const [i, place] of places.entries()) {
    if (epoch !== geocodeEpoch) return { resolved, resolvedCoords }
    const geo = await resolveGeo(place)
    done++
    if (needsFetch.length) setMapStatus(`geocoding ${done}/${places.length}…`)
    if (geo) {
      setPlaceLoading(i + 1, false)
      writeBackGeo(place, geo)
      resolved.push({ name: place.name, lat: geo.lat, lng: geo.lng })
      resolvedCoords.set(place.name, geo)
    } else {
      retryQueue.push({ place, i })
    }
    geoIndex.places.push(geo ?? null)
  }

  for (const { place, i } of retryQueue) {
    if (epoch !== geocodeEpoch) return { resolved, resolvedCoords }
    const prev     = places[i - 1]?.name
    const next     = places[i + 1]?.name
    const neighbor = resolvedCoords.get(prev ?? "") ? prev
                   : resolvedCoords.get(next ?? "") ? next : null
    const q   = neighbor ? place.name + ", " + neighbor : null
    const geo = q ? (cachedGeo(q) ?? await fetchGeo(q)) : null
    setPlaceLoading(i + 1, false)
    if (geo) {
      cacheGeo(place.name, geo)
      writeBackGeo(place, geo)
      resolved.push({ name: place.name, lat: geo.lat, lng: geo.lng })
      resolvedCoords.set(place.name, geo)
    } else {
      const nameEl = document.querySelector(`.place[data-place-index="${i + 1}"] .place-name-text`)
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
    geoIndex.places[i + 1] = geo ?? null
  }

  return { resolved, resolvedCoords }
}

async function geocodeActivities(
  actTargets: ActivityGeoTarget[],
  epoch: number,
  currentPoints: DetailPoint[],
): Promise<DetailPoint[]> {
  let points = [...currentPoints]

  // Show upfront spinners for activities that need fetching
  for (const t of actTargets) {
    if (t.location?.lat != null) continue
    const actQ = t.query ?? t.name
    if (!cachedGeo(actQ)) setActLoading(t.name, true)
  }

  // Activities with explicit coords — add immediately
  for (const t of actTargets) {
    const loc = t.location
    if (loc?.lat != null && loc?.lng != null) {
      const geo = { lat: loc.lat, lng: loc.lng }
      geoIndex.activities.set(t.name, geo)
      points = [...points, actPoint(t, geo)]
    }
  }
  if (points.length > currentPoints.length) setDetailSource(points)

  // Activities that need geocoding
  for (const t of actTargets) {
    if (t.location?.lat != null) continue
    if (epoch !== geocodeEpoch) return points
    const geo = await resolveGeo(t)
    setActLoading(t.name, false)
    if (epoch !== geocodeEpoch) return points
    if (geo) {
      geoIndex.activities.set(t.name, geo)
      points = [...points, actPoint(t, geo)]
      setDetailSource(points)
    } else {
      const item = listEl.querySelector<HTMLElement>(`.activity-item[data-act-name="${t.name}"]`)
      const nameEl = item?.querySelector(".act-name")
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
  }
  return points
}

async function geocodeStays(
  stayTargets: StayGeoTarget[],
  epoch: number,
  currentPoints: DetailPoint[],
): Promise<DetailPoint[]> {
  let points = [...currentPoints]

  // Show upfront spinners (capped at MAX_UNCACHED_STAY_FETCHES to avoid visual clutter)
  let staysMarked = 0
  for (const t of stayTargets) {
    if (t.hasCoords) continue
    if (staysMarked >= MAX_UNCACHED_STAY_FETCHES) break
    const cacheKey = t.location?.label && t.location.label !== "none" ? t.location.label : t.name
    if (!cachedGeo(cacheKey)) { setStayLoading(t.stayName, true); staysMarked++ }
  }

  let staysFetched = 0
  for (const t of stayTargets) {
    if (epoch !== geocodeEpoch) return points
    const cacheKey = t.location?.label && t.location.label !== "none" ? t.location.label : t.name
    const isCached = t.hasCoords || cachedGeo(cacheKey) != null
    if (!isCached && staysFetched >= MAX_UNCACHED_STAY_FETCHES) { setStayLoading(t.stayName, false); continue }
    const geo = await resolveGeo(t)
    setStayLoading(t.stayName, false)
    if (epoch !== geocodeEpoch) return points
    if (!t.hasCoords && !isCached) staysFetched++
    if (geo) {
      geoIndex.stays.set(t.stayName, geo)
      points = [...points, { name: t.stayName, lat: geo.lat, lng: geo.lng, pinType: "stay" as const, placeIdx: t.placeIdx }]
      setDetailSource(points)
    } else if (!t.hasCoords) {
      const stayEl = listEl.querySelector<HTMLElement>(`.stay[data-stay-name="${t.stayName}"]`)
      const nameEl = stayEl?.querySelector(".stay-name")
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
  }
  return points
}

// ─── Map rendering ────────────────────────────────────────────────────────────

async function updateMap(doc: CrumbDocument): Promise<void> {
  if (!mapReady) { pendingDoc = doc; return }
  const epoch = ++geocodeEpoch
  document.querySelectorAll(".--loading").forEach(el => el.classList.remove("--loading"))

  geoIndex.places     = [null]
  geoIndex.activities = new Map()
  geoIndex.stays      = new Map()
  geoIndex.hubs       = new Map()

  const places = doc.itinerary.filter(item => item.type === "place")
  if (!places.length) {
    map.getSource("route").setData({ type: "FeatureCollection", features: [] })
    placeMarkers.forEach(m => m.remove());  placeMarkers = []
    detailMarkers.forEach(m => m.remove()); detailMarkers = []
    setMapStatus(""); return
  }

  const actTargets  = collectActivityGeoTargets(doc)
  const stayTargets = collectStayGeoTargets(doc)

  // Phase 1: geocode places (two-pass with neighbour-context retry)
  const { resolved, resolvedCoords } = await geocodePlaces(doc, epoch)
  if (epoch !== geocodeEpoch) return
  drawPlaceMarkers(resolved)
  setMapStatus("")

  // Phase 2: geocode transport hubs
  let detailPoints = await geocodeTransportHubs(doc, resolvedCoords, () => epoch !== geocodeEpoch)
  for (const p of detailPoints) {
    if (p.pinType !== "hub") continue
    geoIndex.hubs.set(p.name, { lat: p.lat, lng: p.lng })
    listEl.querySelectorAll<HTMLElement>(".waypoint-name[data-hub-name]").forEach(el => {
      if (el.dataset.hubName === p.name) el.setAttribute("data-map-link", "")
    })
  }
  setDetailSource(detailPoints)

  // Phase 3: geocode activities
  detailPoints = await geocodeActivities(actTargets, epoch, detailPoints)

  // Phase 4: geocode stays
  await geocodeStays(stayTargets, epoch, detailPoints)
}

// ─── Map marker helpers ───────────────────────────────────────────────────────

function drawPlaceMarkers(points: Array<{ name: string; lat: number; lng: number }>): void {
  map.getSource("route").setData({
    type: "FeatureCollection",
    features: points.length > 1
      ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(p => [p.lng, p.lat]) } }]
      : [],
  })

  placeMarkers.forEach(m => m.remove()); placeMarkers = []

  for (const [i, p] of points.entries()) {
    const el = document.createElement("div")
    el.className = "place-marker"
    el.innerHTML = `<span class="place-marker-num">${i + 1}</span>`
    const popup = new maplibregl.Popup({ closeButton: false, offset: 20, className: "place-popup" })
      .setHTML(popupHtml(p))
    el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(map))
    el.addEventListener("mouseleave", () => popup.remove())
    el.addEventListener("click", evt => { evt.stopPropagation(); focusMarker("place", i + 1, { lat: p.lat, lng: p.lng }) })
    placeMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map)
    )
  }

  if (focusedPlaceIdx > 0) placeMarkers[focusedPlaceIdx - 1]?.getElement().classList.add("--focused")

  if (points.length) {
    const bounds = new maplibregl.LngLatBounds()
    points.forEach(p => bounds.extend([p.lng, p.lat]))
    map.fitBounds(bounds, { padding: 60, maxZoom: 10 })
    applyZoomClass()
  }
}

function setDetailSource(points: DetailPoint[]): void {
  detailMarkers.forEach(m => m.remove()); detailMarkers = []

  for (const p of points) {
    const el = document.createElement("div")
    el.className = `detail-marker detail-marker--${p.pinType ?? "activity"}`
    if (p.pinType === "stay")     el.innerHTML = ICONS["stay"]
    else if (p.pinType === "hub") el.innerHTML = ICONS[p.mode ?? ""] ?? ICONS["transport"]
    else if (p.actLabel)          el.innerHTML = `<span class="detail-marker-label">${escape(p.actLabel)}</span>`
    const popup = new maplibregl.Popup({ closeButton: false, offset: 14, className: "detail-popup" })
      .setHTML(popupHtml(p))
    el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(map))
    el.addEventListener("mouseleave", () => popup.remove())
    el.dataset.name = p.name
    const geo = { lat: p.lat, lng: p.lng }
    const type: FocusType = p.pinType === "stay" ? "stay" : p.pinType === "hub" ? "hub" : "activity"
    el.addEventListener("click", evt => { evt.stopPropagation(); focusMarker(type, p.name, geo) })
    detailMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map)
    )
  }

  const focusedDetailName = focusedActName ?? focusedStayName ?? focusedHubName
  if (focusedDetailName !== null) {
    for (const m of detailMarkers) {
      if (m.getElement().dataset.name === focusedDetailName) { m.getElement().classList.add("--focused"); break }
    }
  }
}

function setMapStatus(text: string): void { mapStatusEl.textContent = text }

// ─── Live editor ──────────────────────────────────────────────────────────────

function setEditorError(msg: string): void {
  errorBar.textContent = msg
  errorBar.style.display = msg ? "" : "none"
}

let debounce: ReturnType<typeof setTimeout>

function render(): void {
  const src = editorEl.value.trim()
  if (!src) {
    listEl.innerHTML = '<div class="list-empty">Start typing a .crumb document…</div>'
    setEditorError("")
    if (mapReady) {
      map.getSource("route").setData({ type: "FeatureCollection", features: [] })
      placeMarkers.forEach(m => m.remove());  placeMarkers = []
      detailMarkers.forEach(m => m.remove()); detailMarkers = []
    }
    setMapStatus(""); return
  }
  try {
    const doc  = window.Crumb.parse(src)
    DATA       = doc
    POPUP_META = window.Crumb.buildPopupMeta(doc)
    document.title = "Crumb" + (doc.trip?.name ? " — " + doc.trip.name : "")
    listEl.innerHTML = window.Crumb.renderItineraryBody(doc)
    setEditorError("")
    updateMap(doc)
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).split("\n")[0]
    setEditorError("⚠ " + msg)
  }
}

editorEl.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(render, 220) })
editorEl.addEventListener("keydown", e => {
  if (e.key !== "Tab") return
  e.preventDefault()
  const s = editorEl.selectionStart, v = editorEl.value
  editorEl.value = v.slice(0, s) + "  " + v.slice(editorEl.selectionEnd)
  editorEl.selectionStart = editorEl.selectionEnd = s + 2
})

// ─── Boot ─────────────────────────────────────────────────────────────────────

setupMobileSheet()
updateMap(DATA)
