/**
 * Embed bootstrap — turns embed.html into a real, reusable embed. Two ways to
 * give it a crumb (no iframe reload either way):
 *
 *   1. Referenced — embed.html?src=<.crumb url>[&geo=<.geo.json url>][&card]
 *   2. Inline data — embed.html[?card] + the host posts
 *      postMessage({ type: "crumb:load", crumb: "<yaml>", geo: { … } })
 *
 * Either path: parse with `window.Crumb.parse`, seed an optional geo-cache, and
 * render via the viewer's `crumb:doc-updated`. In `card` mode it also fills a
 * compact trip header (name + note). When there's no `?src` and nothing baked, it
 * announces `crumb:ready` to its parent so the host can hand it inline data
 * regardless of load timing (robust for lazy iframes).
 */
import { seedGeoCache } from "./geocoder"

type GeoCache = Record<string, { lat: number; lng: number }>
interface LoadOpts { src?: string; crumb?: string; geo?: string | GeoCache }

const params = new URLSearchParams(location.search)
const isCard = params.has("card")
if (isCard) document.body.classList.add("embed-card")

function setLoading(): void {
  const panel = document.getElementById("panel-content")
  if (panel) panel.innerHTML = `<div class="panel-empty"><span class="panel-empty-title">Loading…</span></div>`
}

async function loadCrumb(o: LoadOpts): Promise<void> {
  try {
    // Optional pre-baked geo-cache (URL or inline object): perf/politeness only —
    // absent → live geocoding.
    if (o.geo) {
      if (typeof o.geo === "string") {
        try { seedGeoCache(await (await fetch(o.geo)).json()) }
        catch { /* no cache available; fall back to live geocoding */ }
      } else {
        seedGeoCache(o.geo)
      }
    }
    const text = o.crumb ?? (o.src ? await (await fetch(o.src)).text() : undefined)
    if (text == null) return
    const doc = window.Crumb.parse(text)
    window.__CRUMB_DATA = doc
    if (isCard) {
      const legend = document.getElementById("embed-card-legend")
      if (legend) legend.innerHTML = window.Crumb.renderTripPanel(doc, { variant: "legend" })
    }
    window.dispatchEvent(new CustomEvent("crumb:doc-updated"))
  } catch (e) {
    console.error("crumb embed: failed to load", o.src ?? "(inline)", e)
  }
}

const src = params.get("src")
if (src) {
  setLoading()
  loadCrumb({ src, geo: params.get("geo") ?? undefined })
} else if (!window.__CRUMB_DATA) {
  // No referenced source and nothing baked: wait for the host to post inline data,
  // and tell it we're ready (covers iframes that loaded before the host wired up).
  setLoading()
  window.parent?.postMessage({ type: "crumb:ready" }, "*")
}

// Host control: load a crumb (referenced ?src or inline yaml) without a reload.
window.addEventListener("message", (e: MessageEvent) => {
  const d = e.data
  if (d && d.type === "crumb:load" && (typeof d.src === "string" || typeof d.crumb === "string")) {
    loadCrumb({ src: d.src, crumb: d.crumb, geo: d.geo })
  }
})
