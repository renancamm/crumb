/**
 * HTML Renderer
 *
 * Two exports for different use cases:
 *
 *   renderItineraryBody(doc) — pure content HTML, no shell, no CSS, no JS.
 *     Used by the browser bundle for live re-rendering after edits.
 *
 *   renderHtml(doc, options) — complete self-contained mini-app HTML.
 *     Split layout: editor panel (left, toggled) | sidebar list | map.
 *     Used by the CLI to produce the final output file.
 *
 * HtmlRenderer is the reference implementation of the CrumbRenderer plugin
 * interface — it shows third-party renderer authors what the contract looks like.
 */

import type { MetadataItem, TripMeta } from "../types/primitives"
import type {
  Activity,
  ActivityGroup,
  CrumbDocument,
  Place,
  Stay,
  TransportLeg,
  UngroupedActivities,
} from "../types/resolved"
import { CSS } from "./css"
import { GEO_SCRIPT } from "./geocoder"
import { ICON_STAY, ICON_PLANE, ICON_TRAIN, ICON_BUS, ICON_CAR, ICON_SHIP, ICON_WALK, ICON_BIKE, ICON_ROUTE, ICON_GLOBE_OFF, modeIconSvg } from "./icons"
import {
  escape,
  formatDuration,
  formatGroupDate,
  formatMoment,
  formatMomentDate,
  formatMomentTime,
} from "./format"
import type { CrumbRenderer, RenderContext } from "./types"

// ─── AppOptions ───────────────────────────────────────────────────────────────

export interface AppOptions {
  /** Original YAML source — embedded for the editor. */
  source: string
  /** Example files (unused in this renderer, kept for API compat). */
  examples: Record<string, string>
  /** Esbuild browser bundle output (parse + renderItineraryBody). */
  parserBundle: string
  /** CRUMB_SPEC.md content for the "Download spec" button. Optional. */
  specContent?: string
}

// ─── Pure content render ──────────────────────────────────────────────────────

/**
 * Render only the itinerary HTML body — no wrapping shell, no CSS, no JS.
 * Injected into #list by the browser JS when live re-rendering.
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
 *   — sidebar with floating pill menu (New / Edit / Examples / Generate / About)
 *   — editor panel (left split, toggled via Edit) with live hot-reload
 *   — MapLibre GL map with Nominatim geocoding
 */
export function renderHtml(doc: CrumbDocument, options: AppOptions): string {
  const title          = "Crumb" + (doc.trip?.name ? " — " + escape(doc.trip.name) : "")
  const body           = renderItineraryBody(doc)
  const docJson        = JSON.stringify(doc)
  const sourceJson     = JSON.stringify(options.source)
  const specJson       = JSON.stringify(options.specContent ?? "")
  const examplesJson   = JSON.stringify(options.examples)
  const exampleItemsHtml = Object.keys(options.examples)
    .map(name => `<div class="menu-sub-item" data-example="${escape(name)}">${escape(name.replace(/\.crumb$/, ""))}</div>`)
    .join("\n        ")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <style>${CSS}</style>
</head>
<body>

  <!-- Main split view -->
  <div id="main">

    <!-- Editor panel (left split, hidden by default) -->
    <div id="editor-panel" style="display:none">
      <div class="editor-header">
        <button id="editor-close-btn" class="editor-close-btn">
          <svg class="editor-close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
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

    <!-- Sidebar -->
    <div id="sidebar">

      <!-- Pill header with dropdown menu -->
      <div class="sidebar-header">
        <div class="pill-wrap">
          <button class="pill-trigger" id="menu-trigger">
            <span class="pill-brand">crumb</span>
            <svg class="pill-chevron" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="dropdown-menu" id="main-menu">
            <div class="menu-item" id="menu-new">New</div>
            <div class="menu-item" id="menu-edit">Edit</div>
            <div class="menu-separator"></div>
            <div class="menu-item" id="menu-examples">
              Examples
              <svg class="menu-chevron-r" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
            <div class="menu-sub" id="examples-sub">
              ${exampleItemsHtml}
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" id="menu-generate">How to generate</div>
            <div class="menu-item" id="menu-about">About</div>
          </div>
        </div>
      </div>

      <!-- List view -->
      <div id="list-view">
        <div id="list">${body}</div>
      </div>


    </div>

    <!-- Map -->
    <div id="map"></div>

  </div>

  <!-- New itinerary modal -->
  <div class="modal-overlay" id="new-modal">
    <div class="modal-box">
      <button class="modal-x" id="new-close-x">×</button>
      <div class="modal-header">
        <div class="modal-title">New itinerary</div>
        <div class="modal-description">Paste a <code>.crumb</code> document below to load it.</div>
      </div>
      <div class="modal-body">
        <textarea
          id="new-textarea"
          class="new-textarea"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          autocomplete="off"
          placeholder="Paste your .crumb YAML here…"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="action-btn" id="new-cancel">Cancel</button>
        <button class="action-btn primary" id="new-load">Load</button>
      </div>
    </div>
  </div>

  <!-- Generate with AI modal -->
  <div class="modal-overlay" id="generate-modal">
    <div class="modal-box">
      <button class="modal-x" id="generate-close-x">×</button>
      <div class="modal-header">
        <div class="modal-title">Generate with AI</div>
        <div class="modal-description">Download the Crumb spec, upload it to an AI assistant, then describe your trip.</div>
      </div>
      <div class="modal-body">
        <div class="ref-prompt-block">
          <div class="ref-prompt-label">Sample prompt</div>
          <div class="ref-prompt-text">Plan a 2-week trip to Japan for two people in October. Include Tokyo (5 nights), Kyoto (4 nights), and Osaka (3 nights). Add shinkansen legs between cities. Include must-do activities with morning/afternoon timings. Output as a valid .crumb document.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="action-btn" id="generate-close">Close</button>
        <button class="action-btn primary" id="dl-spec-btn">Download spec</button>
      </div>
    </div>
  </div>

  <!-- About modal -->
  <div class="modal-overlay" id="about-modal">
    <div class="modal-box">
      <button class="modal-x" id="about-close-x">×</button>
      <div class="modal-header">
        <div class="modal-title">About Crumb</div>
      </div>
      <div class="modal-body">
        <p class="ref-intro">Crumb is a plain-text, YAML-based format for travel itineraries designed to work naturally with AI assistants. It keeps trips human-readable while making it easy to collaborate with a language model to plan routes, fill in activities, timings, and notes — then render everything as an interactive map.</p>
      </div>
      <div class="modal-footer">
        <button class="action-btn primary" id="about-close-btn">Close</button>
      </div>
    </div>
  </div>

  <!-- Geocoding status chip -->
  <div id="map-status" class="map-status-chip"></div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>${options.parserBundle}</script>
  <script>${GEO_SCRIPT}</script>
  <script>
    // ── Embedded data ─────────────────────────────────────────────────────────
    const SOURCE   = ${sourceJson}
    const SPEC     = ${specJson}
    const EXAMPLES = ${examplesJson}
    let   DATA     = ${docJson}

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const editorEl    = document.getElementById("editor")
    const listEl      = document.getElementById("list")
    const mapStatusEl = document.getElementById("map-status")
    const editorPanel = document.getElementById("editor-panel")
    const errorBar    = document.getElementById("editor-error-bar")
    const newModal      = document.getElementById("new-modal")
    const newTextarea   = document.getElementById("new-textarea")
    const generateModal = document.getElementById("generate-modal")
    const aboutModal    = document.getElementById("about-modal")

    // ── Embedded icons ────────────────────────────────────────────────────────
    const ICONS = {
      stay:      ${JSON.stringify(ICON_STAY)},
      flight:    ${JSON.stringify(ICON_PLANE)},
      train:     ${JSON.stringify(ICON_TRAIN)},
      bus:       ${JSON.stringify(ICON_BUS)},
      car:       ${JSON.stringify(ICON_CAR)},
      ferry:     ${JSON.stringify(ICON_SHIP)},
      walk:      ${JSON.stringify(ICON_WALK)},
      bike:      ${JSON.stringify(ICON_BIKE)},
      transport: ${JSON.stringify(ICON_ROUTE)},
      globe_off: ${JSON.stringify(ICON_GLOBE_OFF)},
    }
    const GEO_FAIL_ICON = \`<span class="geo-no-loc">\${ICONS.globe_off}</span>\`

    // ── Color palette ─────────────────────────────────────────────────────────
    const COLORS = { route: "#18181b" }

    // ── Geo index (for list → map fly-to) ────────────────────────────────────
    const geoIndex = { places: [null], activities: new Map(), stays: new Map(), hubs: new Map() }

    // ── Focus state (list ↔ marker sync) ─────────────────────────────────────
    let focusedPlaceIdx = null
    let focusedActName  = null
    let focusedStayName = null
    let focusedHubName  = null

    function clearFocus() {
      focusedPlaceIdx = null; focusedActName = null; focusedStayName = null; focusedHubName = null
      document.querySelectorAll(".place.--focused").forEach(el => el.classList.remove("--focused"))
      document.querySelectorAll(".activity-item.--focused").forEach(el => el.classList.remove("--focused"))
      document.querySelectorAll(".stay.--focused").forEach(el => el.classList.remove("--focused"))
      placeMarkers.forEach(m => m.getElement().classList.remove("--focused"))
      detailMarkers.forEach(m => m.getElement().classList.remove("--focused"))
    }

    function focusPlace(placeIdx) {
      clearFocus(); focusedPlaceIdx = placeIdx
      const placeEl = document.querySelector(\`.place[data-place-index="\${placeIdx}"]\`)
      if (placeEl) { placeEl.classList.add("--focused"); placeEl.scrollIntoView({ block: "nearest", behavior: "smooth" }) }
      const marker = placeMarkers[placeIdx - 1]
      if (marker) marker.getElement().classList.add("--focused")
      const geo = geoIndex.places[placeIdx]
      if (geo) map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(map.getZoom(), 10), duration: 800 })
    }

    function focusActivity(actName) {
      clearFocus(); focusedActName = actName
      for (const item of listEl.querySelectorAll(".activity-item[data-act-name]")) {
        if (item.dataset.actName === actName) {
          item.classList.add("--focused"); item.scrollIntoView({ block: "nearest", behavior: "smooth" }); break
        }
      }
      for (const m of detailMarkers) {
        if (m.getElement().dataset.name === actName) { m.getElement().classList.add("--focused"); break }
      }
      const geo = geoIndex.activities.get(actName)
      if (geo) map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 })
    }

    function focusStay(stayName) {
      clearFocus(); focusedStayName = stayName
      const stayEl = [...listEl.querySelectorAll(".stay[data-stay-name]")].find(el => el.dataset.stayName === stayName)
      if (stayEl) { stayEl.classList.add("--focused"); stayEl.scrollIntoView({ block: "nearest", behavior: "smooth" }) }
      for (const m of detailMarkers) {
        if (m.getElement().dataset.name === stayName) { m.getElement().classList.add("--focused"); break }
      }
      const geo = geoIndex.stays.get(stayName)
      if (geo) map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 })
    }

    function focusHub(hubName) {
      clearFocus(); focusedHubName = hubName
      for (const m of detailMarkers) {
        if (m.getElement().dataset.name === hubName) { m.getElement().classList.add("--focused"); break }
      }
      const geo = geoIndex.hubs.get(hubName)
      if (geo) map.flyTo({ center: [geo.lng, geo.lat], zoom: Math.max(map.getZoom(), 12), duration: 800 })
    }

    function setPlaceLoading(placeIdx, loading) {
      const el = document.querySelector(\`.place[data-place-index="\${placeIdx}"] .place-num\`)
      if (el) el.classList.toggle("--loading", loading)
    }

    function setStayLoading(stayName, loading) {
      const stayEl = [...listEl.querySelectorAll(".stay[data-stay-name]")].find(el => el.dataset.stayName === stayName)
      if (stayEl) stayEl.querySelector(".stay-icon")?.classList.toggle("--loading", loading)
    }

    function setActLoading(actName, loading) {
      for (const item of listEl.querySelectorAll(".activity-item[data-act-name]")) {
        if (item.dataset.actName === actName) {
          const label = item.querySelector(".act-label")
          if (label) label.classList.toggle("--loading", loading)
          break
        }
      }
    }

    // ── Pill menu ─────────────────────────────────────────────────────────────
    const menuTrigger = document.getElementById("menu-trigger")
    const mainMenu    = document.getElementById("main-menu")

    function closeMenu() {
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

    // ── Menu → New ────────────────────────────────────────────────────────────
    document.getElementById("menu-new").addEventListener("click", () => {
      closeMenu()
      newModal.classList.add("open")
      setTimeout(() => newTextarea.focus(), 50)
    })

    function closeNewModal() { newModal.classList.remove("open"); newTextarea.value = "" }
    document.getElementById("new-close-x").addEventListener("click",  closeNewModal)
    document.getElementById("new-cancel").addEventListener("click",   closeNewModal)
    newModal.addEventListener("click", e => { if (e.target === newModal) closeNewModal() })
    document.getElementById("new-load").addEventListener("click", () => {
      const src = newTextarea.value.trim()
      if (!src) return
      editorEl.value = src
      render()
      closeEditor()
      closeNewModal()
    })

    // ── Menu → Edit ───────────────────────────────────────────────────────────
    document.getElementById("menu-edit").addEventListener("click", () => { closeMenu(); openEditor() })

    function openEditor() {
      if (editorEl.value === "") editorEl.value = SOURCE
      editorPanel.style.display = "flex"
      editorEl.focus()
    }

    function closeEditor() {
      editorPanel.style.display = "none"
    }

    document.getElementById("editor-close-btn").addEventListener("click", closeEditor)

    // ── Menu → Examples ───────────────────────────────────────────────────────
    document.getElementById("menu-examples").addEventListener("click", e => {
      e.stopPropagation()
      document.getElementById("examples-sub").classList.toggle("open")
      e.currentTarget.classList.toggle("open")
    })
    document.querySelectorAll("[data-example]").forEach(el => {
      el.addEventListener("click", () => {
        const src = EXAMPLES[el.dataset.example]
        if (!src) return
        editorEl.value = src
        render()
        closeEditor()
        closeMenu()
      })
    })

    // ── Menu → How to generate ────────────────────────────────────────────────
    document.getElementById("menu-generate").addEventListener("click", () => {
      closeMenu()
      generateModal.classList.add("open")
    })
    function closeGenerate() { generateModal.classList.remove("open") }
    document.getElementById("generate-close-x").addEventListener("click", closeGenerate)
    document.getElementById("generate-close").addEventListener("click",   closeGenerate)
    generateModal.addEventListener("click", e => { if (e.target === generateModal) closeGenerate() })

    document.getElementById("dl-spec-btn").addEventListener("click", () => {
      if (!SPEC) return
      const blob = new Blob([SPEC], { type: "text/markdown" })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "CRUMB_SPEC.md"; a.click()
      URL.revokeObjectURL(url)
    })

    // ── Menu → About ──────────────────────────────────────────────────────────
    document.getElementById("menu-about").addEventListener("click", () => {
      closeMenu()
      aboutModal.classList.add("open")
    })
    function closeAbout() { aboutModal.classList.remove("open") }
    document.getElementById("about-close-x").addEventListener("click",   closeAbout)
    document.getElementById("about-close-btn").addEventListener("click", closeAbout)
    aboutModal.addEventListener("click", e => { if (e.target === aboutModal) closeAbout() })

    // ── List click: focus on name/title click only ───────────────────────────
    listEl.addEventListener("click", e => {
      const link = e.target.closest("[data-map-link]")
      if (!link) return
      const act  = link.closest("[data-act-name]")
      const stay = link.closest("[data-stay-name]")
      if (act)                  { focusActivity(act.dataset.actName); return }
      if (stay)                 { focusStay(stay.dataset.stayName); return }
      if (link.dataset.hubName) { focusHub(link.dataset.hubName); return }
      const place = link.closest("[data-place-index]")
      if (place) { focusPlace(parseInt(place.dataset.placeIndex, 10)); return }
    })

    // ── MapLibre GL ───────────────────────────────────────────────────────────
    const map = new maplibregl.Map({
      container: "map",
      style:     "https://tiles.openfreemap.org/styles/liberty",
      center:    [10, 30],
      zoom:      2,
    })

    let mapReady      = false
    let pendingDoc    = null
    let placeMarkers  = []
    let detailMarkers = []

    function popupHtml(title, sub) {
      return sub
        ? \`<span class="popup-title">\${escHtml(title)}</span><br><span class="popup-sub">\${escHtml(sub)}</span>\`
        : \`<span class="popup-title">\${escHtml(title)}</span>\`
    }

    function applyZoomClass() {
      const z = map.getZoom()
      document.body.classList.toggle("map-zoom-medium", z >= 8)
      document.body.classList.toggle("map-zoom-close",  z >= 12)
    }
    map.on("zoom",    applyZoomClass)
    map.on("zoomend", applyZoomClass)

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } })

      // Route line
      map.addLayer({ id: "route-line", type: "line", source: "route",
        paint: { "line-color": COLORS.route, "line-width": 2, "line-opacity": ["step", ["zoom"], 0.5, 12, 0], "line-dasharray": [2, 2] } })

      mapReady = true
      if (pendingDoc) { updateMap(pendingDoc); pendingDoc = null }
    })

    // ── Geocoding epoch (functions provided by GEO_SCRIPT) ───────────────────
    let geocodeEpoch = 0

    // ── Map rendering ─────────────────────────────────────────────────────────
    async function updateMap(doc) {
      if (!mapReady) { pendingDoc = doc; return }
      const epoch  = ++geocodeEpoch
      document.querySelectorAll(".--loading").forEach(el => el.classList.remove("--loading"))
      const places = doc.itinerary.filter(item => item.type === "place")
      geoIndex.places     = [null]
      geoIndex.activities = new Map()
      geoIndex.stays      = new Map()
      geoIndex.hubs       = new Map()

      if (!places.length) {
        map.getSource("route").setData({ type: "FeatureCollection", features: [] })
        placeMarkers.forEach(m => m.remove());  placeMarkers = []
        detailMarkers.forEach(m => m.remove()); detailMarkers = []
        setMapStatus(""); return
      }

      const needsFetch = places.filter(p => !p.location?.geocodingDisabled && p.location?.lat == null && !cachedGeo(p.location?.label || p.name))
      const needsFetchSet = new Set(needsFetch)

      // Collect all targets early so we can show all spinners at once
      const actTargets  = collectActivityGeoTargets(doc)
      const stayTargets = collectStayGeoTargets(doc)

      // Show all pending spinners upfront before any geocoding starts
      for (const [i, place] of places.entries()) {
        if (needsFetchSet.has(place)) setPlaceLoading(i + 1, true)
      }
      for (const t of actTargets) {
        if (t.location?.lat != null) continue
        const actQ = t.query ?? t.name
        if (!cachedGeo(actQ)) setActLoading(t.name, true)
      }
      let staysMarked = 0
      for (const t of stayTargets) {
        if (t.hasCoords) continue
        if (staysMarked >= 3) break
        if (!cachedGeo(t.name)) setStayLoading(t.stayName, true)
        staysMarked++
      }
      if (needsFetch.length) setMapStatus("geocoding…")

      const resolved = []
      const resolvedPlaceCoords = new Map()
      const retryWithContext = []
      let done = 0

      // Pass 1: geocode each place independently
      for (const [i, place] of places.entries()) {
        if (epoch !== geocodeEpoch) return
        const geo = await resolveGeo(place)
        done++
        if (needsFetch.length) setMapStatus(\`geocoding \${done}/\${places.length}…\`)
        if (geo) {
          setPlaceLoading(i + 1, false)
          writeBackGeo(place, geo)
          resolved.push({ name: place.name, lat: geo.lat, lng: geo.lng, arrives: place.arrives?.label ?? null })
          resolvedPlaceCoords.set(place.name, geo)
        } else {
          retryWithContext.push({ place, i })
        }
        geoIndex.places.push(geo ?? null)
      }

      // Pass 2: retry failed places — spinner stays on from upfront marking
      for (const { place, i } of retryWithContext) {
        if (epoch !== geocodeEpoch) return
        const prev = places[i - 1]?.name
        const next = places[i + 1]?.name
        const neighbor = resolvedPlaceCoords.get(prev) ? prev
                       : resolvedPlaceCoords.get(next) ? next : null
        const q = neighbor ? place.name + ", " + neighbor : null
        const geo = q ? (cachedGeo(q) ?? await fetchGeo(q)) : null
        setPlaceLoading(i + 1, false)
        if (geo) {
          writeBackGeo(place, geo)
          resolved.push({ name: place.name, lat: geo.lat, lng: geo.lng, arrives: place.arrives?.label ?? null })
          resolvedPlaceCoords.set(place.name, geo)
        } else {
          const nameEl = document.querySelector(\`.place[data-place-index="\${i + 1}"] .place-name-text\`)
          if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
        }
        geoIndex.places[i + 1] = geo ?? null
      }

      if (epoch !== geocodeEpoch) return
      drawPlaceMarkers(resolved)
      setMapStatus("")

      let detailPoints = await geocodeTransportHubs(doc, resolvedPlaceCoords, () => epoch !== geocodeEpoch)
      for (const p of detailPoints) {
        if (p.pinType !== "hub") continue
        geoIndex.hubs.set(p.name, { lat: p.lat, lng: p.lng })
        listEl.querySelectorAll('.waypoint-name[data-hub-name]').forEach(el => {
          if (el.dataset.hubName === p.name) el.setAttribute('data-map-link', '')
        })
      }
      setDetailSource(detailPoints)

      function actPoint(t, geo) {
        return { name: t.name, lat: geo.lat, lng: geo.lng, pinType: t.priority === "must" ? "must" : t.priority === "maybe" ? "maybe" : "activity", subtitle: t.priority === "must" ? "must do" : null, placeIdx: t.placeIdx, actLabel: t.actLabel }
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
        setActLoading(t.name, false)
        if (epoch !== geocodeEpoch) return
        if (geo) { geoIndex.activities.set(t.name, geo); detailPoints = [...detailPoints, actPoint(t, geo)]; setDetailSource(detailPoints) }
        else {
          const item = [...listEl.querySelectorAll(".activity-item[data-act-name]")].find(el => el.dataset.actName === t.name)
          const nameEl = item?.querySelector(".act-name")
          if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
        }
      }

      let staysGeocoded = 0
      for (const t of stayTargets) {
        if (epoch !== geocodeEpoch) return
        if (!t.hasCoords && staysGeocoded >= 3) continue
        const geo = await resolveGeo(t)
        setStayLoading(t.stayName, false)
        if (epoch !== geocodeEpoch) return
        if (!t.hasCoords) staysGeocoded++
        if (geo) { geoIndex.stays.set(t.stayName, geo); detailPoints = [...detailPoints, { name: t.stayName, lat: geo.lat, lng: geo.lng, pinType: "stay", subtitle: t.checkin ?? null, placeIdx: t.placeIdx }]; setDetailSource(detailPoints) }
        else if (!t.hasCoords) {
          const stayEl = [...listEl.querySelectorAll(".stay[data-stay-name]")].find(el => el.dataset.stayName === t.stayName)
          const nameEl = stayEl?.querySelector(".stay-name")
          if (nameEl && !nameEl.querySelector(".geo-no-loc")) nameEl.insertAdjacentHTML("beforeend", GEO_FAIL_ICON)
        }
      }
    }

    function drawPlaceMarkers(points) {
      map.getSource("route").setData({ type: "FeatureCollection", features: points.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(p => [p.lng, p.lat]) } }] : [] })

      placeMarkers.forEach(m => m.remove()); placeMarkers = []

      for (const [i, p] of points.entries()) {
        const el = document.createElement("div")
        el.className = "place-marker"
        el.innerHTML = \`<span class="place-marker-num">\${i + 1}</span>\`
        const popup = new maplibregl.Popup({ closeButton: false, offset: 20, className: "place-popup" })
          .setHTML(popupHtml(p.name, p.arrives))
        el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(map))
        el.addEventListener("mouseleave", () => popup.remove())
        el.addEventListener("click", e => { e.stopPropagation(); focusPlace(i + 1) })
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat]).addTo(map)
        placeMarkers.push(marker)
      }

      if (focusedPlaceIdx !== null) {
        const m = placeMarkers[focusedPlaceIdx - 1]
        if (m) m.getElement().classList.add("--focused")
      }

      if (points.length) {
        const bounds = new maplibregl.LngLatBounds()
        points.forEach(p => bounds.extend([p.lng, p.lat]))
        map.fitBounds(bounds, { padding: 60, maxZoom: 10 })
        applyZoomClass()
      }
    }

    function setDetailSource(points) {
      detailMarkers.forEach(m => m.remove()); detailMarkers = []

      for (const p of points) {
        const el = document.createElement("div")
        el.className = \`detail-marker detail-marker--\${p.pinType ?? "activity"}\`
        if (p.pinType === "stay") el.innerHTML = ICONS.stay
        else if (p.pinType === "hub") el.innerHTML = ICONS[p.mode] ?? ICONS.transport
        else if (p.actLabel) el.innerHTML = \`<span class="detail-marker-label">\${escHtml(p.actLabel)}</span>\`
        const popup = new maplibregl.Popup({ closeButton: false, offset: 14, className: "detail-popup" })
          .setHTML(popupHtml(p.name, p.subtitle))
        el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(map))
        el.addEventListener("mouseleave", () => popup.remove())
        el.dataset.name = p.name
        if (p.pinType === "stay")
          el.addEventListener("click", e => { e.stopPropagation(); focusStay(p.name) })
        else if (p.pinType === "hub")
          el.addEventListener("click", e => { e.stopPropagation(); focusHub(p.name) })
        else
          el.addEventListener("click", e => { e.stopPropagation(); focusActivity(p.name) })
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat]).addTo(map)
        detailMarkers.push(marker)
      }

      const focusedDetailName = focusedActName ?? focusedStayName ?? focusedHubName
      if (focusedDetailName !== null) {
        for (const m of detailMarkers) {
          if (m.getElement().dataset.name === focusedDetailName) { m.getElement().classList.add("--focused"); break }
        }
      }
    }

    function collectActivityGeoTargets(doc) {
      const targets = []; let placeIdx = 0
      for (const item of doc.itinerary) {
        if (item.type !== "place") continue; placeIdx++
        let actIdx = 0
        for (const group of (item.activities ?? []))
          for (const act of (group.items ?? []))
            if (!act.location?.geocodingDisabled)
              targets.push({ name: act.name, location: act.location ?? null, query: act.location ? null : \`\${act.name}, \${item.name}\`, priority: act.priority ?? null, placeIdx, actLabel: String.fromCharCode(65 + actIdx++) })
      }
      return targets
    }

    function collectStayGeoTargets(doc) {
      const targets = []; let placeIdx = 0
      for (const item of doc.itinerary) {
        if (item.type !== "place") continue; placeIdx++
        for (const stay of (item.stay ?? [])) {
          if (stay.location?.geocodingDisabled) continue
          const hasCoords = stay.location?.lat != null
          targets.push({ name: hasCoords ? stay.name : \`\${stay.name}, \${item.name}\`, stayName: stay.name, location: stay.location ?? null, hasCoords, checkin: stay.arrives ? \`check-in \${stay.arrives.label}\` : null, placeIdx })
        }
      }
      return targets
    }

    function setMapStatus(text) { mapStatusEl.textContent = text }
    function escHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") }

    // ── Live editor ───────────────────────────────────────────────────────────
    function setEditorError(msg) { errorBar.textContent = msg; errorBar.style.display = msg ? "" : "none" }
    function clearEditorError() { setEditorError("") }

    let debounce
    function render() {
      const src = editorEl.value.trim()
      if (!src) {
        listEl.innerHTML = '<div class="list-empty">Start typing a .crumb document…</div>'
        clearEditorError()
        if (mapReady) {
          map.getSource("route").setData({ type: "FeatureCollection", features: [] })
          placeMarkers.forEach(m => m.remove());  placeMarkers = []
          detailMarkers.forEach(m => m.remove()); detailMarkers = []
        }
        setMapStatus(""); return
      }
      try {
        const doc = Crumb.parse(src)
        DATA = doc
        document.title = "Crumb" + (doc.trip?.name ? " — " + doc.trip.name : "")
        listEl.innerHTML = Crumb.renderItineraryBody(doc)
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

    // ── Boot ─────────────────────────────────────────────────────────────────
    updateMap(DATA)
  </script>
</body>
</html>`
}

// ─── Structure builders ───────────────────────────────────────────────────────

function renderTripHeader(meta: TripMeta): string {
  const parts: string[] = [`<header class="trip-header">`]
  parts.push(`  <h1>${escape(meta.name ?? "Itinerary")}</h1>`)

  if (meta.author) parts.push(`  <div class="trip-meta"><span class="author">by ${escape(meta.author)}</span></div>`)
  if (meta.tags?.length) parts.push(`  <div class="tags">${meta.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (meta.note)   parts.push(`  <p class="note">${renderMarkdown(meta.note)}</p>`)
  if (meta.info?.length) parts.push(renderInfoList(meta.info, "  "))

  parts.push("</header>")
  return parts.join("\n")
}

function renderPlace(place: Place, index = 0): string {
  const parts: string[] = []
  parts.push(`<div class="place" data-place-index="${index}">`)

  // Header: large number + place name/dates stacked
  parts.push(`  <div class="place-header">`)
  if (index > 0) parts.push(`    <span class="place-num">${index}</span>`)
  parts.push(`    <div class="place-heading">`)
  const placeGeoIcon = place.location?.geocodingDisabled ? `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>` : ""
  const placeMapLink = !place.location?.geocodingDisabled ? ` data-map-link=""` : ""
  parts.push(`      <span class="place-name-text"${placeMapLink}>${escape(place.name)}${placeGeoIcon}</span>`)
  const dateLine = renderPlaceDateLine(place)
  if (dateLine) parts.push(`      <span class="place-dates">${dateLine}</span>`)
  if (place.timezone) parts.push(`      <span class="place-tz">${escape(place.timezone)}</span>`)
  parts.push(`    </div>`)
  parts.push(`  </div>`)

  // Body — indented content
  const bodyParts: string[] = []
  if (place.tags?.length)
    bodyParts.push(`<div class="tags">${place.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (place.note)
    bodyParts.push(`<p class="place-note">${renderMarkdown(place.note)}</p>`)
  if (place.stay?.length)
    bodyParts.push(renderStays(place.stay))
  if (place.info?.length)
    bodyParts.push(renderInfoList(place.info, ""))
  if (place.activities.length > 0) {
    const actParts: string[] = [`<div class="activities">`]
    const counter = { n: 0 }
    for (const actItem of place.activities) {
      actParts.push(actItem.type === "ungrouped"
        ? renderUngrouped(actItem, counter)
        : renderActivityGroup(actItem, counter))
    }
    actParts.push(`</div>`)
    bodyParts.push(actParts.join("\n"))
  }

  if (bodyParts.length) {
    parts.push(`  <div class="place-body">`)
    parts.push(bodyParts.map(p => `    ${p}`).join("\n"))
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
  const icon = modeIconSvg(leg.mode)
  const from = leg.from ? leg.from.label : null
  const to   = leg.to   ? leg.to.label   : null

  const departsText  = leg.departs  ? formatMoment(leg.departs)      : null
  const arrivesText  = leg.arrives  ? formatMoment(leg.arrives)      : null
  const durationText = leg.duration ? formatDuration(leg.duration)   : null

  const noteHtml = leg.note ? `<div class="transport-note">${renderMarkdown(leg.note)}</div>` : ""
  const infoHtml = leg.info?.length
    ? `<div class="transport-info">${leg.info.map(i => `<div class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`).join("")}</div>`
    : ""

  const hasBoth = !!(from || departsText) && !!(to || arrivesText)

  let routeHtml: string
  if (hasBoth) {
    routeHtml = `<div class="transport-route-block">
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name"${from ? ` data-hub-name="${escape(from)}"` : ""}>${from ? escape(from) : ""}</span>
      </div>
      <div class="tl-row">
        <div class="tl-marker tl-marker-line"><div class="tl-line"></div></div>
        <div class="tl-meta">
          ${departsText ? `<span class="waypoint-time">departs ${departsText}</span>` : ""}
          ${durationText ? `<span class="segment-duration">${durationText}</span>` : ""}
        </div>
      </div>
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name"${to ? ` data-hub-name="${escape(to)}"` : ""}>${to ? escape(to) : ""}</span>
      </div>
      ${arrivesText ? `<div class="tl-indent"><span class="waypoint-time">arrives ${arrivesText}</span></div>` : ""}
    </div>`
  } else {
    const parts: string[] = []
    if (from || to) parts.push([from, to].filter(Boolean).map(s => escape(s!)).join(" → "))
    if (departsText) parts.push(`departs ${departsText}`)
    if (arrivesText) parts.push(`arrives ${arrivesText}`)
    if (durationText) parts.push(durationText)
    routeHtml = parts.length ? `<div class="transport-simple">${parts.join(" · ")}</div>` : ""
  }

  return `<div class="transport">
  <span class="transport-icon">${icon}</span>
  <div class="transport-body">
    ${routeHtml}${noteHtml}${infoHtml}
  </div>
</div>`
}

function renderStays(stays: Stay[]): string {
  const parts = [`  <div class="stays">`]
  for (const stay of stays) {
    const dateParts: string[] = []
    if (stay.arrives) { const a = formatMoment(stay.arrives); if (a) dateParts.push(`check-in ${a}`) }
    if (stay.departs) { const d = formatMoment(stay.departs); if (d) dateParts.push(`check-out ${d}`) }
    const dateStr = dateParts.length
      ? ` <span class="stay-dates">${dateParts.join(" · ")}</span>`
      : ""
    const noteStr = stay.note
      ? ` <span class="stay-note">${renderMarkdown(stay.note)}</span>`
      : ""
    const infoStr = stay.info?.length
      ? ` <div class="stay-info">${stay.info.map(i => `<div class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`).join("")}</div>`
      : ""
    const stayGeoAttr = !stay.location?.geocodingDisabled ? ` data-stay-name="${escape(stay.name)}"` : ""
    const stayGeoIcon = stay.location?.geocodingDisabled ? `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>` : ""
    const stayMapLink = !stay.location?.geocodingDisabled ? ` data-map-link=""` : ""
    parts.push(`    <div class="stay"${stayGeoAttr}><span class="stay-icon">${ICON_STAY}</span><div class="stay-content"><span class="stay-name"${stayMapLink}>${escape(stay.name)}${stayGeoIcon}</span>${dateStr}${infoStr}${noteStr}</div></div>`)
  }
  parts.push(`  </div>`)
  return parts.join("\n")
}

/** Shared counter type — threads across groups so letters are unique per place. */
interface ActCounter { n: number }

function renderUngrouped(container: UngroupedActivities, counter: ActCounter): string {
  return `    <ul class="activity-list ungrouped">${container.items.map(a => renderActivityItem(a, counter.n++)).join("\n")}</ul>`
}

function renderActivityGroup(group: ActivityGroup, counter: ActCounter): string {
  const isPlan    = group.kind === "plan"
  const cls       = isPlan ? "activity-group plan-group" : "activity-group"
  const kind      = isPlan ? "Plan" : group.kind === "week" ? "Week" : "Day"
  const dateStr   = !isPlan && group.time ? formatGroupDate(group.time) : null
  let headerText  = group.title ?? kind
  if (dateStr) headerText += ` <span class="group-date">— ${escape(dateStr)}</span>`

  const header = isPlan && group.title
    ? `<div class="group-header plan-header">${escape(group.title)}</div>`
    : `<div class="group-header">${headerText}</div>`

  const items = group.items.length
    ? `<ul class="activity-list">${group.items.map(a => renderActivityItem(a, counter.n++)).join("\n")}</ul>`
    : ""

  return `    <div class="${cls}">\n      ${header}\n      ${items}\n    </div>`
}

function renderActivityItem(act: Activity, actIndex?: number): string {
  // Letter label (A, B, C…) as map reference — shown only when index is provided
  const label = actIndex !== undefined && actIndex < 26
    ? `<span class="act-label">${String.fromCharCode(65 + actIndex)}</span>`
    : ""

  const actGeoIcon  = act.location?.geocodingDisabled ? `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>` : ""
  const actMapLink  = !act.location?.geocodingDisabled ? ` data-map-link=""` : ""
  const mainParts = [`<span class="act-name"${actMapLink}>${escape(act.name)}${actGeoIcon}</span>`]
  if (act.time)     { const t = formatMomentTime(act.time); if (t) mainParts.push(`<span class="act-time">${escape(t)}</span>`) }
  if (act.duration) mainParts.push(`<span class="act-duration">${escape(formatDuration(act.duration))}</span>`)

  const tags: string[] = []
  if (act.priority === "must")  tags.push(`<span class="tag priority-must">must</span>`)
  if (act.priority === "maybe") tags.push(`<span class="tag priority-maybe">maybe</span>`)
  if (act.tags?.length) act.tags.forEach(t => tags.push(`<span class="tag">${escape(t)}</span>`))

  const contentParts: string[] = [`<div class="act-main">${mainParts.join(" ")}</div>`]
  if (tags.length)      contentParts.push(`<div class="act-tags">${tags.join("")}</div>`)
  if (act.note)         contentParts.push(`<div class="act-note">${renderMarkdown(act.note)}</div>`)
  if (act.info?.length) contentParts.push(`<div class="act-info">${act.info.map(i => `<div class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`).join("")}</div>`)

  const geoAttr = !act.location?.geocodingDisabled
    ? ` data-act-name="${escape(act.name)}"`
    : ""

  return `<li class="activity-item"${geoAttr}>${label ? label + " " : ""}<div class="act-content">${contentParts.join("")}</div></li>`
}

function renderInfoList(info: MetadataItem[], indent: string): string {
  const items = info.map(i =>
    `${indent}  <div class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`
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
 * Produces the itinerary body only (no app shell).
 * For the full mini-app output, use renderHtml() directly.
 */
export class HtmlRenderer implements CrumbRenderer {
  render(doc: CrumbDocument, _context: RenderContext): string {
    return renderItineraryBody(doc)
  }
}
