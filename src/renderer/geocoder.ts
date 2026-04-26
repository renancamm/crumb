/**
 * Geocoder script — browser-side geocoding module.
 *
 * Exported as a string constant (GEO_SCRIPT) following the same pattern as
 * css.ts, so it can be injected into the self-contained HTML output as an
 * inline <script> block before the main app script.
 *
 * Functions defined here use `function` declarations so they are globally
 * accessible to the main app script that runs in the subsequent <script> block.
 *
 * Geocoding strategy:
 *   Places     — geocode independently first; retry failures with a neighbor
 *                place name appended as context (e.g. "Alfama, Lisbon").
 *   Activities — caller appends parent place name; geocodingDisabled opt-out
 *                via `location: none` in YAML.
 *   Transport  — flight/train/ferry/bus endpoints geocoded with mode-specific
 *                suffix ("airport", "train station") + nearest place context.
 *                walk/bike legs skipped unless they carry explicit locations.
 *   Write-back — resolved coords are written back onto the in-memory model
 *                objects (place.location, endpoint.lat/lng) so downstream
 *                code reads from the model directly.
 */

export const GEO_SCRIPT = `
  // ── Geocoding ───────────────────────────────────────────────────────────────

  const GEO_CACHE_PREFIX = "crumb-geo:"
  let geoQueue = Promise.resolve()

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

  async function resolveGeo(target) {
    if (target.location) {
      if (target.location.geocodingDisabled) return null
      if (target.location.lat != null && target.location.lng != null) return { lat: target.location.lat, lng: target.location.lng }
      const label = target.location.label
      if (label && label !== "none") { const c = cachedGeo(label); return c ?? await fetchGeo(label) }
    }
    const q = target.query ?? target.name
    return cachedGeo(q) ?? fetchGeo(q)
  }

  // ── Location write-back ─────────────────────────────────────────────────────

  function writeBackGeo(place, geo) {
    if (!place.location) place.location = { label: place.name }
    place.location.lat = geo.lat
    place.location.lng = geo.lng
  }

  function writeBackEndpointGeo(endpoint, geo) {
    endpoint.lat = geo.lat
    endpoint.lng = geo.lng
  }

  // ── Transport hub geocoding ─────────────────────────────────────────────────

  function nearPlace(pt, name, coords) {
    const g = coords.get(name)
    return g && Math.abs(pt.lat - g.lat) < 0.8 && Math.abs(pt.lng - g.lng) < 1.2
  }

  const TRANSPORT_HUBS = new Set(["flight", "train", "ferry", "bus"])

  function shouldGeocodeTransport(leg) {
    // walk/bike: skip unless the leg carries an explicit label or coordinates
    if (leg.mode === "walk" || leg.mode === "bike") {
      const hasFrom = leg.from?.lat != null || (leg.from?.label && leg.from.label !== "none")
      const hasTo   = leg.to?.lat   != null || (leg.to?.label   && leg.to.label   !== "none")
      return hasFrom || hasTo
    }
    // car/generic transport: only geocode when a from/to label is explicitly set
    if (!TRANSPORT_HUBS.has(leg.mode)) {
      return (leg.from?.label && leg.from.label !== "none") ||
             (leg.to?.label   && leg.to.label   !== "none")
    }
    return true
  }

  async function geocodeTransportHubs(doc, resolvedPlaceCoords, isStale) {
    const items  = doc.itinerary
    const points = []

    for (let i = 0; i < items.length; i++) {
      const leg = items[i]
      if (leg.type === "place" || !shouldGeocodeTransport(leg)) continue
      if (isStale()) return points

      const prev     = [...items.slice(0, i)].reverse().find(x => x.type === "place")
      const next     = items.slice(i + 1).find(x => x.type === "place")
      const prevName = prev?.name ?? ""
      const nextName = next?.name ?? ""
      const suffix   = leg.mode === "flight" ? "airport"
                     : leg.mode === "train"  ? "train station"
                     : ""

      for (const [endpoint, side] of [[leg.from, "from"], [leg.to, "to"]]) {
        if (!endpoint || endpoint.geocodingDisabled) continue

        // Already has explicit coordinates — proximity-filter and use as-is
        if (endpoint.lat != null && endpoint.lng != null) {
          const pt = { lat: endpoint.lat, lng: endpoint.lng }
          if (!nearPlace(pt, prevName, resolvedPlaceCoords) && !nearPlace(pt, nextName, resolvedPlaceCoords))
            points.push({ name: endpoint.label, lat: pt.lat, lng: pt.lng, pinType: "hub", mode: leg.mode, subtitle: leg.mode + " hub", placeIdx: null })
          continue
        }

        const label = endpoint.label
        if (!label || label === "none") continue

        // Build contextual query: label + mode suffix + nearest place
        const contextName = side === "from" ? prevName : nextName
        const q = suffix
          ? label + " " + suffix + (contextName ? ", " + contextName : "")
          : contextName ? label + ", " + contextName : label

        const geo = cachedGeo(q) ?? await fetchGeo(q)
        if (!geo) continue

        writeBackEndpointGeo(endpoint, geo)
        if (!nearPlace(geo, prevName, resolvedPlaceCoords) && !nearPlace(geo, nextName, resolvedPlaceCoords))
          points.push({ name: label, lat: geo.lat, lng: geo.lng, pinType: "hub", mode: leg.mode, subtitle: leg.mode + " hub", placeIdx: null })
      }
    }
    return points
  }
`
