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

interface LandingData { yaml: string[]; files: string[]; defaultStage: number }

const DATA = (window as unknown as { __CRUMB_LANDING?: LandingData }).__CRUMB_LANDING

const pill    = document.getElementById("detail-pill")
const wrap    = pill?.parentElement ?? null                 // .pill-wrap keeps flow space when pinned
const options = pill ? Array.from(pill.querySelectorAll<HTMLButtonElement>(".pill-opt")) : []
const yamlEl  = document.getElementById("yaml-code")
const fileEl  = document.getElementById("yaml-file")
const frame   = document.getElementById("hero-frame") as HTMLIFrameElement | null
const textSec = document.getElementById("sec-text")

let current = DATA?.defaultStage ?? 0

function setStage(i: number): void {
  current = i
  options.forEach((b, idx) => {
    const on = idx === i
    b.classList.toggle("is-active", on)
    b.setAttribute("aria-selected", String(on))
  })
  if (yamlEl && DATA) yamlEl.innerHTML = DATA.yaml[i]
  if (fileEl && DATA) fileEl.textContent = DATA.files[i]
  frame?.contentWindow?.postMessage({ type: "crumb:set-doc", index: i }, "*")
}

options.forEach((b, i) => b.addEventListener("click", () => setStage(i)))

// Reserve the pill's height on its wrapper so detaching it (position: fixed when
// pinned) doesn't collapse the wrapper and jolt the scroll. Re-measure on resize.
function reservePillSpace(): void {
  if (wrap && pill) wrap.style.minHeight = `${pill.getBoundingClientRect().height}px`
}
reservePillSpace()
window.addEventListener("load", reservePillSpace)

// Keep the iframe in sync once it has loaded (covers the initial state and any
// reload), since the landing page is the source of truth for the active stage.
frame?.addEventListener("load", () => setStage(current))

// Float behaviour: in-flow in the hero; fixed + compact once it reaches the top;
// faded out once the "it's just text" section scrolls past.
function onScroll(): void {
  if (!pill || !wrap) return
  const wrapTop    = wrap.getBoundingClientRect().top
  const textBottom = textSec ? textSec.getBoundingClientRect().bottom : Infinity
  const pinned = wrapTop <= 14
  pill.classList.toggle("is-pinned", pinned)
  pill.classList.toggle("is-hidden", pinned && textBottom <= 80)
}
window.addEventListener("scroll", onScroll, { passive: true })
window.addEventListener("resize", onScroll)
onScroll()
