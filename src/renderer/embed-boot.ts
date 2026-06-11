/**
 * Embed bootstrap — turns embed.html into a real, reusable embed:
 *
 *   embed.html?src=<.crumb url>[&geo=<.geo.json url>][&card]
 *
 * Fetches the crumb, parses it with `window.Crumb.parse`, seeds an optional baked
 * geo-cache, and renders through the viewer's `crumb:doc-updated` path. A host can
 * also drive it at runtime with `postMessage({ type: "crumb:load", src, geo })`
 * (used by the landing's detail-level pill). In `card` mode it additionally fills
 * a compact trip header (name + note) beside the map.
 *
 * Self-contained renders (the doc baked into `__CRUMB_DATA`) need none of this —
 * we only fetch when a `?src` is present.
 */
import { seedGeoCache } from "./geocoder"

const params = new URLSearchParams(location.search)
const isCard = params.has("card")
if (isCard) document.body.classList.add("embed-card")

function setLoading(): void {
  const panel = document.getElementById("panel-content")
  if (panel) panel.innerHTML = `<div class="panel-empty"><span class="panel-empty-title">Loading…</span></div>`
}

async function loadCrumb(src: string, geo?: string): Promise<void> {
  try {
    // Optional pre-baked geo-cache: politeness/perf only — absent → live geocoding.
    if (geo) {
      try { seedGeoCache(await (await fetch(geo)).json()) }
      catch { /* no cache available; fall back to live geocoding */ }
    }
    const doc = window.Crumb.parse(await (await fetch(src)).text())
    window.__CRUMB_DATA = doc
    if (isCard) {
      const cap = document.getElementById("embed-card-caption")
      if (cap) cap.innerHTML = window.Crumb.renderTripHeader(doc, { compact: true })
    }
    window.dispatchEvent(new CustomEvent("crumb:doc-updated"))
  } catch (e) {
    console.error("crumb embed: failed to load", src, e)
  }
}

const src = params.get("src")
if (src) { setLoading(); loadCrumb(src, params.get("geo") ?? undefined) }

// Host control: load a different crumb without reloading the iframe (hero pill).
window.addEventListener("message", (e: MessageEvent) => {
  const d = e.data
  if (d && d.type === "crumb:load" && typeof d.src === "string") loadCrumb(d.src, d.geo)
})
