/**
 * Landing page bundle (esbuild IIFE, injected into index.html).
 *
 * The shared detail-level pill is the spine of the top of the page: it drives the
 * hero map <iframe> (via postMessage) and the "it's just text" YAML block together,
 * and floats into a compact pinned pill once the hero scrolls past — un-pinning
 * after the text section, the last thing it controls.
 *
 * Pre-highlighted YAML for each stage is baked into window.__CRUMB_LANDING.
 */

interface Embeddable { crumb: string; geo: Record<string, { lat: number; lng: number }> }
interface LandingData {
  yaml: string[]; files: string[]; defaultStage: number
  hero:  Embeddable[]   // crumb + geo per stage, posted to the hero embed
  cards: Embeddable[]   // crumb + geo per example card, in DOM order
}

const DATA = (window as unknown as { __CRUMB_LANDING?: LandingData }).__CRUMB_LANDING

const pill    = document.getElementById("detail-pill")
const wrap    = pill?.parentElement ?? null                 // .pill-wrap keeps flow space when pinned
const options = pill ? Array.from(pill.querySelectorAll<HTMLButtonElement>(".pill-opt")) : []
const yamlEl  = document.getElementById("yaml-code")
const fileEl  = document.getElementById("yaml-file")
const frame   = document.getElementById("hero-frame") as HTMLIFrameElement | null
const textSec = document.getElementById("sec-text")

let current = DATA?.defaultStage ?? 0

// Hand the hero embed a stage's crumb + geo inline — no iframe reload, no fetch.
function loadStage(i: number): void {
  if (!frame || !DATA) return
  const s = DATA.hero[i]
  frame.contentWindow?.postMessage({ type: "crumb:load", crumb: s.crumb, geo: s.geo }, "*")
}

function setStage(i: number): void {
  current = i
  options.forEach((b, idx) => {
    const on = idx === i
    b.classList.toggle("is-active", on)
    b.setAttribute("aria-selected", String(on))
  })
  if (yamlEl && DATA) yamlEl.innerHTML = DATA.yaml[i]
  if (fileEl && DATA) fileEl.textContent = DATA.files[i]
  loadStage(i)
}

options.forEach((b, i) => b.addEventListener("click", () => setStage(i)))

// Reserve the pill's height on its wrapper so detaching it (position: fixed when
// pinned) doesn't collapse the wrapper and jolt the scroll. Re-measure on resize.
function reservePillSpace(): void {
  if (!wrap || !pill) return
  const r = pill.getBoundingClientRect()
  wrap.style.minHeight = `${r.height}px`
  // Freeze the middle column at the pill's width so the side scales hold their
  // place when the pill detaches (position: fixed) — otherwise the auto column
  // collapses to 0 and the scales slide inward mid-fade.
  wrap.style.gridTemplateColumns = `1fr ${r.width}px 1fr`
}
reservePillSpace()
window.addEventListener("load", reservePillSpace)
window.addEventListener("resize", reservePillSpace)

// Each embed (hero + cards) starts blank and asks for its data with a
// "crumb:ready" message; we reply with the inline crumb + geo. Timing-safe for the
// lazy card iframes — no reliance on catching their load event.
const cardFrames = Array.from(document.querySelectorAll<HTMLIFrameElement>(".example-card-frame"))
const heroCard   = frame?.closest(".hero-card") ?? null
window.addEventListener("message", (e: MessageEvent) => {
  if (!e.data) return

  // The hero embed has no native fullscreen (iframe/iOS): it asks us to grow it to
  // the full viewport. Toggle the overlay class on the card and lock body scroll.
  if (e.data.type === "crumb:fullscreen" && frame && e.source === frame.contentWindow) {
    heroCard?.classList.toggle("is-fullscreen", !!e.data.full)
    document.body.classList.toggle("hero-expanded", !!e.data.full)
    return
  }

  if (!DATA || e.data.type !== "crumb:ready") return
  if (frame && e.source === frame.contentWindow) { loadStage(current); return }
  const i = cardFrames.findIndex(f => f.contentWindow === e.source)
  const c = i >= 0 ? DATA.cards[i] : undefined
  if (c) (e.source as Window).postMessage({ type: "crumb:load", crumb: c.crumb, geo: c.geo }, "*")
})

// Float behaviour: in-flow in the hero; fixed + compact once it reaches the top;
// faded out once scrolled past the middle of the "it's just text" section.
function onScroll(): void {
  if (!pill || !wrap) return
  const wrapTop  = wrap.getBoundingClientRect().top
  const textRect = textSec?.getBoundingClientRect()
  const textMid  = textRect ? (textRect.top + textRect.bottom) / 2 : Infinity
  const pinned = wrapTop <= 14
  pill.classList.toggle("is-pinned", pinned)
  pill.classList.toggle("is-hidden", pinned && textMid <= 80)
}
window.addEventListener("scroll", onScroll, { passive: true })
window.addEventListener("resize", onScroll)
onScroll()
