import type { CrumbDocument, Place } from "../types/resolved"
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
import { state, ZOOM_OVERVIEW, ZOOM_DETAIL, ZOOM_PLACE_FLY, ROUTE_COLOR, MOBILE_MAX_W } from "./app-state"
import { focusMarker } from "./app-focus"

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
  globe_off: ICON_GLOBE_OFF,
  arrives:   ICON_ARRIVES,
  departs:   ICON_DEPARTS,
  clock:     ICON_CLOCK,
}
const GEO_FAIL_ICON = `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>`

const mapStatusEl = document.getElementById("map-status") as HTMLElement

// ─── MapLibre GL init ─────────────────────────────────────────────────────────

state.map = new maplibregl.Map({
  container:          "map",
  style:              "https://tiles.openfreemap.org/styles/liberty",
  center:             [10, 30],
  zoom:               2,
  attributionControl: false,
})
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
  const meta = state.POPUP_META[p.name]
  return meta
    ? `<span class="popup-title">${escape(p.name)}</span><br><span class="popup-sub">${escape(meta)}</span>`
    : `<span class="popup-title">${escape(p.name)}</span>`
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
    if (!place.location?.geocodingDisabled && place.location?.lat == null)
      if (!cachedGeo(place.location?.label || place.name)) setPlaceLoading(i + 1, true)
  }
  for (const t of collectActivityGeoTargets(doc)) {
    if (t.location?.lat != null) continue
    if (state.geoIndex.activities.has(t.name)) continue
    if (state.geoIndex.actsFailed.has(t.name)) continue
    if (!cachedGeo(t.query ?? t.name)) setActLoading(t.name, true)
  }
  for (const t of collectStayGeoTargets(doc)) {
    if (t.hasCoords) continue
    if (state.geoIndex.stays.has(t.stayName)) continue
    if (state.geoIndex.staysFailed.has(t.stayName)) continue
    const cacheKey = t.location?.label && t.location.label !== "none" ? t.location.label : t.name
    if (!cachedGeo(cacheKey)) setStayLoading(t.stayName, true)
  }
}

/** Apply pending-load spinners and fail icons to whatever is currently in the panel. */
export function applyGeoState(doc: CrumbDocument): void {
  markAllPendingLoading(doc)
  for (const t of collectActivityGeoTargets(doc)) {
    if (!state.geoIndex.actsFailed.has(t.name)) continue
    const nameEl = document.getElementById("panel-content")
      ?.querySelector(`.list-item--activity[data-act-name="${escape(t.name)}"] .list-item-meta`)
    if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
  }
  for (const t of collectStayGeoTargets(doc)) {
    if (!state.geoIndex.staysFailed.has(t.stayName)) continue
    const nameEl = document.getElementById("panel-content")
      ?.querySelector(`.list-item--stay[data-stay-name="${escape(t.stayName)}"] .list-item-meta`)
    if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
  }
}

// ─── Geo target collection ────────────────────────────────────────────────────

interface ActivityGeoTarget extends GeoTarget {
  priority: string | null
  placeIdx: number
  actLabel: string
}

interface StayGeoTarget extends GeoTarget {
  stayName:  string
  hasCoords: boolean
  placeIdx:  number
}

function collectActivityGeoTargets(doc: CrumbDocument): ActivityGeoTarget[] {
  const targets: ActivityGeoTarget[] = []
  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    let dayIdx = 0, weekIdx = 0, planIdx = 0, ungroupedIdx = 0
    for (const actItem of (item.activities ?? [])) {
      if (actItem.type === "group") {
        const isPlan = actItem.kind === "plan"
        if (isPlan)                        planIdx++
        else if (actItem.kind === "day")   dayIdx++
        else if (actItem.kind === "week")  weekIdx++
        const groupNum = isPlan ? planIdx : actItem.kind === "day" ? dayIdx : actItem.kind === "week" ? weekIdx : undefined
        let actGroupIdx = 0
        for (const act of (actItem.items ?? [])) {
          if (!act.location?.geocodingDisabled)
            targets.push({
              name:     act.name,
              location: act.location ?? null,
              query:    act.location ? null : `${act.name}, ${item.name}`,
              priority: act.priority ?? null,
              placeIdx,
              actLabel: activityLabel(actGroupIdx, groupNum),
            })
          actGroupIdx++
        }
      } else {
        let localIdx = ungroupedIdx
        for (const act of (actItem.items ?? [])) {
          if (!act.location?.geocodingDisabled)
            targets.push({
              name:     act.name,
              location: act.location ?? null,
              query:    act.location ? null : `${act.name}, ${item.name}`,
              priority: act.priority ?? null,
              placeIdx,
              actLabel: activityLabel(localIdx),
            })
          localIdx++
          ungroupedIdx++
        }
      }
    }
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
      const nameEl = document.querySelector(`.list-item--place[data-place-idx="${i + 1}"] .list-item-label`)
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
    }
    state.geoIndex.places[i + 1] = geo ?? null
  }

  return { resolved, resolvedCoords }
}

async function geocodeActivities(
  actTargets: ActivityGeoTarget[],
  epoch: number,
  currentPoints: DetailPoint[],
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
    const geo = await resolveGeo(t)
    setActLoading(t.name, false)
    if (epoch !== state.geocodeEpoch) return points
    if (geo) {
      state.geoIndex.activities.set(t.name, geo)
      points = [...points, actPoint(t, geo)]
      setDetailSource(points)
    } else {
      state.geoIndex.actsFailed.add(t.name)
      const nameEl = document.getElementById("panel-content")?.querySelector(`.list-item--activity[data-act-name="${escape(t.name)}"] .list-item-meta`)
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

  for (const t of stayTargets) {
    if (epoch !== state.geocodeEpoch) return points
    const geo = await resolveGeo(t)
    setStayLoading(t.stayName, false)
    if (epoch !== state.geocodeEpoch) return points
    if (geo) {
      state.geoIndex.stays.set(t.stayName, geo)
      points = [...points, { name: t.stayName, lat: geo.lat, lng: geo.lng, pinType: "stay" as const, placeIdx: t.placeIdx }]
      setDetailSource(points)
    } else if (!t.hasCoords) {
      state.geoIndex.staysFailed.add(t.stayName)
      const nameEl = document.getElementById("panel-content")?.querySelector(`.list-item--stay[data-stay-name="${escape(t.stayName)}"] .list-item-meta`)
      if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
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

  state.geoIndex.places      = [null]
  state.geoIndex.activities  = new Map()
  state.geoIndex.stays       = new Map()
  state.geoIndex.hubs        = new Map()
  state.geoIndex.actsFailed  = new Set()
  state.geoIndex.staysFailed = new Set()

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

  let detailPoints = await geocodeTransportHubs(doc, resolvedCoords, () => epoch !== state.geocodeEpoch)
  for (const p of detailPoints) {
    if (p.pinType !== "hub") continue
    state.geoIndex.hubs.set(p.name, { lat: p.lat, lng: p.lng })
    document.querySelectorAll<HTMLElement>(".waypoint-name[data-hub-name]").forEach(el => {
      if (el.dataset.hubName === p.name) el.setAttribute("data-map-link", "")
    })
  }
  setDetailSource(detailPoints)

  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    const placeActs  = actTargets.filter(t => t.placeIdx === placeIdx)
    const placeStays = stayTargets.filter(t => t.placeIdx === placeIdx)
    detailPoints = await geocodeActivities(placeActs, epoch, detailPoints)
    if (epoch !== state.geocodeEpoch) return
    detailPoints = await geocodeStays(placeStays, epoch, detailPoints)
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
  if (window.innerWidth < MOBILE_MAX_W) {
    const raw    = document.documentElement.style.getPropertyValue("--sheet-h")
    const sheetH = raw ? parseFloat(raw) : window.innerHeight * 0.5
    return { top: inner, right: inner, bottom: sheetH + inner, left: inner }
  }
  return { top: inner, right: inner, bottom: inner, left: 332 + inner }
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
    state.map.setPadding(mapPadding())
    state.map.fitBounds(bounds, { maxZoom: 10 })
    applyZoomClass()
  }
}

export function setDetailSource(points: DetailPoint[]): void {
  state.detailMarkers.forEach(m => m.remove()); state.detailMarkers = []

  for (const p of points) {
    const el = document.createElement("div")
    el.className = `detail-marker detail-marker--${p.pinType ?? "activity"}`
    if (p.pinType === "stay")     el.innerHTML = ICONS["stay"]
    else if (p.pinType === "hub") el.innerHTML = ICONS[p.mode ?? ""] ?? ICONS["transport"]
    else if (p.actLabel)          el.innerHTML = `<span class="detail-marker-label">${escape(p.actLabel)}</span>`
    const popup = new maplibregl.Popup({ closeButton: false, offset: 14, className: "detail-popup" })
      .setHTML(popupHtml(p))
    el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(state.map))
    el.addEventListener("mouseleave", () => popup.remove())
    el.dataset.name = p.name
    if (p.placeIdx !== undefined) el.dataset.placeIdx = String(p.placeIdx)
    const type = p.pinType === "stay" ? "stay" : p.pinType === "hub" ? "hub" : "activity"
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

  const focusedDetailName = state.focusedActName ?? state.focusedStayName ?? state.focusedHubName
  if (focusedDetailName !== null) {
    for (const m of state.detailMarkers) {
      if (m.getElement().dataset.name === focusedDetailName) { m.getElement().classList.add("--focused"); break }
    }
  }
}

/**
 * Show/hide detail markers based on the current navigation level:
 *   - trip level (activePlaceIndex === null): show transport hub markers only
 *   - place level (activePlaceIndex = N):     show activity/stay markers for that place only
 */
export function applyDetailMarkerFilter(): void {
  const placeIdx = state.activePlaceIndex
  for (const m of state.detailMarkers) {
    const el = m.getElement()
    const isHub = el.classList.contains("detail-marker--hub")
    if (placeIdx === null) {
      el.style.display = isHub ? "" : "none"
    } else {
      const mp = el.dataset.placeIdx !== undefined ? parseInt(el.dataset.placeIdx) : null
      el.style.display = !isHub && mp === placeIdx ? "" : "none"
    }
  }
}

export function setMapStatus(text: string): void { mapStatusEl.textContent = text }

export function fitAllPlaces(): void {
  if (!state.mapReady || !state.placeMarkers.length) return
  const bounds = new maplibregl.LngLatBounds()
  state.placeMarkers.forEach((m: any) => bounds.extend(m.getLngLat()))
  state.map.setPadding(mapPadding())
  state.map.fitBounds(bounds, { maxZoom: 10 })
}

export function fitTransportHubs(
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

  // Reject a hub geocode if it's implausibly far from its neighbouring place
  // (~500km tolerance — catches Nominatim returning a wrong city/country).
  function sanityCheck(
    hub: { lat: number; lng: number } | undefined,
    ref: { lat: number; lng: number } | undefined,
  ): { lat: number; lng: number } | undefined {
    if (!hub) return undefined
    if (!ref)  return hub
    return (Math.abs(hub.lat - ref.lat) < 5 && Math.abs(hub.lng - ref.lng) < 7) ? hub : undefined
  }

  const fromGeo = sanityCheck(fromName ? state.geoIndex.hubs.get(fromName) : undefined, fromPlace) ?? fromPlace
  const toGeo   = sanityCheck(toName   ? state.geoIndex.hubs.get(toName)   : undefined, toPlace)   ?? toPlace

  if (fromGeo && toGeo) {
    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([fromGeo.lng, fromGeo.lat])
    bounds.extend([toGeo.lng,   toGeo.lat])
    state.map.setPadding(mapPadding())
    state.map.fitBounds(bounds, { maxZoom: 10 })
  } else {
    // One or both place geocodes not yet available (geocoding still in progress).
    // Fall back to the trip overview fit so the map stays coherent.
    fitAllPlaces()
  }
}
