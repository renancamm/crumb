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
  name: string
  location?: ResolvedGeolocation | null
  query?: string | null
}

export interface DetailPoint {
  name: string
  lat: number
  lng: number
  pinType: "hub" | "stay" | "must" | "maybe" | "activity"
  mode?: string
  subtitle?: string
  placeIdx: number | null
  actLabel?: string
  transportIdx?: number
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

const GEO_CACHE_VERSION = "v2"
const GEO_CACHE_PREFIX  = `crumb-geo-${GEO_CACHE_VERSION}:`
let geoQueue: Promise<void> = Promise.resolve()

function migrateGeoCache(): void {
  const OLD_PREFIX = "crumb-geo:"
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith(OLD_PREFIX) && !key.startsWith(GEO_CACHE_PREFIX)) {
      localStorage.removeItem(key)
    }
  }
}

migrateGeoCache()

export function cachedGeo(name: string): GeoResult | null {
  try {
    const r = localStorage.getItem(GEO_CACHE_PREFIX + name.toLowerCase())
    return r ? (JSON.parse(r) as GeoResult) : null
  } catch {
    return null
  }
}

export function cacheGeo(name: string, result: GeoResult): void {
  try {
    localStorage.setItem(GEO_CACHE_PREFIX + name.toLowerCase(), JSON.stringify(result))
  } catch { /* storage quota exceeded */ }
}

export function fetchGeo(name: string): Promise<GeoResult | null> {
  const promise = geoQueue.then(
    () => new Promise<GeoResult | null>(resolve => {
      fetch(
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({ q: name, format: "json", limit: "1", "accept-language": "en" })
      )
        .then(r => r.json())
        .then((data: Array<{ lat: string; lon: string }>) => {
          const result = data?.length > 0
            ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
            : null
          if (result) cacheGeo(name, result)
          setTimeout(() => resolve(result), 1100)  // Nominatim ToS: ≤1 req/sec
        })
        .catch(() => setTimeout(() => resolve(null), 1100))
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
      const c = cachedGeo(label)
      return c ?? await fetchGeo(label)
    }
  }
  const q = target.query ?? target.name
  return cachedGeo(q) ?? fetchGeo(q)
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

// ─── Transport hub geocoding ──────────────────────────────────────────────────

function nearPlace(pt: GeoResult, name: string, coords: Map<string, GeoResult>): boolean {
  const g = coords.get(name)
  return !!(g && Math.abs(pt.lat - g.lat) < 0.8 && Math.abs(pt.lng - g.lng) < 1.2)
}

const TRANSPORT_HUBS = new Set(["flight", "train", "ferry", "bus"])

export function shouldGeocodeTransport(leg: TransportLeg): boolean {
  if (leg.mode === "walk" || leg.mode === "bike") {
    const hasFrom = leg.from?.lat != null || !!(leg.from?.label && leg.from.label !== "none")
    const hasTo   = leg.to?.lat   != null || !!(leg.to?.label   && leg.to.label   !== "none")
    return hasFrom || hasTo
  }
  if (!TRANSPORT_HUBS.has(leg.mode)) {
    return !!(leg.from?.label && leg.from.label !== "none") ||
           !!(leg.to?.label   && leg.to.label   !== "none")
  }
  return true
}

export async function geocodeTransportHubs(
  doc: CrumbDocument,
  resolvedPlaceCoords: Map<string, GeoResult>,
  isStale: () => boolean,
): Promise<DetailPoint[]> {
  const items = doc.itinerary
  const points: DetailPoint[] = []
  let transportIdx = -1

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type === "place") continue
    transportIdx++
    const leg = item
    if (!shouldGeocodeTransport(leg)) continue
    if (isStale()) return points

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
        const pt = { lat: endpoint.lat, lng: endpoint.lng }
        if (!nearPlace(pt, prevName, resolvedPlaceCoords) && !nearPlace(pt, nextName, resolvedPlaceCoords)) {
          points.push({ name: endpoint.label, lat: pt.lat, lng: pt.lng, pinType: "hub", mode: leg.mode, subtitle: leg.mode + " hub", placeIdx: null, transportIdx })
        }
        continue
      }

      const label = endpoint.label
      if (!label || label === "none") continue

      const contextName = side === "from" ? prevName : nextName
      // When the endpoint label matches the neighboring place name, this is an
      // inferred endpoint (pass3 sets label = placeName) — skip hub geocoding
      // and let fitTransportHubs fall back to the already-resolved place coords.
      if (label === contextName) continue
      const q = suffix
        ? label + " " + suffix + (contextName ? ", " + contextName : "")
        : contextName ? label + ", " + contextName : label

      const geo = cachedGeo(q) ?? await fetchGeo(q)
      if (!geo) continue

      writeBackEndpointGeo(endpoint, geo)
      if (!nearPlace(geo, prevName, resolvedPlaceCoords) && !nearPlace(geo, nextName, resolvedPlaceCoords)) {
        points.push({ name: label, lat: geo.lat, lng: geo.lng, pinType: "hub", mode: leg.mode, subtitle: leg.mode + " hub", placeIdx: null, transportIdx })
      }
    }
  }
  return points
}
