/**
 * Bottom-sheet snap behaviour for the mobile sidebar.
 *
 * Three snap states:
 *   peek   — 104 px: handle + title visible (footer pager lives in its own fixed bar)
 *   medium — 50 % of the viewport
 *   full   — 90 % of the viewport
 *
 * The sheet is a fixed-height element (full height) anchored at bottom: 0 and
 * moved between states with `transform: translateY` — GPU-composited, so snaps
 * stay smooth and the sheet's own height never changes (no per-frame reflow, no
 * sticky-header flicker during expansion).
 *
 * There is no draggable handle. Expansion/collapse is driven entirely by scroll
 * gestures on #panel-content, which remains its own native scroll container:
 *   - When not at full height, a vertical drag moves the sheet (content scroll is
 *     intercepted from the first move, so native scroll never competes).
 *   - At full height, content scrolls natively; a downward drag while already at
 *     the scroll top collapses the sheet instead.
 * On release the sheet snaps to the nearest of the three heights.
 *
 * goMedium() is called by navigation on depth changes (trip ↔ place ↔ detail)
 * and on map-background taps.
 *
 * Sets --sheet-h on :root (the live visible sheet height) so map controls and
 * mapPadding() can track the sheet. Sets --sheet-anim to 0ms during a gesture
 * (instant control tracking) and restores it on snap, so controls animate with
 * the sheet on snap.
 */

// cubic-bezier(0.32, 0.72, 0, 1) = iOS-style decelerate spring for bottom sheet snap
const TRANSITION = "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)"
const CTRL_ANIM  = "300ms cubic-bezier(0.32, 0.72, 0, 1)"
const PEEK_H     = 104  // px — handle bar + one title line (footer is a separate fixed bar)

type SnapState = "peek" | "medium" | "full"

let sheet:   HTMLElement | null = null
let content: HTMLElement | null = null
let footer:  HTMLElement | null = null

let curH      = 0
let snapState: SnapState = "medium"

let gesture: "undecided" | "sheet" | "scroll" = "undecided"
let startY  = 0
let startX  = 0
let startH  = 0

const root = document.documentElement

function peekH():   number { return PEEK_H }
function mediumH(): number { return window.innerHeight * 0.5 }
function fullH():   number { return window.innerHeight * 0.9 }

/** Move the sheet so that `h` px are visible above the viewport bottom. */
function setSheetH(h: number): void {
  curH = h
  if (sheet) sheet.style.transform = `translateY(${fullH() - h}px)`
  root.style.setProperty("--sheet-h", `${h}px`)
}

function animate(h: number): void {
  root.style.setProperty("--sheet-anim", CTRL_ANIM)
  if (sheet) sheet.style.transition = TRANSITION
  setSheetH(h)
}

export function goPeek(): void {
  if (!sheet) return
  snapState = "peek"
  animate(peekH())
}

export function goMedium(): void {
  if (!sheet) return
  snapState = "medium"
  animate(mediumH())
}

export function expandFull(): void {
  if (!sheet) return
  snapState = "full"
  animate(fullH())
}

export function isExpanded(): boolean {
  return snapState === "full"
}

export function initSheet(): void {
  sheet   = document.getElementById("sidebar")!
  content = document.getElementById("panel-content")!
  footer  = document.getElementById("panel-footer")

  // The pager becomes a persistent bar fixed to the viewport bottom. It must live
  // outside #sidebar, whose `transform` would otherwise make `position: fixed`
  // resolve against the sheet instead of the viewport.
  if (footer) document.body.appendChild(footer)

  content.addEventListener("touchstart", onTouchStart, { passive: true })
  content.addEventListener("touchmove",  onTouchMove,  { passive: false })
  content.addEventListener("touchend",   onTouchEnd)
  content.addEventListener("touchcancel", onTouchEnd)

  window.addEventListener("resize", onResize)

  // Full height is the sheet's fixed CSS height; start at medium.
  sheet.style.height = `${fullH()}px`
  goMedium()
}

/** Called when viewport leaves mobile breakpoint — clears inline styles so desktop CSS takes over. */
export function exitSheet(): void {
  if (sheet) {
    sheet.style.transform  = ""
    sheet.style.transition = ""
    sheet.style.height     = ""
  }
  root.style.removeProperty("--sheet-h")
  root.style.removeProperty("--sheet-anim")
  if (content) {
    content.removeEventListener("touchstart", onTouchStart)
    content.removeEventListener("touchmove",  onTouchMove)
    content.removeEventListener("touchend",   onTouchEnd)
    content.removeEventListener("touchcancel", onTouchEnd)
  }
  window.removeEventListener("resize", onResize)
  // Restore the pager into the sheet (last child) for desktop's in-flow layout.
  if (footer && sheet) sheet.appendChild(footer)
  sheet   = null
  content = null
  footer  = null
}

function onResize(): void {
  if (!sheet) return
  sheet.style.height = `${fullH()}px`
  const target = snapState === "full" ? fullH() : snapState === "medium" ? mediumH() : peekH()
  setSheetH(target)
}

function snapToCurrent(): void {
  const states = [peekH(), mediumH(), fullH()] as const
  const target = states.reduce((a, b) => Math.abs(a - curH) <= Math.abs(b - curH) ? a : b)
  if (target === peekH())      goPeek()
  else if (target === fullH()) expandFull()
  else                         goMedium()
}

// ── Scroll-driven gesture on #panel-content ──────────────────────────────────
// Decide on the first move whether the gesture moves the sheet or scrolls the
// content, then lock that decision for the whole touch (avoids the native-scroll
// vs JS-drag race that made the old handoff stutter).

function onTouchStart(e: TouchEvent): void {
  gesture = "undecided"
  startY  = e.touches[0].clientY
  startX  = e.touches[0].clientX
  startH  = curH
}

function onTouchMove(e: TouchEvent): void {
  if (!sheet || !content) return
  const dy = e.touches[0].clientY - startY // positive = finger moving down
  const dx = e.touches[0].clientX - startX

  if (gesture === "undecided") {
    if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return // not enough movement yet
    if (Math.abs(dx) > Math.abs(dy)) { gesture = "scroll"; return } // horizontal → leave it

    if (snapState !== "full") {
      gesture = "sheet"
    } else if (content.scrollTop <= 0 && dy > 0) {
      gesture = "sheet"          // at top, pulling down → collapse the sheet
    } else {
      gesture = "scroll"         // expanded: scroll content natively
    }

    if (gesture === "sheet") {
      sheet.style.transition = "none"
      root.style.setProperty("--sheet-anim", "0ms") // controls track instantly during drag
    }
  }

  if (gesture === "sheet") {
    e.preventDefault()
    setSheetH(Math.max(peekH(), Math.min(startH - dy, fullH())))
  }
}

function onTouchEnd(): void {
  if (gesture === "sheet") snapToCurrent()
  gesture = "undecided"
}
