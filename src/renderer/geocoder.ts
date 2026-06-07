/**
 * Browser-side geocoding module.
 *
 * Geocoding strategy:
 *   Places     — geocode independently first; retry failures with a neighbour
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

import type { CrumbDocument, Place, ResolvedGeolocation, TransportLeg } from "../types/resolved"

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface GeoResult {
  lat: number
  lng: number
}

export interface GeoTarget {
  name:          string
  location?:     ResolvedGeolocation | null
  query?:        string | null
  parentCoords?: GeoResult
}

export interface DetailPoint {
  name: string
  lat: number
  lng: number
  pinType: "transport" | "stay" | "must" | "maybe" | "activity"
  mode?: string
  placeIdx: number | null
  actLabel?: string
  transportIdx?: number
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

const GEO_CACHE_VERSION = "v4"
const GEO_CACHE_PREFIX  = `crumb-geo-${GEO_CACHE_VERSION}:`
const GEO_TIMEOUT_MS    = 8000
const NEGATIVE_TTL_MS   = 7 * 24 * 60 * 60 * 1000
const VIEWBOX_PAD_LAT   = 2.0
const VIEWBOX_PAD_LNG   = 3.0

let geoQueue: Promise<void> = Promise.resolve()

function migrateGeoCache(): void {
  const FAMILY = "crumb-geo"
  const now = Date.now()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(FAMILY)) continue
    // Drop any cache from a previous version (different prefix).
    if (!key.startsWith(GEO_CACHE_PREFIX)) {
      localStorage.removeItem(key)
      continue
    }
    // Expire stale negative entries in the current version.
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}") as { miss?: true; ts?: number }
      if (parsed.miss && parsed.ts && (now - parsed.ts) >= NEGATIVE_TTL_MS) {
        localStorage.removeItem(key)
      }
    } catch { /* ignore */ }
  }
}

migrateGeoCache()

// Returns GeoResult (cache hit), "miss" (known negative), or null (absent)
function cachedGeoOrMiss(name: string): GeoResult | "miss" | null {
  try {
    const r = localStorage.getItem(GEO_CACHE_PREFIX + name.toLowerCase())
    if (!r) return null
    const parsed = JSON.parse(r) as GeoResult | { miss: true; ts?: number }
    if ("miss" in parsed) {
      const ts = (parsed as { ts?: number }).ts
      if (!ts || (Date.now() - ts) < NEGATIVE_TTL_MS) return "miss"
      localStorage.removeItem(GEO_CACHE_PREFIX + name.toLowerCase())
      return null
    }
    return parsed as GeoResult
  } catch {
    return null
  }
}

export function cachedGeo(name: string): GeoResult | null {
  const r = cachedGeoOrMiss(name)
  return r === "miss" ? null : r
}

export function cacheGeo(name: string, result: GeoResult): void {
  try {
    localStorage.setItem(GEO_CACHE_PREFIX + name.toLowerCase(), JSON.stringify(result))
  } catch { /* storage quota exceeded */ }
}

/**
 * Pre-populate the geo cache from injected data (e.g. a demo page that ships a
 * baked `{ query: {lat,lng} }` map) so the viewer resolves known places with
 * zero network requests. Routed through `cacheGeo` so the versioned
 * `crumb-geo-v4:` key format stays the single source of truth — see invariant 9.
 * `migrateGeoCache()` has already run at import time, so positive seeds under
 * the current prefix survive; unknown queries still fall back to online lookup.
 */
export function seedGeoCache(data: Record<string, GeoResult>): void {
  for (const [query, coords] of Object.entries(data)) {
    if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
      cacheGeo(query, coords)
    }
  }
}

function cacheNegative(name: string): void {
  try {
    localStorage.setItem(
      GEO_CACHE_PREFIX + name.toLowerCase(),
      JSON.stringify({ miss: true, ts: Date.now() })
    )
  } catch { /* storage quota exceeded */ }
}

export function isKnownMiss(name: string): boolean {
  return cachedGeoOrMiss(name) === "miss"
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id))
}

type NominatimOutcome = { result: GeoResult } | { empty: true } | { error: true }

function distSq(a: GeoResult, b: GeoResult): number {
  const dLat = a.lat - b.lat, dLng = a.lng - b.lng
  return dLat * dLat + dLng * dLng
}

function fetchNominatim(name: string, parentCoords?: GeoResult): Promise<NominatimOutcome> {
  const params: Record<string, string> = {
    // With a region hint, fetch several candidates so we can pick the nearest —
    // Nominatim ranks by global importance, which can put a far match first for
    // an ambiguous name ("Old Quarter"). The viewbox is only a soft bias.
    q: name, format: "json", limit: parentCoords ? "5" : "1", "accept-language": "en", email: "crumb-geocoder",
  }
  if (parentCoords) {
    const { lat, lng } = parentCoords
    params.viewbox = `${lng - VIEWBOX_PAD_LNG},${lat + VIEWBOX_PAD_LAT},${lng + VIEWBOX_PAD_LNG},${lat - VIEWBOX_PAD_LAT}`
  }
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams(params)
  return fetchWithTimeout(url)
    .then(r => r.json())
    .then((data: Array<{ lat: string; lon: string }>) => {
      if (!data?.length) return { empty: true } as NominatimOutcome
      const candidates = data.map(d => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon) }))
      const best = parentCoords
        ? candidates.reduce((a, b) => (distSq(b, parentCoords) < distSq(a, parentCoords) ? b : a))
        : candidates[0]
      return { result: best }
    })
    .catch(() => ({ error: true }) as NominatimOutcome)
}

export function fetchGeo(name: string, parentCoords?: GeoResult): Promise<GeoResult | null> {
  const promise = geoQueue.then(
    () => new Promise<GeoResult | null>(resolve => {
      fetchNominatim(name, parentCoords).then(outcome => {
        if ("result" in outcome) {
          cacheGeo(name, outcome.result)
          setTimeout(() => resolve(outcome.result), 1100)  // Nominatim ToS: ≤1 req/sec
          return
        }
        if ("empty" in outcome) {
          // Confirmed empty response — negative-cache so we don't retry next load
          cacheNegative(name)
          setTimeout(() => resolve(null), 1100)
          return
        }
        // Timeout or network error — do not negative-cache, allow retry next load
        setTimeout(() => resolve(null), 1100)
      })
    })
  )
  geoQueue = promise.then(() => {})
  return promise
}

export async function resolveGeo(target: GeoTarget): Promise<GeoResult | null> {
  if (target.location) {
    if (target.location.geocodingDisabled) return null
    if (target.location.lat != null && target.location.lng != null) {
      return { lat: target.location.lat, lng: target.location.lng }
    }
    const label = target.location.label
    if (label && label !== "none") {
      const c = cachedGeoOrMiss(label)
      if (c !== null) return c === "miss" ? null : c
      return fetchGeo(label, target.parentCoords)
    }
  }
  const q = target.query ?? target.name
  const c = cachedGeoOrMiss(q)
  if (c !== null) return c === "miss" ? null : c
  return fetchGeo(q, target.parentCoords)
}

// ─── Location write-back ──────────────────────────────────────────────────────

export function writeBackGeo(place: Place, geo: GeoResult): void {
  place.location ??= { label: place.name }
  place.location.lat = geo.lat
  place.location.lng = geo.lng
}

export function writeBackEndpointGeo(endpoint: ResolvedGeolocation, geo: GeoResult): void {
  endpoint.lat = geo.lat
  endpoint.lng = geo.lng
}

// ─── Transport endpoint geocoding ──────────────────────────────────────────────────

const GEOCODED_TRANSPORT_MODES = new Set(["flight", "train", "ferry", "bus"])

export function shouldGeocodeTransport(leg: TransportLeg): boolean {
  if (leg.mode === "walk" || leg.mode === "bike") {
    const hasFrom = leg.from?.lat != null || !!(leg.from?.label && leg.from.label !== "none")
    const hasTo   = leg.to?.lat   != null || !!(leg.to?.label   && leg.to.label   !== "none")
    return hasFrom || hasTo
  }
  if (!GEOCODED_TRANSPORT_MODES.has(leg.mode)) {
    return !!(leg.from?.label && leg.from.label !== "none") ||
           !!(leg.to?.label   && leg.to.label   !== "none")
  }
  return true
}

export async function geocodeTransportPoints(
  doc: CrumbDocument,
  resolvedPlaceCoords: Map<string, GeoResult>,
  isStale: () => boolean,
): Promise<{ points: DetailPoint[]; failed: string[] }> {
  const items = doc.itinerary
  const points: DetailPoint[] = []
  const failed: string[] = []
  let transportIdx = -1

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type === "place") continue
    transportIdx++
    const leg = item
    if (!shouldGeocodeTransport(leg)) continue
    if (isStale()) return { points, failed }

    const prev     = [...items.slice(0, i)].reverse().find((x): x is Place => x.type === "place")
    const next     = items.slice(i + 1).find((x): x is Place => x.type === "place")
    const prevName = prev?.name ?? ""
    const nextName = next?.name ?? ""
    const suffix   = leg.mode === "flight" ? "airport"
                   : leg.mode === "train"  ? "train station"
                   : ""

    const sides: Array<{ endpoint: ResolvedGeolocation | undefined; side: "from" | "to" }> = [
      { endpoint: leg.from, side: "from" },
      { endpoint: leg.to,   side: "to"   },
    ]

    for (const { endpoint, side } of sides) {
      if (!endpoint || endpoint.geocodingDisabled) continue

      if (endpoint.lat != null && endpoint.lng != null) {
        points.push({ name: endpoint.label, lat: endpoint.lat, lng: endpoint.lng, pinType: "transport", mode: leg.mode, placeIdx: null, transportIdx })
        continue
      }

      const label = endpoint.label
      if (!label || label === "none") continue

      const contextName = side === "from" ? prevName : nextName
      // When the endpoint label matches the neighboring place name, this is an
      // inferred endpoint (pass3 sets label = placeName) — skip endpoint geocoding
      // and let fitTransportPoints fall back to the already-resolved place coords.
      if (label === contextName) continue
      // Bias the search by the neighbouring place's region (viewbox) rather than
      // appending the city to the query — same strategy as activity geocoding.
      // Only add the mode suffix when the label doesn't already name the facility
      // (otherwise "Kyoto Station" + "train station" is unresolvable).
      const ctxCoords = resolvedPlaceCoords.get(contextName)
      const labelNamesFacility = /\b(station|airport|terminal|hbf|bahnhof|gare|aeroport|aeropuerto)\b/i.test(label)
      const q = labelNamesFacility || !suffix ? label : `${label} ${suffix}`

      const geo = cachedGeo(q) ?? await fetchGeo(q, ctxCoords)
      if (!geo) { failed.push(label); continue }

      writeBackEndpointGeo(endpoint, geo)
      points.push({ name: label, lat: geo.lat, lng: geo.lng, pinType: "transport", mode: leg.mode, placeIdx: null, transportIdx })
    }
  }
  return { points, failed }
}
