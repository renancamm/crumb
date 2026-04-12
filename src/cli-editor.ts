#!/usr/bin/env ts-node
import * as fs      from "fs"
import * as path    from "path"
import * as esbuild from "esbuild"

async function main() {
  // 1 — Bundle parser + renderer for the browser
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "browser-entry.ts")],
    bundle:      true,
    format:      "iife",
    globalName:  "Crumb",
    platform:    "browser",
    write:       false,
    logLevel:    "silent",
  })

  const bundle = result.outputFiles[0].text

  // 2 — Collect example files
  const examplesDir = path.resolve(__dirname, "../examples")
  const examples: Record<string, string> = {}

  for (const file of fs.readdirSync(examplesDir).filter((f: string) => f.endsWith(".crumb")).sort()) {
    examples[file] = fs.readFileSync(path.join(examplesDir, file), "utf8")
  }

  // 3 — Emit HTML
  process.stdout.write(buildEditorHtml(bundle, examples))
}

main().catch(e => { console.error(e.message); process.exit(1) })

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

const ICON_CODE = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3.5L1 7.5l3.5 4M10.5 3.5L14 7.5l-3.5 4M9 2.5l-3 10"/></svg>`
const ICON_PREVIEW = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1.5 3.5h12M1.5 7.5h12M1.5 11.5h7"/></svg>`

// ─── HTML generation ──────────────────────────────────────────────────────────

function buildEditorHtml(bundle: string, examples: Record<string, string>): string {
  const defaultKey  = Object.keys(examples)[0] ?? ""
  const exampleOpts = Object.keys(examples)
    .map(k => `<option value="${esc(k)}">${esc(k)}</option>`)
    .join("\n        ")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crumb Editor</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <style>${EDITOR_CSS}</style>
</head>
<body>

  <!-- Map fills the entire viewport -->
  <div id="map"></div>

  <!-- Floating panel -->
  <div class="panel">

    <div class="panel-header">
      <span class="brand">crumb</span>
      <div class="header-sep"></div>
      <select id="example-select" class="example-select">
        <option value="">— pick an example —</option>
        ${exampleOpts}
      </select>
      <div id="status" class="status status-idle">✓</div>
      <button id="toggle-btn" class="toggle-btn" title="Show source">${ICON_CODE}</button>
    </div>

    <!-- Preview view (default) -->
    <div id="view-preview" class="panel-content">
      <div id="preview-body" class="preview-body"></div>
    </div>

    <!-- Editor view (hidden by default) -->
    <div id="view-editor" class="panel-content panel-content-editor" style="display:none">
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

  <!-- Geocoding status chip -->
  <div id="map-status" class="map-status-chip"></div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>${bundle}</script>
  <script>
    // ── Examples ──────────────────────────────────────────────────────────────
    const EXAMPLES = ${JSON.stringify(examples)};
    const DEFAULT  = ${JSON.stringify(defaultKey)};

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const editorEl    = document.getElementById("editor")
    const previewEl   = document.getElementById("preview-body")
    const statusEl    = document.getElementById("status")
    const selectEl    = document.getElementById("example-select")
    const mapStatusEl = document.getElementById("map-status")
    const toggleBtn   = document.getElementById("toggle-btn")
    const viewPreview = document.getElementById("view-preview")
    const viewEditor  = document.getElementById("view-editor")

    // ── Color palette ─────────────────────────────────────────────────────────
    const COLORS = {
      place:     "#3b72d9",
      transport: "#3b72d9",
      stay:      "#3b72d9",
      actMust:   "#f97316",
      actNone:   "#fdba74",
      actMaybe:  "#d1d5db",
    }

    // ── Geo index (place + activity coords, for sidebar fly-to) ───────────────
    const geoIndex = { places: [null], activities: new Map() }

    // ── Toggle: preview ↔ editor ──────────────────────────────────────────────
    const ICON_CODE    = \`${ICON_CODE}\`
    const ICON_PREVIEW = \`${ICON_PREVIEW}\`

    let showingEditor = false

    toggleBtn.addEventListener("click", () => {
      showingEditor = !showingEditor
      viewPreview.style.display = showingEditor ? "none" : "flex"
      viewEditor.style.display  = showingEditor ? "flex" : "none"
      toggleBtn.innerHTML = showingEditor ? ICON_PREVIEW : ICON_CODE
      toggleBtn.title     = showingEditor ? "Show preview" : "Show source"
      if (showingEditor) editorEl.focus()
    })

    // ── MapLibre GL map setup ─────────────────────────────────────────────────
    const map = new maplibregl.Map({
      container:  "map",
      style:      "https://tiles.openfreemap.org/styles/liberty",
      center:     [10, 30],
      zoom:       2,
    })

    let mapReady   = false
    let pendingDoc = null
    const detailPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8,  className: "detail-popup" })
    const placePopup  = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 18, className: "place-popup"  })

    map.on("load", () => {
      // ── Sources ──────────────────────────────────────────────────────────
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      map.addSource("places", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      map.addSource("details", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 11,
      })

      // ── Color expression (pinType → color) ───────────────────────────────
      const pinColor = ["case",
        ["==", ["get", "pinType"], "transport"], COLORS.transport,
        ["==", ["get", "pinType"], "stay"],      COLORS.stay,
        ["==", ["get", "pinType"], "must"],      COLORS.actMust,
        ["==", ["get", "pinType"], "activity"],  COLORS.actNone,
        COLORS.actMaybe,   // default: "maybe"
      ]

      // ── Layer stack (bottom → top) ────────────────────────────────────────
      // 1. Route dashes
      map.addLayer({
        id: "route-line", type: "line", source: "route",
        paint: { "line-color": COLORS.place, "line-width": 2, "line-opacity": 0.4, "line-dasharray": [2, 3] },
      })

      // 2. Detail clusters
      map.addLayer({
        id: "detail-clusters", type: "circle", source: "details",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#b0c4e8",
          "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 30, 21],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.85,
        },
      })
      map.addLayer({
        id: "detail-cluster-count", type: "symbol", source: "details",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
        paint: { "text-color": "#fff" },
      })

      // 3. Place circles — rendered as canvas so activity dots can appear above them
      map.addLayer({
        id: "place-circles", type: "circle", source: "places",
        paint: {
          "circle-color": COLORS.place,
          "circle-radius": 14,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      })

      // 4. Individual activity dots — above place circles so they're always visible
      map.addLayer({
        id: "detail-dots", type: "circle", source: "details",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": pinColor,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 5, 15, 8],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
          "circle-opacity": ["case", ["==", ["get", "pinType"], "maybe"], 0.65, 1.0],
        },
      })

      // 5. Activity labels (must-only, high zoom)
      map.addLayer({
        id: "detail-labels", type: "symbol", source: "details",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "pinType"], "must"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": COLORS.actMust,
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
          "text-opacity": ["step", ["zoom"], 0, 13, 1],
        },
      })

      // 6. Place numbers (top — always readable)
      map.addLayer({
        id: "place-numbers", type: "symbol", source: "places",
        layout: {
          "text-field": ["to-string", ["get", "idx"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#fff" },
      })

      // ── Hover popups ──────────────────────────────────────────────────────
      map.on("mouseenter", "detail-dots", e => {
        map.getCanvas().style.cursor = "pointer"
        const coords = e.features[0].geometry.coordinates.slice()
        const { name, subtitle } = e.features[0].properties
        const html = subtitle
          ? \`<strong>\${escHtml(name)}</strong><br><span class="popup-sub">\${escHtml(subtitle)}</span>\`
          : escHtml(name)
        detailPopup.setLngLat(coords).setHTML(html).addTo(map)
      })
      map.on("mouseleave", "detail-dots", () => { map.getCanvas().style.cursor = ""; detailPopup.remove() })

      map.on("mouseenter", "place-circles", e => {
        map.getCanvas().style.cursor = "pointer"
        const coords = e.features[0].geometry.coordinates.slice()
        const { name, arrives } = e.features[0].properties
        const html = arrives
          ? \`<strong>\${escHtml(name)}</strong><br><span class="popup-sub">\${escHtml(arrives)}</span>\`
          : \`<strong>\${escHtml(name)}</strong>\`
        placePopup.setLngLat(coords).setHTML(html).addTo(map)
      })
      map.on("mouseleave", "place-circles", () => { map.getCanvas().style.cursor = ""; placePopup.remove() })

      // Event delegation: sidebar → map fly-to
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
    //
    // Uses Nominatim (OpenStreetMap). Results are cached in localStorage so
    // the same place name is never fetched twice across sessions.
    // Rate-limited to 1 request/second per Nominatim's usage policy.

    const GEO_CACHE_PREFIX = "crumb-geo:"
    let   geoQueue         = Promise.resolve()   // sequential request queue
    let   geocodeEpoch     = 0                   // cancels stale runs on re-render

    function cachedGeo(name) {
      try {
        const raw = localStorage.getItem(GEO_CACHE_PREFIX + name.toLowerCase())
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    }

    function cacheGeo(name, result) {
      try {
        localStorage.setItem(GEO_CACHE_PREFIX + name.toLowerCase(), JSON.stringify(result))
      } catch {}
    }

    function fetchGeo(name) {
      // Enqueue — Nominatim requires max 1 req/sec.
      // The inner Promise resolves only after a 1.1s delay so geoQueue advances slowly.
      const promise = geoQueue.then(() => new Promise(resolve => {
        const url = "https://nominatim.openstreetmap.org/search?" +
          new URLSearchParams({ q: name, format: "json", limit: "1", "accept-language": "en" })

        fetch(url)
          .then(r => r.json())
          .then(data => {
            const result = (data && data.length > 0)
              ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
              : null
            if (result) cacheGeo(name, result)
            setTimeout(() => resolve(result), 1100)   // pace: resolve AFTER delay
          })
          .catch(() => setTimeout(() => resolve(null), 1100))
      }))
      geoQueue = promise.then(() => {})
      return promise
    }

    async function resolveGeo(place) {
      if (place.location) {
        if (place.location.geocodingDisabled) return null
        if (place.location.lat != null && place.location.lng != null) {
          return { lat: place.location.lat, lng: place.location.lng }
        }
        const label = place.location.label
        if (label && label !== "none") {
          const cached = cachedGeo(label)
          if (cached) return cached
          return fetchGeo(label)
        }
      }
      // Fall back to query (activity name + place context) or bare name
      const q = place.query ?? place.name
      const cached = cachedGeo(q)
      if (cached) return cached
      return fetchGeo(q)
    }

    // ── Map rendering ─────────────────────────────────────────────────────────

    async function updateMap(doc) {
      if (!mapReady) { pendingDoc = doc; return }

      const epoch  = ++geocodeEpoch
      const places = doc.itinerary.filter(item => item.type === "place")

      // Reset geo index for this render
      geoIndex.places     = [null]
      geoIndex.activities = new Map()

      if (places.length === 0) {
        map.getSource("route").setData({ type: "FeatureCollection", features: [] })
        map.getSource("places").setData({ type: "FeatureCollection", features: [] })
        map.getSource("details").setData({ type: "FeatureCollection", features: [] })
        setMapStatus("")
        return
      }

      const needsFetch = places.filter(p => {
        if (p.location?.geocodingDisabled) return false
        if (p.location?.lat != null)       return false
        return !cachedGeo(p.location?.label || p.name)
      })
      if (needsFetch.length > 0) setMapStatus("geocoding…")

      const resolved = []
      const resolvedPlaceCoords = new Map()   // name → {lat, lng} for transport filter
      let done = 0

      for (const place of places) {
        if (epoch !== geocodeEpoch) return
        const geo = await resolveGeo(place)
        done++
        if (needsFetch.length > 0) setMapStatus(\`geocoding \${done}/\${places.length}…\`)
        if (geo) {
          resolved.push({ name: place.name, lat: geo.lat, lng: geo.lng, arrives: place.arrives?.label ?? null })
          resolvedPlaceCoords.set(place.name, geo)
        }
        geoIndex.places.push(geo ?? null)
      }
      if (epoch !== geocodeEpoch) return

      drawPlaceMarkers(resolved)
      setMapStatus("")

      // Transit hubs — sync, proximity-filtered
      let detailPoints = collectTransitHubPoints(doc, resolvedPlaceCoords)
      setDetailSource(detailPoints)

      // Activity locations — show explicit coords immediately, then geocode the rest
      const actTargets = collectActivityGeoTargets(doc)

      function actPoint(t, geo) {
        return {
          name: t.name, lat: geo.lat, lng: geo.lng,
          pinType: t.priority === "must" ? "must" : t.priority === "maybe" ? "maybe" : "activity",
          subtitle: t.priority === "must" ? "must do" : null,
          placeIdx: t.placeIdx,
        }
      }

      // Pass 1: explicit coords — no network needed, show immediately
      for (const t of actTargets) {
        const loc = t.location
        if (loc && loc.lat != null && loc.lng != null) {
          const geo = { lat: loc.lat, lng: loc.lng }
          geoIndex.activities.set(t.name, geo)
          detailPoints = [...detailPoints, actPoint(t, geo)]
        }
      }
      if (detailPoints.length > 0) setDetailSource(detailPoints)

      // Pass 2: geocode string locations
      for (const t of actTargets) {
        const loc = t.location
        if (loc && loc.lat != null) continue  // already handled above
        if (epoch !== geocodeEpoch) return
        const geo = await resolveGeo(t)
        if (epoch !== geocodeEpoch) return
        if (geo) {
          geoIndex.activities.set(t.name, geo)
          detailPoints = [...detailPoints, actPoint(t, geo)]
          setDetailSource(detailPoints)
        }
      }

      // Stays — async geocoding, capped at 3 network calls
      const stayTargets = collectStayGeoTargets(doc)
      let staysGeocoded = 0
      for (const t of stayTargets) {
        if (epoch !== geocodeEpoch) return
        if (!t.hasCoords && staysGeocoded >= 3) continue
        const geo = await resolveGeo(t)
        if (epoch !== geocodeEpoch) return
        if (!t.hasCoords) staysGeocoded++
        if (geo) {
          detailPoints = [...detailPoints, {
            name: t.name, lat: geo.lat, lng: geo.lng,
            pinType: "stay", subtitle: t.checkin ?? null, placeIdx: t.placeIdx,
          }]
          setDetailSource(detailPoints)
        }
      }
    }

    function drawPlaceMarkers(points) {
      // Route line
      map.getSource("route").setData({
        type: "FeatureCollection",
        features: points.length > 1 ? [{
          type: "Feature", properties: {},
          geometry: { type: "LineString", coordinates: points.map(p => [p.lng, p.lat]) },
        }] : [],
      })

      // Place circles + numbers via GeoJSON so they sit in the canvas z-stack
      map.getSource("places").setData({
        type: "FeatureCollection",
        features: points.map((p, i) => ({
          type: "Feature",
          properties: { name: p.name, idx: i + 1, arrives: p.arrives ?? null },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        })),
      })

      // Fit bounds
      if (points.length > 0) {
        const bounds = new maplibregl.LngLatBounds()
        points.forEach(p => bounds.extend([p.lng, p.lat]))
        map.fitBounds(bounds, { padding: 60, maxZoom: 10 })
      }
    }

    function setDetailSource(points) {
      map.getSource("details").setData({
        type: "FeatureCollection",
        features: points.map(p => ({
          type: "Feature",
          properties: {
            name:     p.name,
            pinType:  p.pinType  ?? "activity",
            subtitle: p.subtitle ?? null,
            placeIdx: p.placeIdx ?? null,
          },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        })),
      })
    }

    function collectActivityGeoTargets(doc) {
      const targets = []
      let placeIdx = 0
      for (const item of doc.itinerary) {
        if (item.type !== "place") continue
        placeIdx++
        for (const group of (item.activities ?? [])) {
          for (const act of (group.items ?? [])) {
            if (typeof act === "string") continue
            if (act.location?.geocodingDisabled) continue
            // Use explicit location if available, otherwise geocode by "Name, Place"
            const query = act.location ? null : \`\${act.name}, \${item.name}\`
            targets.push({ name: act.name, location: act.location ?? null, query, priority: act.priority ?? null, placeIdx })
          }
        }
      }
      return targets
    }

    function collectTransitHubPoints(doc, resolvedPlaceCoords) {
      const skip = new Set(["walk", "bike"])
      const items = doc.itinerary
      const points = []

      function nearPlace(pt, name) {
        const geo = resolvedPlaceCoords.get(name)
        if (!geo) return false
        return Math.abs(pt.lat - geo.lat) < 0.8 && Math.abs(pt.lng - geo.lng) < 1.2
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type === "place" || skip.has(item.mode)) continue

        const prev = [...items.slice(0, i)].reverse().find(x => x.type === "place")
        const next = items.slice(i + 1).find(x => x.type === "place")

        if (item.from?.lat != null && item.from?.lng != null) {
          const pt = { lat: item.from.lat, lng: item.from.lng }
          if (!nearPlace(pt, prev?.name) && !nearPlace(pt, next?.name))
            points.push({ name: item.from.label, lat: pt.lat, lng: pt.lng,
              pinType: "transport", subtitle: item.mode + " hub", placeIdx: null })
        }
        if (item.to?.lat != null && item.to?.lng != null) {
          const pt = { lat: item.to.lat, lng: item.to.lng }
          if (!nearPlace(pt, prev?.name) && !nearPlace(pt, next?.name))
            points.push({ name: item.to.label, lat: pt.lat, lng: pt.lng,
              pinType: "transport", subtitle: item.mode + " hub", placeIdx: null })
        }
      }
      return points
    }

    function collectStayGeoTargets(doc) {
      const targets = []
      let placeIdx = 0
      for (const item of doc.itinerary) {
        if (item.type !== "place") continue
        placeIdx++
        for (const stay of (item.stay ?? [])) {
          if (stay.location?.geocodingDisabled) continue
          const hasCoords = stay.location?.lat != null
          const checkin   = stay.arrives ? \`check-in \${stay.arrives.label}\` : null
          targets.push({
            name:      hasCoords ? stay.name : \`\${stay.name}, \${item.name}\`,
            location:  stay.location ?? null,
            hasCoords,
            checkin,
            placeIdx,
          })
        }
      }
      return targets
    }

    function setMapStatus(text) {
      mapStatusEl.textContent = text
    }

    function escHtml(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    }

    // ── Parse + render ────────────────────────────────────────────────────────

    let debounce
    let lastDoc = null

    function render() {
      const src = editorEl.value.trim()

      if (!src) {
        previewEl.innerHTML = '<div class="preview-empty">Start typing a crumb document…</div>'
        setStatus("idle", "ready")
        if (mapReady) {
          map.getSource("route").setData({ type: "FeatureCollection", features: [] })
          map.getSource("places").setData({ type: "FeatureCollection", features: [] })
          map.getSource("details").setData({ type: "FeatureCollection", features: [] })
        }
        setMapStatus("")
        return
      }

      try {
        const doc = Crumb.parse(src)
        previewEl.innerHTML = Crumb.renderItineraryBody(doc)
        setStatus("ok", "✓")
        updateMap(doc)
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).split("\\n")[0]
        previewEl.innerHTML = '<div class="preview-error"><strong>Parse error</strong><br>' + escHtml(msg) + '</div>'
        setStatus("error", "⚠ error")
      }
    }

    function setStatus(kind, text) {
      statusEl.textContent = text
      statusEl.className   = "status status-" + kind
    }

    // ── Editor input ──────────────────────────────────────────────────────────

    editorEl.addEventListener("input", () => {
      setStatus("idle", "…")
      clearTimeout(debounce)
      debounce = setTimeout(render, 220)
    })

    editorEl.addEventListener("keydown", e => {
      if (e.key !== "Tab") return
      e.preventDefault()
      const s = editorEl.selectionStart
      const v = editorEl.value
      editorEl.value = v.slice(0, s) + "  " + v.slice(editorEl.selectionEnd)
      editorEl.selectionStart = editorEl.selectionEnd = s + 2
    })

    // ── Example picker ────────────────────────────────────────────────────────

    selectEl.addEventListener("change", () => {
      const key = selectEl.value
      if (key && EXAMPLES[key] !== undefined) {
        editorEl.value = EXAMPLES[key]
        render()
      }
    })

    // ── Boot ──────────────────────────────────────────────────────────────────

    if (DEFAULT && EXAMPLES[DEFAULT]) {
      selectEl.value = DEFAULT
      editorEl.value = EXAMPLES[DEFAULT]
    }
    render()
  </script>
</body>
</html>`
}

// ─── Escape for HTML attributes ───────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
}

/* ── Fullscreen map ─────────────────────────────────────────────────── */
#map {
  position: fixed;
  inset: 0;
  z-index: 0;
}

/* ── Floating panel ─────────────────────────────────────────────────── */
.panel {
  position: fixed;
  left: 16px;
  top: 16px;
  bottom: 16px;
  width: 340px;
  z-index: 1000;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,.18), 0 1px 4px rgba(0,0,0,.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Panel header ───────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 10px 0 14px;
  background: #fafaf8;
  border-bottom: 1px solid #ebebea;
  flex-shrink: 0;
  user-select: none;
}

.brand {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: .3px;
}

.header-sep { flex: 1; }

.example-select {
  appearance: none;
  background: #f0f0ee;
  border: 1px solid #ddd;
  border-radius: 6px;
  color: #333;
  font-size: 12px;
  padding: 4px 24px 4px 8px;
  cursor: pointer;
  max-width: 150px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  outline: none;
}
.example-select:hover { border-color: #bbb; }
.example-select:focus { border-color: #999; }

.status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background .2s, color .2s;
  flex-shrink: 0;
}
.status-idle  { background: #f0f0ee; color: #999; }
.status-ok    { background: #e6f4ea; color: #2e7d32; }
.status-error { background: #fdecea; color: #c62828; }

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #666;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s, color .15s;
}
.toggle-btn:hover { background: #ebebea; color: #1a1a1a; }

/* ── Panel content areas ────────────────────────────────────────────── */
.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.panel-content-editor {
  overflow: hidden;
}

/* ── Editor textarea ────────────────────────────────────────────────── */
.editor-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: #1e1e2e;
  color: #cdd6f4;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  padding: 14px 16px 40px;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  caret-color: #89b4fa;
  border-radius: 0 0 12px 12px;
}
.editor-textarea::placeholder { color: #45475a; }

/* ── Preview body ───────────────────────────────────────────────────── */
.preview-body {
  padding: 14px 14px 40px;
}

.preview-empty {
  margin-top: 48px; text-align: center; color: #aaa; font-size: 13px;
}
.preview-error {
  margin: 14px 0; padding: 10px 12px;
  background: #fff0f0; border: 1px solid #fcc;
  border-radius: 8px; color: #c00; font-size: 12px; line-height: 1.5;
}

/* ── Map geocoding status chip ──────────────────────────────────────── */
.map-status-chip {
  position: fixed;
  bottom: 28px;
  right: 16px;
  z-index: 1000;
  background: rgba(0,0,0,.55);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
  backdrop-filter: blur(4px);
  pointer-events: none;
  transition: opacity .3s;
}
.map-status-chip:empty { opacity: 0; }

/* ── MapLibre popup overrides ───────────────────────────────────────── */
.place-popup .maplibregl-popup-content {
  padding: 8px 12px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0,0,0,.18);
}
.place-popup .maplibregl-popup-tip { border-top-color: #fff; }
.popup-sub { color: #888; font-size: 11px; }

.detail-popup .maplibregl-popup-content {
  padding: 3px 8px;
  border-radius: 5px;
  background: rgba(20,20,20,.8);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  box-shadow: none;
}
.detail-popup .maplibregl-popup-tip { border-top-color: rgba(20,20,20,.8); }

/* ── Sidebar clickable elements ─────────────────────────────────────── */
[data-place-index] { cursor: pointer; }
[data-act-name]    { cursor: pointer; }
[data-place-index]:hover .place-name { text-decoration: underline; text-decoration-color: #3b72d9; }
[data-act-name]:hover .act-name      { text-decoration: underline; text-decoration-color: #c0392b; }


/* ── Itinerary styles (scoped to .preview-body) ─────────────────────── */
.preview-body .itinerary { display: flex; flex-direction: column; }

.preview-body .trip-header {
  background: #fff; border-radius: 8px;
  padding: 14px 16px 12px; margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,.07);
  border: 1px solid #ebebea;
}
.preview-body .trip-header h1 { font-size: 17px; font-weight: 700; margin-bottom: 4px; letter-spacing: -.2px; color: #1a1a1a; }
.preview-body .trip-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; color: #666; margin-bottom: 6px; }
.preview-body .author { color: #555; }

.preview-body .place {
  background: #fff; border-radius: 8px;
  padding: 13px 15px 11px;
  box-shadow: 0 1px 3px rgba(0,0,0,.07);
  border: 1px solid #ebebea;
  margin-bottom: 2px;
}
.preview-body .place-header { margin-bottom: 6px; }
.preview-body .place-name { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 600; margin-bottom: 2px; color: #1a1a1a; }
.preview-body .place-num {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 20px; height: 20px;
  background: #3b72d9; color: #fff;
  border-radius: 50%; font-size: 10px; font-weight: 700;
}
.preview-body .place-dates { font-size: 11px; color: #777; }
.preview-body .place-tz { font-size: 10px; color: #aaa; margin-top: 2px; }

.preview-body .transport {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 5px;
  background: #f7f7f5; padding: 6px 15px;
  font-size: 11px; color: #666; margin-bottom: 2px;
  border-radius: 6px; border: 1px solid #ebebea;
}
.preview-body .transport-icon { font-size: 12px; }
.preview-body .transport-mode { font-weight: 500; color: #444; }
.preview-body .transport-route { color: #555; }
.preview-body .transport-times { color: #888; }
.preview-body .transport-info,
.preview-body .transport-note { width: 100%; padding-left: 18px; font-size: 10px; color: #999; }

.preview-body .stays { margin: 4px 0 7px; }
.preview-body .stay { font-size: 11px; color: #666; padding: 3px 0; border-top: 1px solid #f0f0ec; }
.preview-body .stay-name { font-weight: 500; color: #444; }
.preview-body .stay-dates { color: #999; margin-left: 5px; }
.preview-body .stay-note { color: #888; font-style: italic; margin-left: 5px; }
.preview-body .stay-info { margin-top: 2px; padding-left: 16px; }

.preview-body .activities { margin-top: 3px; }
.preview-body .activity-list { list-style: none; }
.preview-body .activity-item {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: 2px 4px; padding: 3px 0;
  font-size: 11px; border-bottom: 1px solid #f5f5f0;
}
.preview-body .activity-item:last-child { border-bottom: none; }

.preview-body .dot { font-size: 9px; width: 11px; flex-shrink: 0; }
.preview-body .dot.must  { color: #e06c00; }
.preview-body .dot.maybe { color: #bbb; }
.preview-body .dot.none  { color: #ddd; }

.preview-body .act-name { flex: 1; min-width: 80px; }
.preview-body .act-time { font-size: 10px; color: #888; }
.preview-body .act-duration { font-size: 10px; color: #aaa; }
.preview-body .act-note {
  width: 100%; padding-left: 14px;
  font-size: 10px; color: #888; font-style: italic;
  border-left: 2px solid #e8e8e4; margin: 1px 0;
}
.preview-body .act-info { width: 100%; padding-left: 14px; font-size: 10px; color: #999; }

.preview-body .activity-group {
  margin: 5px 0; border-radius: 6px;
  background: #fafaf7; border: 1px solid #ebebe6; overflow: hidden;
}
.preview-body .plan-group { border-style: dashed; border-color: #d8d8d2; background: #fdfdfb; }
.preview-body .group-header {
  font-size: 10px; font-weight: 600; color: #555;
  padding: 4px 9px 3px; background: #f5f5f0; border-bottom: 1px solid #ebebe6;
}
.preview-body .plan-header { color: #888; background: #fafaf7; }
.preview-body .group-date { font-weight: 400; color: #888; }
.preview-body .activity-group .activity-list { padding: 2px 9px 3px; }

.preview-body .tags { margin: 3px 0 5px; display: flex; flex-wrap: wrap; gap: 3px; }
.preview-body .tag {
  display: inline-block; background: #f0efeb; color: #666;
  border-radius: 4px; padding: 1px 5px; font-size: 10px;
}
.preview-body .tag.small { font-size: 10px; padding: 1px 4px; }

.preview-body .note {
  font-size: 11px; color: #777; font-style: italic;
  border-left: 3px solid #e0e0d8; padding-left: 7px; margin: 4px 0;
}

.preview-body .info-list { margin: 4px 0; font-size: 10px; color: #888; }
.preview-body .info-row { display: flex; gap: 5px; padding: 1px 0; }
.preview-body .info-key { font-weight: 500; color: #aaa; min-width: 56px; }
.preview-body .info-val { color: #666; }
.preview-body .info-item { margin-right: 7px; }
.preview-body .info-item .info-key { color: #aaa; margin-right: 3px; }
`
