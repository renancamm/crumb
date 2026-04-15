/**
 * HTML Renderer
 *
 * Two exports for different use cases:
 *
 *   renderItineraryBody(doc) — pure content HTML, no shell, no CSS, no JS.
 *     Used by the browser bundle for live re-rendering after edits.
 *
 *   renderHtml(doc, options) — complete self-contained mini-app HTML.
 *     Map + itinerary panel + app bar (Open / Share / Reference).
 *     Used by the CLI to produce the final output file.
 *
 * HtmlRenderer is the reference implementation of the CrumbRenderer plugin
 * interface — it shows third-party renderer authors what the contract looks like.
 */

import type { MetadataItem, TripMeta } from "../types/primitives"
import type {
  Activity,
  ActivityGroup,
  ActivityItem,
  CrumbDocument,
  Place,
  ResolvedDuration,
  ResolvedGeolocation,
  ResolvedMoment,
  Stay,
  TransportLeg,
  UngroupedActivities,
} from "../types/resolved"
import { CSS } from "./css"
import { ICON_STAY, modeIconSvg } from "./icons"
import {
  escape,
  formatDuration,
  formatGroupDate,
  formatMoment,
  formatMomentDate,
  formatMomentTime,
  formatMode,
} from "./format"
import type { CrumbRenderer, RenderContext } from "./types"

// ─── AppOptions ───────────────────────────────────────────────────────────────

export interface AppOptions {
  /** Original YAML source — embedded for the Share panel and Open textarea. */
  source: string
  /** Example files to populate the Open dropdown. filename → YAML content. */
  examples: Record<string, string>
  /** Esbuild browser bundle output (parse + renderItineraryBody). */
  parserBundle: string
  /** CRUMB_SPEC.md content for the "Download spec for AI" button. Optional. */
  specContent?: string
}

// ─── Pure content render ──────────────────────────────────────────────────────

/**
 * Render only the itinerary HTML body — no wrapping shell, no CSS, no JS.
 * Injected into .preview-body by the browser JS when live re-rendering.
 */
export function renderItineraryBody(doc: CrumbDocument): string {
  const parts: string[] = []

  if (doc.trip) {
    parts.push(renderTripHeader(doc.trip))
  }

  parts.push('<div class="itinerary">')
  let placeIndex = 0
  for (const item of doc.itinerary) {
    if (item.type === "place") {
      parts.push(renderPlace(item, ++placeIndex))
    } else {
      parts.push(renderTransportLeg(item))
    }
  }
  parts.push("</div>")

  return parts.join("\n")
}

// ─── Full mini-app render ─────────────────────────────────────────────────────

/**
 * Render a complete self-contained HTML file:
 *   — fullscreen map (MapLibre GL + Nominatim geocoding)
 *   — floating itinerary panel
 *   — app bar: Open / Share / Reference
 *   — live YAML editor (activated via Open)
 */
export function renderHtml(doc: CrumbDocument, options: AppOptions): string {
  const title       = escape(doc.trip?.name ?? "Itinerary")
  const body        = renderItineraryBody(doc)
  const docJson     = JSON.stringify(doc)
  const sourceJson  = JSON.stringify(options.source)
  const examplesJson= JSON.stringify(options.examples)
  const specJson    = JSON.stringify(options.specContent ?? "")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <style>${CSS}</style>
</head>
<body>

  <!-- Map fills the entire viewport -->
  <div id="map"></div>

  <!-- Floating itinerary panel -->
  <div class="panel">

    <!-- App bar -->
    <div class="appbar">
      <span class="appbar-brand">crumb</span>
      <button class="appbar-btn" id="load-btn">Load</button>
      <button class="appbar-btn" id="edit-btn">Edit</button>
      <button class="appbar-btn" id="ref-btn">Generate</button>
    </div>

    <!-- Panel body: preview + split handle + editor -->
    <div class="panel-body">

      <!-- Preview (always visible) -->
      <div class="preview-scroll">
        <div id="preview-body" class="preview-body">${body}</div>
      </div>

      <!-- Drag handle (shown when editor is open) -->
      <div id="split-handle" class="split-handle" style="display:none"></div>

      <!-- Editor section (shown when editor is open) -->
      <div id="view-editor" class="editor-section" style="display:none">
        <div class="editor-section-header">
          <span class="editor-section-label">Editor</span>
          <button class="editor-close-btn" id="editor-close">×</button>
        </div>
        <div id="editor-error-bar" class="editor-error-bar" style="display:none"></div>
        <textarea
          id="editor"
          class="editor-textarea"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          autocomplete="off"
          placeholder="Paste or type a .crumb document…"
        ></textarea>
      </div>

    </div>

  </div>

  <!-- Load modal -->
  <div class="modal-overlay" id="load-modal">
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">Load crumb</span>
        <button class="modal-close" id="load-modal-close">×</button>
      </div>
      <div class="modal-body">
        <textarea
          id="load-textarea"
          class="load-textarea"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          autocomplete="off"
          placeholder="Paste a .crumb document here…"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="action-btn primary" id="load-confirm">Load</button>
        <button class="action-btn" id="load-cancel">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Reference modal -->
  <div class="modal-overlay" id="ref-modal">
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">Generate with AI</span>
        <button class="modal-close" id="ref-close">×</button>
      </div>
      <div class="modal-body">
        <p class="ref-intro">Download the Crumb spec and upload it to an AI assistant. Then describe your trip — the AI will generate a <code>.crumb</code> document you can paste into Load.</p>
        <div class="ref-prompt-block">
          <div class="ref-prompt-label">Sample prompt</div>
          <div class="ref-prompt-text">Plan a 2-week trip to Japan for two people in October. Include Tokyo (5 nights), Kyoto (4 nights), and Osaka (3 nights). Add shinkansen legs between cities. Include must-do activities with morning/afternoon timings. Output as a valid .crumb document.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="action-btn primary" id="dl-spec-btn">Download spec</button>
        <button class="action-btn" id="ref-close2">Close</button>
      </div>
    </div>
  </div>

  <!-- Geocoding status chip -->
  <div id="map-status" class="map-status-chip"></div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>${options.parserBundle}</script>
  <script>
    // ── Embedded data ─────────────────────────────────────────────────────────
    const SOURCE   = ${sourceJson}
    const SPEC     = ${specJson}
    let   DATA     = ${docJson}   // pre-parsed document (for initial map render)

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const editorEl    = document.getElementById("editor")
    const previewEl   = document.getElementById("preview-body")
    const mapStatusEl = document.getElementById("map-status")
    const viewEditor  = document.getElementById("view-editor")
    const splitHandle = document.getElementById("split-handle")
    const errorBar    = document.getElementById("editor-error-bar")

    // ── Color palette (mirrors --crumb-* CSS tokens) ──────────────────────────
    const COLORS = {
      place:    "#2563eb",  // --crumb-blue
      stay:     "#93c5fd",  // --crumb-blue-mid
      hub:      "#bfdbfe",  // --crumb-blue-faint
      must:     "#ea580c",  // --crumb-orange
      activity: "#fdba74",  // --crumb-orange-mid
      route:    "#bfdbfe",  // --crumb-blue-faint
    }

    // ── Geo index (for sidebar → map fly-to) ─────────────────────────────────
    const geoIndex = { places: [null], activities: new Map() }

    // ── App bar: Load modal ───────────────────────────────────────────────────
    const loadModal    = document.getElementById("load-modal")
    const loadTextarea = document.getElementById("load-textarea")

    document.getElementById("load-btn").addEventListener("click", () => {
      loadTextarea.value = ""
      loadModal.classList.add("open")
      setTimeout(() => loadTextarea.focus(), 50)
    })

    function closeLoadModal() { loadModal.classList.remove("open") }
    document.getElementById("load-modal-close").addEventListener("click", closeLoadModal)
    document.getElementById("load-cancel").addEventListener("click",      closeLoadModal)
    loadModal.addEventListener("click", e => { if (e.target === loadModal) closeLoadModal() })

    document.getElementById("load-confirm").addEventListener("click", () => {
      const src = loadTextarea.value.trim()
      if (!src) return
      editorEl.value = src
      closeLoadModal()
      render()
    })

    // ── App bar: Edit (split-screen) ──────────────────────────────────────────
    const editBtn = document.getElementById("edit-btn")
    const EDITOR_DEFAULT_H = 260

    function openEditor() {
      if (editorEl.value === "") editorEl.value = SOURCE
      viewEditor.style.display = "flex"
      viewEditor.style.height  = EDITOR_DEFAULT_H + "px"
      splitHandle.style.display = ""
      editBtn.classList.add("active")
      editorEl.focus()
    }

    function closeEditor() {
      viewEditor.style.display  = "none"
      splitHandle.style.display = "none"
      editBtn.classList.remove("active")
      clearEditorError()
    }

    editBtn.addEventListener("click", () => {
      viewEditor.style.display === "none" ? openEditor() : closeEditor()
    })
    document.getElementById("editor-close").addEventListener("click", closeEditor)

    // ── Split handle drag ─────────────────────────────────────────────────────
    let dragging = false, dragStartY = 0, dragStartH = 0
    const panelBodyEl = document.querySelector(".panel-body")

    splitHandle.addEventListener("mousedown", e => {
      dragging   = true
      dragStartY = e.clientY
      dragStartH = viewEditor.offsetHeight
      splitHandle.classList.add("dragging")
      document.body.style.cursor     = "ns-resize"
      document.body.style.userSelect = "none"
      e.preventDefault()
    })
    document.addEventListener("mousemove", e => {
      if (!dragging) return
      const delta = dragStartY - e.clientY
      const min   = 80
      const max   = panelBodyEl.offsetHeight - 80
      viewEditor.style.height = Math.max(min, Math.min(max, dragStartH + delta)) + "px"
    })
    document.addEventListener("mouseup", () => {
      if (!dragging) return
      dragging = false
      splitHandle.classList.remove("dragging")
      document.body.style.cursor     = ""
      document.body.style.userSelect = ""
    })

    // ── App bar: Reference modal ──────────────────────────────────────────────
    const refModal = document.getElementById("ref-modal")

    document.getElementById("ref-btn").addEventListener("click", () => refModal.classList.add("open"))

    function closeRef() { refModal.classList.remove("open") }
    document.getElementById("ref-close").addEventListener("click",  closeRef)
    document.getElementById("ref-close2").addEventListener("click", closeRef)
    refModal.addEventListener("click", e => { if (e.target === refModal) closeRef() })

    document.getElementById("dl-spec-btn").addEventListener("click", () => {
      if (!SPEC) return
      const blob = new Blob([SPEC], { type: "text/markdown" })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "CRUMB_SPEC.md"; a.click()
      URL.revokeObjectURL(url)
    })

    // ── MapLibre GL ───────────────────────────────────────────────────────────
    const map = new maplibregl.Map({
      container: "map",
      style:     "https://tiles.openfreemap.org/styles/liberty",
      center:    [10, 30],
      zoom:      2,
    })

    let mapReady   = false
    let pendingDoc = null
    const detailPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8,  className: "detail-popup" })
    const placePopup  = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 18, className: "place-popup"  })

    map.on("load", () => {
      map.addSource("route",   { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addSource("places",  { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addSource("details", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 11 })

      // Data-driven color: blue family for stays/hubs, orange family for activities
      const pinColor = ["case",
        ["==", ["get", "pinType"], "stay"], COLORS.stay,
        ["==", ["get", "pinType"], "hub"],  COLORS.hub,
        ["==", ["get", "pinType"], "must"], COLORS.must,
        COLORS.activity,  // activity + maybe → orange-mid
      ]

      map.addLayer({ id: "route-line", type: "line", source: "route",
        paint: { "line-color": COLORS.route, "line-width": 2, "line-opacity": 0.5, "line-dasharray": [2, 3] } })

      // Activity clusters (orange family)
      map.addLayer({ id: "detail-clusters", type: "circle", source: "details",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": COLORS.activity,
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 20, 22],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": COLORS.must,
        } })
      map.addLayer({ id: "detail-cluster-count", type: "symbol", source: "details",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
        paint: { "text-color": COLORS.must } })

      // Place circles (strong blue, always visible)
      map.addLayer({ id: "place-circles", type: "circle", source: "places",
        paint: { "circle-color": COLORS.place, "circle-radius": 15, "circle-stroke-width": 3, "circle-stroke-color": "#fff" } })

      // Activity / stay / hub dots — appear at zoom 9, sized by zoom
      map.addLayer({ id: "detail-dots", type: "circle", source: "details",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": pinColor,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 10, 6],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
          "circle-opacity": ["step", ["zoom"], 0, 9,
            ["case", ["==", ["get", "pinType"], "maybe"], 0.6, 1.0]
          ],
        } })

      // Within-place activity numbers — appear at zoom 13
      map.addLayer({ id: "detail-numbers", type: "symbol", source: "details",
        filter: ["all", ["!", ["has", "point_count"]], ["has", "placeActIdx"]],
        layout: { "text-field": ["to-string", ["get", "placeActIdx"]], "text-font": ["Noto Sans Bold"], "text-size": 9, "text-allow-overlap": true },
        paint: { "text-color": "#fff", "text-opacity": ["step", ["zoom"], 0, 13, 1] } })

      // Must-activity name labels — appear at zoom 14
      map.addLayer({ id: "detail-labels", type: "symbol", source: "details",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "pinType"], "must"]],
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top", "text-optional": true },
        paint: { "text-color": COLORS.must, "text-halo-color": "#fff", "text-halo-width": 1.5, "text-opacity": ["step", ["zoom"], 0, 14, 1] } })

      // Place numbers (always visible)
      map.addLayer({ id: "place-numbers", type: "symbol", source: "places",
        layout: { "text-field": ["to-string", ["get", "idx"]], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true },
        paint: { "text-color": "#fff" } })

      function popupHtml(title, sub) {
        return sub
          ? \`<span class="popup-title">\${escHtml(title)}</span><br><span class="popup-sub">\${escHtml(sub)}</span>\`
          : \`<span class="popup-title">\${escHtml(title)}</span>\`
      }

      map.on("mouseenter", "detail-dots", e => {
        map.getCanvas().style.cursor = "pointer"
        const { name, subtitle } = e.features[0].properties
        const coords = e.features[0].geometry.coordinates.slice()
        detailPopup.setLngLat(coords).setHTML(popupHtml(name, subtitle)).addTo(map)
      })
      map.on("mouseleave", "detail-dots", () => { map.getCanvas().style.cursor = ""; detailPopup.remove() })
      map.on("mouseenter", "place-circles", e => {
        map.getCanvas().style.cursor = "pointer"
        const { name, arrives } = e.features[0].properties
        const coords = e.features[0].geometry.coordinates.slice()
        placePopup.setLngLat(coords).setHTML(popupHtml(name, arrives)).addTo(map)
      })
      map.on("mouseleave", "place-circles", () => { map.getCanvas().style.cursor = ""; placePopup.remove() })

      previewEl.addEventListener("click", e => {
        const actEl = e.target.closest("[data-act-name]")
        if (actEl) {
          const geo = geoIndex.activities.get(actEl.dataset.actName)
          if (geo) { map.flyTo({ center: [geo.lng, geo.lat], zoom: 15, duration: 800 }); return }
        }
        const placeEl = e.target.closest("[data-place-index]")
        if (placeEl) {
          const geo = geoIndex.places[parseInt(placeEl.dataset.placeIndex, 10)]
          if (geo) map.flyTo({ center: [geo.lng, geo.lat], zoom: 12, duration: 800 })
        }
      })

      mapReady = true
      if (pendingDoc) { updateMap(pendingDoc); pendingDoc = null }
    })

    // ── Geocoding ─────────────────────────────────────────────────────────────
    const GEO_CACHE_PREFIX = "crumb-geo:"
    let geoQueue = Promise.resolve()
    let geocodeEpoch = 0

    function cachedGeo(name) {
      try { const r = localStorage.getItem(GEO_CACHE_PREFIX + name.toLowerCase()); return r ? JSON.parse(r) : null } catch { return null }
    }
    function cacheGeo(name, result) {
      try { localStorage.setItem(GEO_CACHE_PREFIX + name.toLowerCase(), JSON.stringify(result)) } catch {}
    }
    function fetchGeo(name) {
      const promise = geoQueue.then(() => new Promise(resolve => {
        fetch("https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ q: name, format: "json", limit: "1", "accept-language": "en" }))
          .then(r => r.json()).then(data => {
            const result = data?.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
            if (result) cacheGeo(name, result)
            setTimeout(() => resolve(result), 1100)
          }).catch(() => setTimeout(() => resolve(null), 1100))
      }))
      geoQueue = promise.then(() => {})
      return promise
    }
    async function resolveGeo(place) {
      if (place.location) {
        if (place.location.geocodingDisabled) return null
        if (place.location.lat != null && place.location.lng != null) return { lat: place.location.lat, lng: place.location.lng }
        const label = place.location.label
        if (label && label !== "none") { const c = cachedGeo(label); return c ?? fetchGeo(label) }
      }
      const q = place.query ?? place.name
      return cachedGeo(q) ?? fetchGeo(q)
    }

    // ── Map rendering ─────────────────────────────────────────────────────────
    async function updateMap(doc) {
      if (!mapReady) { pendingDoc = doc; return }
      const epoch  = ++geocodeEpoch
      const places = doc.itinerary.filter(item => item.type === "place")
      geoIndex.places     = [null]
      geoIndex.activities = new Map()

      if (!places.length) {
        map.getSource("route").setData({ type: "FeatureCollection", features: [] })
        map.getSource("places").setData({ type: "FeatureCollection", features: [] })
        map.getSource("details").setData({ type: "FeatureCollection", features: [] })
        setMapStatus(""); return
      }

      const needsFetch = places.filter(p => !p.location?.geocodingDisabled && p.location?.lat == null && !cachedGeo(p.location?.label || p.name))
      if (needsFetch.length) setMapStatus("geocoding…")

      const resolved = []
      const resolvedPlaceCoords = new Map()
      let done = 0
      for (const place of places) {
        if (epoch !== geocodeEpoch) return
        const geo = await resolveGeo(place)
        done++
        if (needsFetch.length) setMapStatus(\`geocoding \${done}/\${places.length}…\`)
        if (geo) { resolved.push({ name: place.name, lat: geo.lat, lng: geo.lng, arrives: place.arrives?.label ?? null }); resolvedPlaceCoords.set(place.name, geo) }
        geoIndex.places.push(geo ?? null)
      }
      if (epoch !== geocodeEpoch) return
      drawPlaceMarkers(resolved)
      setMapStatus("")

      let detailPoints = collectTransitHubPoints(doc, resolvedPlaceCoords)
      setDetailSource(detailPoints)

      const actTargets = collectActivityGeoTargets(doc)
      function actPoint(t, geo) {
        return { name: t.name, lat: geo.lat, lng: geo.lng, pinType: t.priority === "must" ? "must" : t.priority === "maybe" ? "maybe" : "activity", subtitle: t.priority === "must" ? "must do" : null, placeIdx: t.placeIdx, placeActIdx: t.placeActIdx }
      }
      for (const t of actTargets) {
        const loc = t.location
        if (loc?.lat != null && loc?.lng != null) {
          const geo = { lat: loc.lat, lng: loc.lng }
          geoIndex.activities.set(t.name, geo)
          detailPoints = [...detailPoints, actPoint(t, geo)]
        }
      }
      if (detailPoints.length) setDetailSource(detailPoints)

      for (const t of actTargets) {
        if (t.location?.lat != null) continue
        if (epoch !== geocodeEpoch) return
        const geo = await resolveGeo(t)
        if (epoch !== geocodeEpoch) return
        if (geo) { geoIndex.activities.set(t.name, geo); detailPoints = [...detailPoints, actPoint(t, geo)]; setDetailSource(detailPoints) }
      }

      const stayTargets = collectStayGeoTargets(doc)
      let staysGeocoded = 0
      for (const t of stayTargets) {
        if (epoch !== geocodeEpoch) return
        if (!t.hasCoords && staysGeocoded >= 3) continue
        const geo = await resolveGeo(t)
        if (epoch !== geocodeEpoch) return
        if (!t.hasCoords) staysGeocoded++
        if (geo) { detailPoints = [...detailPoints, { name: t.name, lat: geo.lat, lng: geo.lng, pinType: "stay", subtitle: t.checkin ?? null, placeIdx: t.placeIdx }]; setDetailSource(detailPoints) }
      }
    }

    function drawPlaceMarkers(points) {
      map.getSource("route").setData({ type: "FeatureCollection", features: points.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(p => [p.lng, p.lat]) } }] : [] })
      map.getSource("places").setData({ type: "FeatureCollection",
        features: points.map((p, i) => ({ type: "Feature", properties: { name: p.name, idx: i + 1, arrives: p.arrives ?? null }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) })
      if (points.length) {
        const bounds = new maplibregl.LngLatBounds()
        points.forEach(p => bounds.extend([p.lng, p.lat]))
        map.fitBounds(bounds, { padding: 60, maxZoom: 10 })
      }
    }
    function setDetailSource(points) {
      map.getSource("details").setData({ type: "FeatureCollection",
        features: points.map(p => {
          const props = { name: p.name, pinType: p.pinType ?? "activity", subtitle: p.subtitle ?? null, placeIdx: p.placeIdx ?? null }
          if (p.placeActIdx != null) props.placeActIdx = p.placeActIdx
          return { type: "Feature", properties: props, geometry: { type: "Point", coordinates: [p.lng, p.lat] } }
        }) })
    }
    function collectActivityGeoTargets(doc) {
      const targets = []; let placeIdx = 0
      for (const item of doc.itinerary) {
        if (item.type !== "place") continue; placeIdx++
        let placeActIdx = 0
        for (const group of (item.activities ?? []))
          for (const act of (group.items ?? []))
            if (!act.location?.geocodingDisabled)
              targets.push({ name: act.name, location: act.location ?? null, query: act.location ? null : \`\${act.name}, \${item.name}\`, priority: act.priority ?? null, placeIdx, placeActIdx: ++placeActIdx })
      }
      return targets
    }
    function collectTransitHubPoints(doc, resolvedPlaceCoords) {
      const skip = new Set(["walk", "bike"]); const items = doc.itinerary; const points = []
      function nearPlace(pt, name) { const g = resolvedPlaceCoords.get(name); return g && Math.abs(pt.lat - g.lat) < 0.8 && Math.abs(pt.lng - g.lng) < 1.2 }
      for (let i = 0; i < items.length; i++) {
        const item = items[i]; if (item.type === "place" || skip.has(item.mode)) continue
        const prev = [...items.slice(0, i)].reverse().find(x => x.type === "place")
        const next = items.slice(i + 1).find(x => x.type === "place")
        if (item.from?.lat != null && item.from?.lng != null) {
          const pt = { lat: item.from.lat, lng: item.from.lng }
          if (!nearPlace(pt, prev?.name) && !nearPlace(pt, next?.name))
            points.push({ name: item.from.label, lat: pt.lat, lng: pt.lng, pinType: "hub", subtitle: item.mode + " hub", placeIdx: null })
        }
        if (item.to?.lat != null && item.to?.lng != null) {
          const pt = { lat: item.to.lat, lng: item.to.lng }
          if (!nearPlace(pt, prev?.name) && !nearPlace(pt, next?.name))
            points.push({ name: item.to.label, lat: pt.lat, lng: pt.lng, pinType: "hub", subtitle: item.mode + " hub", placeIdx: null })
        }
      }
      return points
    }
    function collectStayGeoTargets(doc) {
      const targets = []; let placeIdx = 0
      for (const item of doc.itinerary) {
        if (item.type !== "place") continue; placeIdx++
        for (const stay of (item.stay ?? [])) {
          if (stay.location?.geocodingDisabled) continue
          const hasCoords = stay.location?.lat != null
          targets.push({ name: hasCoords ? stay.name : \`\${stay.name}, \${item.name}\`, location: stay.location ?? null, hasCoords, checkin: stay.arrives ? \`check-in \${stay.arrives.label}\` : null, placeIdx })
        }
      }
      return targets
    }

    function setMapStatus(text) { mapStatusEl.textContent = text }
    function escHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") }

    // ── Live editor ───────────────────────────────────────────────────────────
    function setEditorError(msg) {
      errorBar.textContent = msg
      errorBar.style.display = msg ? "" : "none"
    }
    function clearEditorError() { setEditorError("") }

    let debounce
    function render() {
      const src = editorEl.value.trim()
      if (!src) {
        previewEl.innerHTML = '<div class="preview-empty">Start typing a .crumb document…</div>'
        clearEditorError()
        if (mapReady) {
          map.getSource("route").setData({ type: "FeatureCollection", features: [] })
          map.getSource("places").setData({ type: "FeatureCollection", features: [] })
          map.getSource("details").setData({ type: "FeatureCollection", features: [] })
        }
        setMapStatus(""); return
      }
      try {
        const doc = Crumb.parse(src)
        DATA = doc
        previewEl.innerHTML = Crumb.renderItineraryBody(doc)
        clearEditorError()
        updateMap(doc)
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).split("\\n")[0]
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

    // ── Boot: render initial map from embedded doc ────────────────────────────
    updateMap(DATA)
  </script>
</body>
</html>`
}

// ─── Structure builders ───────────────────────────────────────────────────────

function renderTripHeader(meta: TripMeta): string {
  const parts: string[] = [`<header class="trip-header">`]
  parts.push(`  <h1>${escape(meta.name ?? "Itinerary")}</h1>`)

  const meta2: string[] = []
  if (meta.author) meta2.push(`<span class="author">by ${escape(meta.author)}</span>`)
  if (meta.tags?.length) meta2.push(meta.tags.map(t => `<span class="tag">${escape(t)}</span>`).join(""))
  if (meta2.length) parts.push(`  <div class="trip-meta">${meta2.join(" ")}</div>`)
  if (meta.note)   parts.push(`  <p class="note">${renderMarkdown(meta.note)}</p>`)
  if (meta.info?.length) parts.push(renderInfoList(meta.info, "  "))

  parts.push("</header>")
  return parts.join("\n")
}

function renderPlace(place: Place, index = 0): string {
  const parts: string[] = []
  parts.push(`<div class="place" data-place-index="${index}">`)

  const badge = index > 0 ? `<span class="place-num">${index}</span>` : ""
  parts.push(`  <div class="place-header">`)
  parts.push(`    <h2 class="place-name">${badge}${escape(place.name)}</h2>`)

  const dateLine = renderPlaceDateLine(place)
  if (dateLine) parts.push(`    <div class="place-dates">${dateLine}</div>`)
  if (place.timezone) parts.push(`    <div class="place-tz">${escape(place.timezone)}</div>`)
  parts.push(`  </div>`)

  if (place.tags?.length)   parts.push(`  <div class="tags">${place.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (place.note)            parts.push(`  <div class="note">${renderMarkdown(place.note)}</div>`)
  if (place.stay?.length)    parts.push(renderStays(place.stay))
  if (place.info?.length)    parts.push(renderInfoList(place.info, "  "))

  if (place.activities.length > 0) {
    parts.push(`  <div class="activities">`)
    for (const actItem of place.activities) {
      parts.push(actItem.type === "ungrouped" ? renderUngrouped(actItem) : renderActivityGroup(actItem))
    }
    parts.push(`  </div>`)
  }

  parts.push(`</div>`)
  return parts.join("\n")
}

function renderPlaceDateLine(place: Place): string {
  const parts: string[] = []

  if (place.arrives && place.departs) {
    const a = formatMomentDate(place.arrives)
    const d = formatMomentDate(place.departs)
    if (a && d) parts.push(`${a} – ${d}`)
    else if (a) parts.push(`from ${a}`)
  } else if (place.arrives) {
    const a = formatMomentDate(place.arrives)
    if (a) parts.push(`arrives ${a}`)
  } else if (place.departs) {
    const d = formatMomentDate(place.departs)
    if (d) parts.push(`departs ${d}`)
  }

  if (place.duration) parts.push(formatDuration(place.duration))
  return parts.join(" · ")
}

function renderTransportLeg(leg: TransportLeg): string {
  const mode  = formatMode(leg.mode)
  const icon  = modeIconSvg(leg.mode)
  const from  = leg.from ? leg.from.label : null
  const to    = leg.to   ? leg.to.label   : null
  const route = from && to ? ` ${escape(from)} → ${escape(to)}` : from ? ` from ${escape(from)}` : to ? ` to ${escape(to)}` : ""

  const times: string[] = []
  if (leg.departs) { const t = formatMoment(leg.departs); if (t) times.push(`departs ${t}`) }
  if (leg.arrives) { const t = formatMoment(leg.arrives); if (t) times.push(`arrives ${t}`) }
  if (leg.duration) times.push(formatDuration(leg.duration))
  const timeLine = times.length ? `<span class="transport-times">${times.join(" · ")}</span>` : ""

  const infoLines = leg.info?.length
    ? `<div class="transport-info">${leg.info.map(i => `<span class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></span>`).join("")}</div>`
    : ""
  const noteStr = leg.note ? `<div class="transport-note">${renderMarkdown(leg.note)}</div>` : ""

  return `<div class="transport">
  <span class="transport-icon">${icon}</span>
  <div class="transport-main">
    <span class="transport-mode">${escape(mode)}</span>${route ? `<span class="transport-route">${route}</span>` : ""}
    ${timeLine}${infoLines}${noteStr}
  </div>
</div>`
}

function renderStays(stays: Stay[]): string {
  const parts = [`  <div class="stays">`]
  for (const stay of stays) {
    const dateParts: string[] = []
    if (stay.arrives) { const a = formatMoment(stay.arrives); if (a) dateParts.push(`check-in ${a}`) }
    if (stay.departs) { const d = formatMoment(stay.departs); if (d) dateParts.push(`check-out ${d}`) }
    const dateStr = dateParts.length ? ` <span class="stay-dates">${dateParts.join(" · ")}</span>` : ""
    const noteStr = stay.note ? ` <span class="stay-note">${renderMarkdown(stay.note)}</span>` : ""
    const infoStr = stay.info?.length
      ? ` <div class="stay-info">${stay.info.map(i => `<span class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></span>`).join("")}</div>`
      : ""
    parts.push(`    <div class="stay"><span class="stay-icon">${ICON_STAY}</span><div class="stay-content"><span class="stay-name">${escape(stay.name)}</span>${dateStr}${infoStr}${noteStr}</div></div>`)
  }
  parts.push(`  </div>`)
  return parts.join("\n")
}

function renderUngrouped(container: UngroupedActivities): string {
  return `    <ul class="activity-list ungrouped">${container.items.map(a => renderActivityItem(a)).join("\n")}</ul>`
}

function renderActivityGroup(group: ActivityGroup): string {
  const isPlan  = group.kind === "plan"
  const cls     = isPlan ? "activity-group plan-group" : "activity-group"
  const kind    = isPlan ? "Plan" : group.kind === "week" ? "Week" : "Day"
  const dateStr = !isPlan && group.time ? formatGroupDate(group.time) : null
  let headerText = group.title ?? kind
  if (dateStr) headerText += ` <span class="group-date">— ${escape(dateStr)}</span>`

  const header = isPlan && group.title
    ? `<div class="group-header plan-header">${escape(group.title)}</div>`
    : `<div class="group-header">${headerText}</div>`

  const items = group.items.length
    ? `<ul class="activity-list">${group.items.map(a => renderActivityItem(a)).join("\n")}</ul>`
    : ""

  return `    <div class="${cls}">\n      ${header}\n      ${items}\n    </div>`
}

function renderActivityItem(act: Activity): string {
  const dot = act.priority === "must"  ? `<span class="dot must" title="Must do">●</span>`
            : act.priority === "maybe" ? `<span class="dot maybe" title="Maybe">●</span>`
            : ""

  const nameParts = [`<span class="act-name">${escape(act.name)}</span>`]
  if (act.time)     { const t = formatMomentTime(act.time); if (t) nameParts.push(`<span class="act-time">${escape(t)}</span>`) }
  if (act.duration) nameParts.push(`<span class="act-duration">${escape(formatDuration(act.duration))}</span>`)
  if (act.tags?.length) nameParts.push(act.tags.map(t => `<span class="tag small">${escape(t)}</span>`).join(""))
  if (act.note)     nameParts.push(`<div class="act-note">${renderMarkdown(act.note)}</div>`)
  if (act.info?.length) nameParts.push(`<div class="act-info">${act.info.map(i => `<span class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></span>`).join("")}</div>`)

  const geoAttr = act.location && !act.location.geocodingDisabled
    ? ` data-act-name="${escape(act.name)}"`
    : ""
  return `<li class="activity-item"${geoAttr}>${dot ? dot + " " : ""}${nameParts.join(" ")}</li>`
}

function renderInfoList(info: MetadataItem[], indent: string): string {
  const items = info.map(i =>
    `${indent}  <div class="info-row"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`
  ).join("\n")
  return `${indent}<div class="info-list">\n${items}\n${indent}</div>`
}

function renderMarkdown(text: string): string {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
}

// ─── HtmlRenderer — reference implementation of CrumbRenderer ────────────────

/**
 * Reference implementation of the CrumbRenderer plugin interface.
 *
 * Shows third-party renderer authors what the contract looks like:
 * a single render() method that takes a document and context.
 *
 * Note: this produces the itinerary body only (no app shell).
 * For the full mini-app output, use renderHtml() directly.
 */
export class HtmlRenderer implements CrumbRenderer {
  render(doc: CrumbDocument, context: RenderContext): string {
    // The context provides formatting helpers (context.formatMoment, etc.).
    // This implementation delegates to renderItineraryBody() which uses
    // the same helpers internally via format.ts. A custom renderer would
    // call context.formatMoment() etc. instead of importing format.ts.
    return renderItineraryBody(doc)
  }
}
