import type { CrumbDocument, Place } from "../types/resolved"
import {
  cachedGeo,
  cacheGeo,
  fetchGeo,
  resolveGeo,
  isKnownMiss,
  writeBackGeo,
  geocodeTransportPoints,
  type GeoResult,
  type DetailPoint,
} from "./geocoder"
import {
  ICON_STAY, ICON_PLANE, ICON_TRAIN, ICON_BUS, ICON_CAR, ICON_SHIP,
  ICON_WALK, ICON_BIKE, ICON_ROUTE, ICON_PIN_OFF,
} from "./icons"
import { escape } from "./format"
import {
  collectActivityGeoTargets,
  collectStayGeoTargets,
  type ActivityGeoTarget,
  type StayGeoTarget,
} from "./geo-targets"
import { state, ZOOM_OVERVIEW, ZOOM_DETAIL, ROUTE_COLOR, MOBILE_MAX_W, SHEET_MEDIUM_RATIO, EMBED } from "./app-state"

declare const maplibregl: any

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
}
const GEO_FAIL_ICON  = `<span class="geo-no-loc">${ICON_PIN_OFF}</span>`
const GEO_NO_MAP_TAG = `<span class="tag tag--icon">${ICON_PIN_OFF} No map</span>`

const mapStatusEl = document.getElementById("map-status") as HTMLElement

// ─── MapLibre GL init ─────────────────────────────────────────────────────────

// Handlers toggled by setMapInteraction(). In embed mode they start disabled so
// the map is a static preview that a host page can scroll past; the expand control
// and the desktop preview re-enable them (see setMapInteraction).
const INTERACTION_HANDLERS = [
  "scrollZoom", "boxZoom", "dragRotate", "dragPan",
  "keyboard", "doubleClickZoom", "touchZoomRotate", "touchPitch",
] as const

// Desktop preview allows mouse pan only — click-drag doesn't collide with page
// scroll (unlike touch pan or wheel-zoom), so the locked card can still be panned
// without trapping the wheel. Mobile preview stays fully locked (scrim scrolls host).
const PREVIEW_HANDLERS: readonly string[] = ["dragPan"]

state.map = new maplibregl.Map({
  container:          "map",
  style:              "https://tiles.openfreemap.org/styles/liberty",
  center:             [10, 30],
  zoom:               2,
  attributionControl: false,
  ...(EMBED ? Object.fromEntries(INTERACTION_HANDLERS.map(h => [h, false])) : {}),
})

/**
 * Set the embed map's interaction level.
 *   "preview" — locked card: desktop gets mouse dragPan, mobile gets nothing.
 *   "full"    — expanded: every handler on.
 */
export function setMapInteraction(mode: "preview" | "full"): void {
  const mobile = window.innerWidth < MOBILE_MAX_W
  for (const h of INTERACTION_HANDLERS) {
    const on = mode === "full" || (mode === "preview" && !mobile && PREVIEW_HANDLERS.includes(h))
    const handler = (state.map as any)[h]
    if (handler) on ? handler.enable() : handler.disable()
  }
}

// Keep the map canvas matched to its container through every late reflow — the
// card legend loading in, the editor split-width restore, CodeMirror laying out,
// a web-font swap, window resizes. maplibre's own trackResize is async and races
// the initial fitBounds, so we own this: a ResizeObserver that resizes only on a
// real dimension change, batched to a frame to avoid the "ResizeObserver loop"
// warning. Generic — applies in viewer, editor, embed and card alike.
const mapEl = document.getElementById("map")!
let lastW = 0, lastH = 0, resizePending = false
new ResizeObserver(entries => {
  const box = entries[0]?.contentRect
  if (!box || (box.width === lastW && box.height === lastH)) return
  lastW = box.width; lastH = box.height
  if (resizePending) return
  resizePending = true
  requestAnimationFrame(() => { resizePending = false; if (state.map) state.map.resize() })
}).observe(mapEl)
const attribution = new maplibregl.AttributionControl({ compact: true })
state.map.addControl(attribution)
setTimeout(() => {
  attribution._container?.querySelector(".maplibregl-ctrl-attrib-button")?.click()
}, 5000)

function applyZoomClass(): void {
  const z = state.map.getZoom()
  document.body.classList.toggle("map-zoom-medium", z >= ZOOM_OVERVIEW)
  document.body.classList.toggle("map-zoom-close",  z >= ZOOM_DETAIL)
}
state.map.on("zoom",    applyZoomClass)
state.map.on("zoomend", applyZoomClass)
state.map.on("click", () => document.dispatchEvent(new CustomEvent("crumb:map-click")))

state.map.on("load", () => {
  state.map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  state.map.addLayer({
    id: "route-line", type: "line", source: "route",
    paint: {
      "line-color": ROUTE_COLOR, "line-width": 2,
      "line-opacity": ["step", ["zoom"], 0.5, ZOOM_DETAIL, 0],
      "line-dasharray": [2, 2],
    },
  })
  state.mapReady = true
  state.map.setPadding(mapPadding())
  if (state.pendingDoc) { updateMap(state.pendingDoc); state.pendingDoc = null }
})

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function popupHtml(p: { name: string }): string {
  return `<span class="popup-title">${escape(p.name)}</span>`
}

// ─── Spinner helpers ──────────────────────────────────────────────────────────

function setPlaceLoading(placeIdx: number, loading: boolean): void {
  document.querySelector(`.list-item--place[data-place-idx="${placeIdx}"] .place-num`)
    ?.classList.toggle("--loading", loading)
}

function setStayLoading(stayName: string, loading: boolean): void {
  document.getElementById("panel-content")
    ?.querySelector(`.list-item--stay[data-stay-name="${stayName}"] .stay-icon-wrap`)
    ?.classList.toggle("--loading", loading)
}

function setActLoading(actName: string, loading: boolean): void {
  document.getElementById("panel-content")
    ?.querySelector(`.list-item--activity[data-act-name="${actName}"] .act-badge`)
    ?.classList.toggle("--loading", loading)
}

function markAllPendingLoading(doc: CrumbDocument): void {
  const places = doc.itinerary.filter(item => item.type === "place") as Place[]
  for (const [i, place] of places.entries()) {
    if (!place.location?.geocodingDisabled && place.location?.lat == null) {
      const key = place.location?.label || place.name
      if (!cachedGeo(key) && !isKnownMiss(key)) setPlaceLoading(i + 1, true)
    }
  }
  for (const t of collectActivityGeoTargets(doc)) {
    if (t.location?.lat != null) continue
    if (state.geoIndex.activities.has(t.name)) continue
    if (state.geoIndex.actsFailed.has(t.name)) continue
    const key = t.query ?? t.name
    if (!cachedGeo(key) && !isKnownMiss(key)) setActLoading(t.name, true)
  }
  for (const t of collectStayGeoTargets(doc)) {
    if (t.hasCoords) continue
    if (state.geoIndex.stays.has(t.stayName)) continue
    if (state.geoIndex.staysFailed.has(t.stayName)) continue
    const key = t.name
    if (!cachedGeo(key) && !isKnownMiss(key)) setStayLoading(t.stayName, true)
  }
}

/** Apply pending-load spinners and fail icons to whatever is currently in the panel. */
export function applyGeoState(doc: CrumbDocument): void {
  markAllPendingLoading(doc)
  for (const placeIdx of state.geoIndex.placesFailed) {
    // Trip overview list item — small icon in the name
    const nameEl = document.querySelector(`.list-item--place[data-place-idx="${placeIdx}"] .list-item-label`)
    if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    // Place detail panel — "No map" tag in the tags area, below the header
    if (state.activePlaceIndex === placeIdx) {
      const tagsEl = document.querySelector<HTMLElement>(".panel-place-body .tags")
      if (tagsEl) {
        if (!tagsEl.querySelector(".tag--icon")) tagsEl.insertAdjacentHTML("afterbegin", GEO_NO_MAP_TAG)
      } else {
        const placeBody = document.querySelector<HTMLElement>(".panel-place-body")
        if (placeBody) {
          placeBody.insertAdjacentHTML("afterbegin", `<div class="tags">${GEO_NO_MAP_TAG}</div>`)
        } else {
          const panelHeader = document.querySelector<HTMLElement>(".panel-header")
          panelHeader?.insertAdjacentHTML("afterend", `<div class="panel-place-body"><div class="tags">${GEO_NO_MAP_TAG}</div></div>`)
        }
      }
    }
  }
  for (const t of collectActivityGeoTargets(doc)) {
    if (!state.geoIndex.actsFailed.has(t.name)) continue
    const card = document.getElementById("panel-content")?.querySelector(`.list-item--activity[data-act-name="${escape(t.name)}"]`)
    const nameEl = card?.querySelector(".list-item-meta") ?? card?.querySelector(".list-item-label")
    if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
  }
  for (const t of collectStayGeoTargets(doc)) {
    if (!state.geoIndex.staysFailed.has(t.stayName)) continue
    const card = document.getElementById("panel-content")?.querySelector(`.list-item--stay[data-stay-name="${escape(t.stayName)}"]`)
    const nameEl = card?.querySelector(".list-item-meta") ?? card?.querySelector(".list-item-label")
    if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
  }
}

// ─── Geo target collection ────────────────────────────────────────────────────
// collectActivityGeoTargets / collectStayGeoTargets live in ./geo-targets so the
// offline geo-cache generator can reuse the exact same query set.

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

// ─── Geocoding phases ─────────────────────────────────────────────────────────

async function geocodePlaces(
  doc: CrumbDocument,
  epoch: number,
): Promise<{ resolved: Array<{ name: string; lat: number; lng: number }>; resolvedCoords: Map<string, GeoResult> }> {
  const places = doc.itinerary.filter(item => item.type === "place") as Place[]
  const needsFetch = places.filter(
    p => !p.location?.geocodingDisabled && p.location?.lat == null && !cachedGeo(p.location?.label || p.name)
  )
  if (needsFetch.length) setMapStatus("geocoding…")

  const resolved: Array<{ name: string; lat: number; lng: number }> = []
  const resolvedCoords = new Map<string, GeoResult>()
  const retryQueue: Array<{ place: Place; i: number }> = []
  let done = 0

  for (const [i, place] of places.entries()) {
    if (epoch !== state.geocodeEpoch) return { resolved, resolvedCoords }
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
    state.geoIndex.places.push(geo ?? null)
  }

  for (const { place, i } of retryQueue) {
    if (epoch !== state.geocodeEpoch) return { resolved, resolvedCoords }
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
      state.geoIndex.placesFailed.add(i + 1)
      const nameEl = document.querySelector(`.list-item--place[data-place-idx="${i + 1}"] .list-item-label`)
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
    state.geoIndex.places[i + 1] = geo ?? null
  }

  return { resolved, resolvedCoords }
}

const MAX_RADIUS_LAT = 3.0   // ~330 km
const MAX_RADIUS_LNG = 5.0   // ~350 km at mid-latitudes

function tooFarFromParent(geo: GeoResult, parentCoords: GeoResult): boolean {
  return Math.abs(geo.lat - parentCoords.lat) > MAX_RADIUS_LAT ||
         Math.abs(geo.lng - parentCoords.lng) > MAX_RADIUS_LNG
}

async function geocodeActivities(
  actTargets: ActivityGeoTarget[],
  epoch: number,
  currentPoints: DetailPoint[],
  parentCoords?: GeoResult,
): Promise<DetailPoint[]> {
  let points = [...currentPoints]

  for (const t of actTargets) {
    const loc = t.location
    if (loc?.lat != null && loc?.lng != null) {
      const geo = { lat: loc.lat, lng: loc.lng }
      state.geoIndex.activities.set(t.name, geo)
      points = [...points, actPoint(t, geo)]
    }
  }
  if (points.length > currentPoints.length) setDetailSource(points)

  for (const t of actTargets) {
    if (t.location?.lat != null) continue
    if (epoch !== state.geocodeEpoch) return points
    const target = parentCoords ? { ...t, parentCoords } : t
    let geo = await resolveGeo(target)
    setActLoading(t.name, false)
    if (epoch !== state.geocodeEpoch) return points
    if (geo && parentCoords && tooFarFromParent(geo, parentCoords)) geo = null
    if (geo) {
      state.geoIndex.activities.set(t.name, geo)
      points = [...points, actPoint(t, geo)]
      setDetailSource(points)
    } else {
      state.geoIndex.actsFailed.add(t.name)
      const card = document.getElementById("panel-content")?.querySelector(`.list-item--activity[data-act-name="${escape(t.name)}"]`)
      const nameEl = card?.querySelector(".list-item-meta") ?? card?.querySelector(".list-item-label")
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
  }
  return points
}

async function geocodeStays(
  stayTargets: StayGeoTarget[],
  epoch: number,
  currentPoints: DetailPoint[],
  parentCoords?: GeoResult,
): Promise<DetailPoint[]> {
  let points = [...currentPoints]

  for (const t of stayTargets) {
    if (epoch !== state.geocodeEpoch) return points
    const target = parentCoords ? { ...t, parentCoords } : t
    let geo = await resolveGeo(target)
    setStayLoading(t.stayName, false)
    if (epoch !== state.geocodeEpoch) return points
    if (geo && parentCoords && tooFarFromParent(geo, parentCoords)) geo = null
    if (geo) {
      state.geoIndex.stays.set(t.stayName, geo)
      points = [...points, { name: t.stayName, lat: geo.lat, lng: geo.lng, pinType: "stay" as const, placeIdx: t.placeIdx }]
      setDetailSource(points)
    } else if (!t.hasCoords) {
      state.geoIndex.staysFailed.add(t.stayName)
      const stayCard = document.getElementById("panel-content")?.querySelector(`.list-item--stay[data-stay-name="${escape(t.stayName)}"]`)
      const stayNameEl = stayCard?.querySelector(".list-item-meta") ?? stayCard?.querySelector(".list-item-label")
      if (stayNameEl && !stayNameEl.querySelector(".geo-no-loc")) stayNameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
  }
  return points
}

// ─── updateMap ────────────────────────────────────────────────────────────────

export async function updateMap(doc: CrumbDocument | null): Promise<void> {
  if (!state.mapReady) { state.pendingDoc = doc; return }
  if (!doc) return
  const epoch = ++state.geocodeEpoch
  document.querySelectorAll(".--loading").forEach(el => el.classList.remove("--loading"))

  state.geoIndex.places       = [null]
  state.geoIndex.activities   = new Map()
  state.geoIndex.stays        = new Map()
  state.geoIndex.transports         = new Map()
  state.geoIndex.placesFailed = new Set()
  state.geoIndex.actsFailed   = new Set()
  state.geoIndex.staysFailed  = new Set()
  state.geoIndex.transportsFailed = new Set()

  const places = doc.itinerary.filter(item => item.type === "place")
  if (!places.length) {
    state.map.getSource("route").setData({ type: "FeatureCollection", features: [] })
    state.placeMarkers.forEach(m => m.remove());  state.placeMarkers = []
    state.detailMarkers.forEach(m => m.remove()); state.detailMarkers = []
    setMapStatus(""); return
  }

  const actTargets  = collectActivityGeoTargets(doc)
  const stayTargets = collectStayGeoTargets(doc)

  markAllPendingLoading(doc)

  const { resolved, resolvedCoords } = await geocodePlaces(doc, epoch)
  if (epoch !== state.geocodeEpoch) return
  drawPlaceMarkers(resolved)
  setMapStatus("")

  const { points: transportPoints, failed: transportFailed } = await geocodeTransportPoints(doc, resolvedCoords, () => epoch !== state.geocodeEpoch)
  let detailPoints = transportPoints
  state.geoIndex.transportsFailed = new Set(transportFailed)
  // Register every solved endpoint (including ones near a place that get no marker)
  // so a from/to click always has coords to fly to.
  for (const item of doc.itinerary) {
    if (item.type !== "transport") continue
    for (const ep of [item.from, item.to]) {
      if (ep?.lat != null && ep?.lng != null) state.geoIndex.transports.set(ep.label, { lat: ep.lat, lng: ep.lng })
    }
  }
  setDetailSource(detailPoints)
  // Let an open transport panel re-decorate its from/to names now that geocoding settled.
  document.dispatchEvent(new CustomEvent("crumb:geo-updated"))

  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    const parentCoords: GeoResult | undefined =
      item.location?.lat != null && item.location?.lng != null
        ? { lat: item.location.lat, lng: item.location.lng }
        : resolvedCoords.get(item.name)
    const placeActs  = actTargets.filter(t => t.placeIdx === placeIdx)
    const placeStays = stayTargets.filter(t => t.placeIdx === placeIdx)
    detailPoints = await geocodeActivities(placeActs, epoch, detailPoints, parentCoords)
    if (epoch !== state.geocodeEpoch) return
    detailPoints = await geocodeStays(placeStays, epoch, detailPoints, parentCoords)
    if (epoch !== state.geocodeEpoch) return
  }
}

// ─── Map helpers ─────────────────────────────────────────────────────────────

/**
 * Camera padding passed to every flyTo / fitBounds call.
 * Desktop: sidebar is 320px wide at left:12px → left = 332 + inner.
 * Mobile:  bottom sheet → bottom = current sheet height + inner.
 *          Reads --sheet-h (set synchronously by setSheetH in app-sheet.ts)
 *          rather than offsetHeight, which can lag during a CSS transition.
 *
 * Pass the SAME padding to every camera operation so MapLibre's stored
 * camera-padding state never drifts between calls.
 */
export function mapPadding(inner = 60) {
  // Card embeds (?card) hide the sidebar/sheet; the legend is an opaque column
  // beside the map (not over it), so the map frames with symmetric, tighter
  // padding. (A card skips the sidebar/sheet branches below.)
  if (document.body.classList.contains("embed-card")) {
    const m = Math.round(inner * 0.5)
    return { top: m, right: m, bottom: m, left: m }
  }
  if (window.innerWidth < MOBILE_MAX_W) {
    const raw    = document.documentElement.style.getPropertyValue("--sheet-h")
    const sheetH = raw ? parseFloat(raw) : window.innerHeight * SHEET_MEDIUM_RATIO
    return { top: inner, right: inner, bottom: sheetH + inner, left: inner }
  }
  return { top: inner, right: inner, bottom: inner, left: 332 + inner }
}

/**
 * Re-measure the container before framing. A fit can run in the same tick as a
 * reflow (e.g. baked-geo card: legend inserted → fitBounds, before the
 * ResizeObserver callback fires), so a synchronous resize here guarantees the
 * camera frames against the live container size rather than a stale one.
 * Pass the same padding to every camera op so MapLibre's stored padding never drifts.
 */
function fitToBounds(bounds: any): void {
  state.map.resize()
  state.map.setPadding(mapPadding())
  state.map.fitBounds(bounds, { maxZoom: 10 })
}

// ─── Map marker rendering ─────────────────────────────────────────────────────

export function drawPlaceMarkers(points: Array<{ name: string; lat: number; lng: number }>): void {
  state.map.getSource("route").setData({
    type: "FeatureCollection",
    features: points.length > 1
      ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(p => [p.lng, p.lat]) } }]
      : [],
  })

  state.placeMarkers.forEach(m => m.remove()); state.placeMarkers = []

  for (const [i, p] of points.entries()) {
    const el = document.createElement("div")
    el.className = "place-marker"
    el.innerHTML = `<span class="place-marker-num">${i + 1}</span>`
    const popup = new maplibregl.Popup({ closeButton: false, offset: 20, className: "place-popup" })
      .setHTML(popupHtml(p))
    el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(state.map))
    el.addEventListener("mouseleave", () => popup.remove())
    el.addEventListener("click", evt => {
      evt.stopPropagation()
      document.dispatchEvent(new CustomEvent("crumb:marker", { detail: { type: "place", placeIdx: i + 1 } }))
    })
    state.placeMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(state.map)
    )
  }

  if (state.focusedPlaceIdx > 0) state.placeMarkers[state.focusedPlaceIdx - 1]?.getElement().classList.add("--focused")

  if (points.length) {
    const bounds = new maplibregl.LngLatBounds()
    points.forEach(p => bounds.extend([p.lng, p.lat]))
    fitToBounds(bounds)
    applyZoomClass()
  }
}

export function setDetailSource(points: DetailPoint[]): void {
  state.detailMarkers.forEach(m => m.remove()); state.detailMarkers = []

  for (const p of points) {
    const el = document.createElement("div")
    el.className = `detail-marker detail-marker--${p.pinType ?? "activity"}`
    if (p.pinType === "stay")     el.innerHTML = ICONS["stay"]
    else if (p.pinType === "transport") el.innerHTML = ICONS[p.mode ?? ""] ?? ICONS["transport"]
    else if (p.actLabel)          el.innerHTML = `<span class="detail-marker-label">${escape(p.actLabel)}</span>`
    const popup = new maplibregl.Popup({ closeButton: false, offset: 14, className: "detail-popup" })
      .setHTML(popupHtml(p))
    el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(state.map))
    el.addEventListener("mouseleave", () => popup.remove())
    el.dataset.name = p.name
    if (p.placeIdx != null) el.dataset.placeIdx = String(p.placeIdx)
    const type = p.pinType === "stay" ? "stay" : p.pinType === "transport" ? "transport" : "activity"
    el.addEventListener("click", evt => {
      evt.stopPropagation()
      document.dispatchEvent(new CustomEvent("crumb:marker", {
        detail: { type, name: p.name, placeIdx: p.placeIdx, transportIdx: p.transportIdx }
      }))
    })
    state.detailMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(state.map)
    )
  }

  applyDetailMarkerFilter()

  const focusedDetailName = state.focusedActName ?? state.focusedStayName ?? state.focusedTransportName
  if (focusedDetailName !== null) {
    for (const m of state.detailMarkers) {
      if (m.getElement().dataset.name === focusedDetailName) { m.getElement().classList.add("--focused"); break }
    }
  }
}

/**
 * Show/hide detail markers based on the current navigation level:
 *   - trip level (activePlaceIndex === null): all markers (activity + stay + transport)
 *   - place level (activePlaceIndex = N):     that place's activity/stay markers + transport markers
 * Transport markers show at both levels (the place-detail zoom keeps only nearby ones in view).
 * Zoom thresholds (CSS) gate the actual rendering; this layer only narrows by focus.
 */
export function applyDetailMarkerFilter(): void {
  const placeIdx = state.activePlaceIndex
  for (const m of state.detailMarkers) {
    const el = m.getElement()
    if (placeIdx === null) {
      el.style.display = ""
    } else {
      const isTransport = el.classList.contains("detail-marker--transport")
      const mp = el.dataset.placeIdx !== undefined ? parseInt(el.dataset.placeIdx) : null
      el.style.display = isTransport || mp === placeIdx ? "" : "none"
    }
  }
}

export function setMapStatus(text: string): void { mapStatusEl.textContent = text }

export function fitAllPlaces(): void {
  if (!state.mapReady || !state.placeMarkers.length) return
  const bounds = new maplibregl.LngLatBounds()
  state.placeMarkers.forEach((m: any) => bounds.extend(m.getLngLat()))
  fitToBounds(bounds)
}

export function fitTransportPoints(
  fromName: string | null,
  toName: string | null,
  prevPlaceIdx: number | null = null,
  nextPlaceIdx: number | null = null,
): void {
  if (!state.mapReady) return

  // geoIndex.places is reset to [null] at the start of every updateMap call, so it is
  // always specific to the current document. state.placeMarkers is only cleared inside
  // drawPlaceMarkers (after geocoding finishes) and can hold stale markers from the
  // previous document when the user switches examples or opens a panel mid-geocode.
  const fromPlace = prevPlaceIdx !== null ? state.geoIndex.places[prevPlaceIdx] ?? undefined : undefined
  const toPlace   = nextPlaceIdx !== null ? state.geoIndex.places[nextPlaceIdx] ?? undefined : undefined

  // Reject a transport geocode if it's implausibly far from its neighbouring place
  // (~500km tolerance — catches Nominatim returning a wrong city/country).
  function sanityCheck(
    cand: { lat: number; lng: number } | undefined,
    ref: { lat: number; lng: number } | undefined,
  ): { lat: number; lng: number } | undefined {
    if (!cand) return undefined
    if (!ref)  return cand
    return (Math.abs(cand.lat - ref.lat) < 5 && Math.abs(cand.lng - ref.lng) < 7) ? cand : undefined
  }

  const fromGeo = sanityCheck(fromName ? state.geoIndex.transports.get(fromName) : undefined, fromPlace) ?? fromPlace
  const toGeo   = sanityCheck(toName   ? state.geoIndex.transports.get(toName)   : undefined, toPlace)   ?? toPlace

  if (fromGeo && toGeo) {
    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([fromGeo.lng, fromGeo.lat])
    bounds.extend([toGeo.lng,   toGeo.lat])
    fitToBounds(bounds)
  } else {
    // One or both place geocodes not yet available (geocoding still in progress).
    // Fall back to the trip overview fit so the map stays coherent.
    fitAllPlaces()
  }
}
