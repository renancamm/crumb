/**
 * Offline geo-cache generator.
 *
 * Runs the *real* browser geocoder (`src/geo/geocoder.ts`) in Node behind a
 * tiny in-memory `localStorage` shim, driving it with the same query traversal
 * the viewer uses (`updateMap` in app-map.ts). Whatever the geocoder caches is
 * therefore keyed by the exact `crumb-geo-v4:<query>` strings the viewer looks
 * up — so the emitted `examples/<name>.geo.json` is guaranteed to satisfy every
 * lookup when seeded back via `seedGeoCache`.
 *
 *   npm run gen:geocache
 *
 * Respects Nominatim's ToS: a single shared 1.1s-spaced request queue (inherited
 * from the real geocoder) across all files.
 */

import * as fs from "fs"
import * as path from "path"
import type { CrumbDocument, Place } from "../src/types/resolved"
import type { GeoResult } from "../src/geo/geocoder"

// ── Shims: must be installed BEFORE the geocoder module is loaded ──────────────

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem:    (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem:    (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key:        (i: number) => Array.from(store.keys())[i] ?? null,
  clear:      () => store.clear(),
  get length() { return store.size },
}

// Nominatim requires a descriptive User-Agent; the browser supplies one
// automatically, so the geocoder doesn't set the header itself. Inject it here.
const realFetch = globalThis.fetch
;(globalThis as any).fetch = (url: any, opts: any = {}) =>
  realFetch(url, { ...opts, headers: { "User-Agent": "crumb-geocoder/gen (renancamm@gmail.com)", ...(opts.headers || {}) } })

// ── Load app modules (they capture the shimmed globals) ───────────────────────

const { parse } = require("../src/parser") as typeof import("../src/parser")
const geo       = require("../src/geo/geocoder") as typeof import("../src/geo/geocoder")
const { collectActivityGeoTargets, collectStayGeoTargets } =
  require("../src/geo/geo-targets") as typeof import("../src/geo/geo-targets")

const GEO_CACHE_PREFIX = "crumb-geo-v4:"
const examplesDir = path.resolve(__dirname, "../examples")

// ── Traversal: mirrors updateMap()'s geocoding order ──────────────────────────

async function geocodeDoc(doc: CrumbDocument): Promise<string[]> {
  const failures: string[] = []
  const places = doc.itinerary.filter(i => i.type === "place") as Place[]
  const resolvedCoords = new Map<string, GeoResult>()

  // Places first (no parent viewbox), then retry failures with a neighbour.
  const retry: Place[] = []
  for (const place of places) {
    const g = await geo.resolveGeo(place)
    if (g) { geo.writeBackGeo(place, g); resolvedCoords.set(place.name, g) }
    else retry.push(place)
  }
  for (const place of retry) {
    const i = places.indexOf(place)
    const prev = places[i - 1]?.name, next = places[i + 1]?.name
    const neighbor = resolvedCoords.get(prev ?? "") ? prev : resolvedCoords.get(next ?? "") ? next : null
    const q = neighbor ? `${place.name}, ${neighbor}` : null
    const g = q ? (geo.cachedGeo(q) ?? await geo.fetchGeo(q)) : null
    if (g) { geo.cacheGeo(place.name, g); geo.writeBackGeo(place, g); resolvedCoords.set(place.name, g) }
    else failures.push(`place: ${place.name}`)
  }

  // Transport endpoints.
  const { failed } = await geo.geocodeTransportPoints(doc, resolvedCoords, () => false)
  failures.push(...failed.map(f => `transport: ${f}`))

  // Activities + stays per place (parent viewbox bias).
  const actTargets  = collectActivityGeoTargets(doc)
  const stayTargets = collectStayGeoTargets(doc)
  let placeIdx = 0
  for (const item of doc.itinerary) {
    if (item.type !== "place") continue
    placeIdx++
    const parentCoords =
      item.location?.lat != null && item.location?.lng != null
        ? { lat: item.location.lat, lng: item.location.lng }
        : resolvedCoords.get(item.name)
    for (const t of actTargets.filter(t => t.placeIdx === placeIdx)) {
      if (t.location?.lat != null) continue            // inline coords — no lookup
      const g = await geo.resolveGeo(parentCoords ? { ...t, parentCoords } : t)
      if (!g) failures.push(`activity: ${t.location?.label ?? t.name}`)
    }
    for (const t of stayTargets.filter(t => t.placeIdx === placeIdx)) {
      if (t.hasCoords) continue                         // inline coords — no lookup
      const g = await geo.resolveGeo(parentCoords ? { ...t, parentCoords } : t)
      if (!g) failures.push(`stay: ${t.location?.label ?? t.name}`)
    }
  }
  return failures
}

function serializeCache(): Record<string, GeoResult> {
  const out: Record<string, GeoResult> = {}
  for (const [k, v] of store) {
    if (!k.startsWith(GEO_CACHE_PREFIX)) continue
    try {
      const parsed = JSON.parse(v)
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        out[k.slice(GEO_CACHE_PREFIX.length)] = { lat: parsed.lat, lng: parsed.lng }
      }
    } catch { /* skip */ }
  }
  // Sort keys for stable diffs.
  return Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]))
}

async function main() {
  const files = [
    ...fs.readdirSync(examplesDir).filter(f => f.endsWith(".crumb")).map(f => path.join(examplesDir, f)),
    path.join(examplesDir, "snippets", "kitchen-sink.crumb"),
  ].filter(fs.existsSync)

  let totalFailures = 0
  for (const file of files) {
    store.clear()  // per-file cache → per-file sidecar
    const doc = parse(fs.readFileSync(file, "utf8"))
    process.stderr.write(`\n${path.relative(examplesDir, file)} …\n`)
    const failures = await geocodeDoc(doc)

    const data = serializeCache()
    const sidecar = file.replace(/\.crumb$/, ".geo.json")
    fs.writeFileSync(sidecar, JSON.stringify(data, null, 2) + "\n")

    totalFailures += failures.length
    process.stderr.write(`  → ${Object.keys(data).length} coords baked, ${failures.length} unresolved` +
      (failures.length ? `:\n    - ${failures.join("\n    - ")}\n` : "\n"))
  }

  process.stderr.write(`\nDone. ${totalFailures} total unresolved across ${files.length} files.\n`)
  if (totalFailures > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
